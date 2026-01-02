// Use a relative '/api' base during development so the Vite proxy forwards
// requests to the backend and cookies are handled as same-origin. In
// production, allow an explicit VITE_API_URL to override the base.
const API_URL = (import.meta.env.DEV)
  ? '/api'
  : (import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api');

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;
  // client-side protection: short caches, pending markers, and cooldowns for sensitive endpoints
  private _cache: Record<string, { ts: number; data: any }> = {};
  private _cooldowns: Record<string, number> = {};
  // track if a refresh is in progress to avoid concurrent refresh attempts
  private _refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Refresh access token using the refresh token endpoint
  private async refreshAccessToken(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/auth/refresh`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        console.warn('[API] Token refresh failed with status', response.status);
        // On refresh failure, clear tokens and redirect to auth
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth';
        return false;
      }

      const data = await response.json().catch(() => null);
      if (data?.data?.accessToken) {
        localStorage.setItem('accessToken', data.data.accessToken);
        if (data?.data?.refreshToken) {
          localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[API] Token refresh error', err);
      return false;
    }
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 4;
    let attempt = 0;
    let backoff = 1000;

    const now = Date.now();
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    const isAuthMe = endpoint === '/auth/me' && isGet;
    const isActiveService = endpoint === '/services/active' && isGet;
    

    // If we have a recent cached response for /auth/me or /services/active, return it (short TTL)
    if ((isAuthMe || isActiveService) && this._cache[endpoint] && now - this._cache[endpoint].ts < 10_000) {
      return this._cache[endpoint].data;
    }

    // If a client-side cooldown exists for this endpoint (set after 429), avoid hitting server
    const cd = this._cooldowns[endpoint];
    if (cd && cd > now) {
      return { success: false, error: 'Client-side cooldown after rate limit' } as ApiResponse<T>;
    }

    while (attempt <= maxRetries) {
      try {
        const response = await fetch(url, {
          ...options,
          credentials: 'include',
          headers: {
            ...this.getHeaders(),
            ...options.headers,
          },
        });

        let data: any = null;
        try {
          data = await response.json();
        } catch (e) {
          // No JSON body
        }

        if (response.status === 429) {
          // Rate limited. Honor Retry-After header if present, otherwise exponential backoff.
          const retryAfter = response.headers.get('Retry-After');
          let waitMs = backoff;
          if (retryAfter) {
            const sec = parseInt(retryAfter, 10);
            if (!isNaN(sec)) waitMs = sec * 1000;
            else {
              const date = Date.parse(retryAfter);
              if (!isNaN(date)) waitMs = Math.max(0, date - Date.now());
            }
          }
          // For sensitive endpoints (like polling /services/*) treat a 429
          // as a hard signal: set a longer cooldown and avoid retry loops.
          const normalized = endpoint || '';
          const isActiveService = normalized === '/services/active' && (options.method || 'GET').toUpperCase() === 'GET';
          const isServiceResource = normalized.startsWith('/services/');
          try {
            if (isActiveService) {
              // set a longer cooldown (5 minutes) and do not retry
              this._cooldowns[endpoint] = Date.now() + 5 * 60 * 1000;
              console.warn('API rate limited for /services/active — applying 5m client cooldown');
              return { success: false, error: data?.error || `Request failed with status ${response.status}` };
            }
            if (isServiceResource) {
              // requests for specific services (e.g., /services/:id) are often
              // polled; if the server responds 429, apply a moderate cooldown
              // (45s) to avoid hammering.
              const cooldown = Math.max(waitMs, 45 * 1000);
              this._cooldowns[endpoint] = Date.now() + cooldown;
              console.warn(`API rate limited for ${endpoint} — applying ${Math.round(cooldown/1000)}s client cooldown`);
              return { success: false, error: data?.error || `Request failed with status ${response.status}` };
            }
            // set a client-side cooldown to avoid hammering the endpoint (honor Retry-After)
            this._cooldowns[endpoint] = Date.now() + waitMs;
          } catch (e) {
            // ignore
          }
          // If we've exhausted retries, return an error response to caller
          if (attempt === maxRetries) {
            const retryWindow = 30_000; // default 30s cooldown
            this._cooldowns[endpoint] = Date.now() + retryWindow;
            console.error('API Rate limit exceeded:', url);
            return { success: false, error: data?.error || `Request failed with status ${response.status}` };
          }
          // wait and retry
          await new Promise((res) => setTimeout(res, waitMs));
          attempt += 1;
          backoff *= 2;
          continue;
        }

        // Handle 401/403: attempt token refresh once, then retry
        if (response.status === 401 || response.status === 403) {
          const errMsg = data?.error || `Request failed with status ${response.status}`;
          
          // Prevent concurrent refresh attempts
          if (!this._refreshPromise) {
            this._refreshPromise = this.refreshAccessToken().finally(() => {
              this._refreshPromise = null;
            });
          }

          const refreshed = await this._refreshPromise;
          if (refreshed && attempt < maxRetries) {
            // Retry the original request with new token
            attempt += 1;
            continue;
          }

          // Refresh failed or out of retries
          try {
            if (isAuthMe) this._cooldowns[endpoint] = Date.now() + 30_000; // 30s cooldown for auth/me
          } catch (e) {
            // ignore
          }
          return { success: false, error: errMsg, status: response.status } as ApiResponse<T>;
        }

        if (!response.ok) {
          // Try to capture server error body (JSON or text) to aid debugging.
          let serverMsg: string | null = null;
          try {
            // clone the response so earlier json() consumption doesn't prevent reading text
            const clone = response.clone();
            const txt = await clone.text();
            serverMsg = txt || null;
          } catch (e) {
            serverMsg = null;
          }

          const errMessage = data?.error || serverMsg || `Request failed with status ${response.status}`;
          const errObj: ApiResponse = {
            success: false,
            error: errMessage,
            status: response.status,
            // include some debug fields to help callers/logging
            data: undefined,
          } as ApiResponse;
          try {
            // Use debug-level logging for non-ok responses to avoid polluting
            // DevTools as errors (installHook shows console.error entries).
            if (import.meta.env.DEV) console.debug('API non-ok response', { url, status: response.status, body: serverMsg, jsonBody: data });
          } catch (e) {
            // ignore logging errors
          }
          return errObj;
        }

        // Cache successful responses for sensitive GET endpoints to reduce request churn
        if ((isAuthMe || isActiveService) && data) {
          try {
            this._cache[endpoint] = { ts: Date.now(), data };
          } catch (e) {
            // ignore cache failures
          }
        }

        return data;
      } catch (error) {
        // On network or other errors, decide whether to retry
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, backoff));
          attempt += 1;
          backoff *= 2;
          continue;
        }
        console.error('API Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
    // Shouldn't reach here, but return a generic failure
    return { success: false, error: 'Request failed' };
  }

  // Auth
  async requestOtp(_type: 'phone' | 'email', value: string, _name?: string) {
    // Backend expects { phone, role } for request-otp
    // type parameter is ignored since backend only supports phone auth currently
    return this.request('/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: value, role: 'HELPER' }),
    });
  }

  async verifyOtp(_type: 'phone' | 'email', value: string, otp: string, name?: string, role?: 'PATIENT' | 'HELPER') {
    // Backend expects { phone, otp, name, role } for verify-otp
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: value, otp, name, role: role || 'HELPER' }),
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }
  
  // Token refresh: if a refreshToken string is provided, send it in the body.
  // Otherwise rely on any httpOnly cookie the backend may have set.
  async refreshTokens(refreshToken?: string) {
    return this.request('/auth/refresh', {
      method: 'POST',
      ...(refreshToken ? { body: JSON.stringify({ refreshToken }) } : {}),
    });
  }

  // Best-effort logout to clear server httpOnly cookies if the backend exposes it
  async logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }
  
  // Helper
  // Helper
  async getHelperProfile() {
    return this.request('/helpers/me');
  }

  async createHelper(data: any) {
    return this.request('/helpers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Register helper with documents (multipart form-data)
  async registerHelperWithDocuments(form: FormData) {
    const url = `${this.baseUrl}/helpers/register`;
    try {
      // Extract Authorization header only (avoid Content-Type for multipart)
      const baseHeaders = this.getHeaders();
      const authHeader = (baseHeaders as Record<string, string>).Authorization;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          // Let the browser set multipart boundary; do not set Content-Type here
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { success: false, error: data?.error || `Request failed with status ${response.status}`, status: response.status } as ApiResponse<any>;
      }
      // Ensure success payload carries status for consistency
      return { ...(data || {}), status: response.status } as ApiResponse<any>;
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Network error' } as ApiResponse<any>;
    }
  }

  // Check whether a helper already exists by phone or aadhaar
  // Expects backend to return { success: boolean, data: { exists: boolean, field?: 'phone'|'aadhaar'|'both' } }
  async checkHelperExists(phone?: string, aadhaar?: string) {
    return this.request('/helpers/exists', {
      method: 'POST',
      body: JSON.stringify({ phone, aadhaar }),
    });
  }

  async updateAvailability(helperId: string, isAvailable: boolean) {
    return this.request(`/helpers/${helperId}/availability`, {
      method: 'PATCH',
      body: JSON.stringify({ isAvailable }),
    });
  }

  async updateLocation(helperId: string, lat: number, lng: number) {
    return this.request(`/helpers/${helperId}/location`, {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng }),
    });
  }

  // Services
  async getActiveService() {
    return this.request('/services/active');
  }

  async getService(serviceId: string) {
    return this.request(`/services/${serviceId}`);
  }

  async verifyServiceOtp(serviceId: string, otp: string) {
    return this.request(`/services/${serviceId}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
  }

  async arriveService(serviceId: string) {
    return this.request(`/services/${serviceId}/arrive`, {
      method: 'POST',
    });
  }

  async completeService(serviceId: string) {
    return this.request(`/services/${serviceId}/complete`, {
      method: 'POST',
    });
  }

  async acceptService(serviceId: string) {
    return this.request(`/services/${serviceId}/accept`, {
      method: 'POST',
    });
  }

  async declineService(serviceId: string) {
    return this.request(`/services/${serviceId}/decline`, {
      method: 'POST',
    });
  }

  async updateServiceStatus(serviceId: string, status: string) {
    return this.request(`/services/${serviceId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getServiceHistory() {
    return this.request('/services/history');
  }

  async getEarnings() {
    return this.request('/helpers/earnings');
  }

  async getHelperHoursOnline() {
    return this.request<any>('GET', '/analytics/helper/hours-online');
  }

  // Ratings
  async rateService(serviceId: string, rating: number, comment?: string) {
    return this.request(`/services/${serviceId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }

  async getServiceRating(serviceId: string) {
    return this.request(`/services/${serviceId}/rating`);
  }

  // Chat
  async getChatMessages(serviceId: string) {
    return this.request(`/chat/service/${serviceId}/messages`);
  }

  async sendChatMessage(data: {
    serviceId: string;
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
    message?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    return this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async markChatAsRead(serviceId: string) {
    return this.request(`/chat/service/${serviceId}/mark-read`, {
      method: 'POST',
    });
  }

  async getUnreadChatCount() {
    return this.request('/chat/unread-count');
  }

  async getChatTemplates() {
    return this.request('/chat/templates');
  }

  async uploadChatFile(file: File, messageType: 'IMAGE' | 'FILE' | 'VOICE') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messageType', messageType);

    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${this.baseUrl}/chat/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    return response.json();
  }

  // Notifications
  async getNotifications(limit = 50) {
    return this.request(`/notifications?limit=${limit}`);
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/mark-read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async deleteNotification(notificationId: string) {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async getNotificationPreferences() {
    return this.request('/notifications/preferences');
  }

  async updateNotificationPreferences(preferences: any) {
    return this.request('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // Analytics
  async getHelperEarnings(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/analytics/helper/earnings?${params.toString()}`);
  }

  async getHelperServiceBreakdown() {
    return this.request('/analytics/helper/service-breakdown');
  }

  async getHelperRatingStats() {
    return this.request('/analytics/helper/rating-stats');
  }

  async getEarningsTrends(period: 'daily' | 'weekly' | 'monthly' = 'weekly', limit = 30) {
    return this.request(`/analytics/helper/earnings-trends?period=${period}&limit=${limit}`);
  }

  async getHelperPeakHours() {
    return this.request('/analytics/helper/peak-hours');
  }

  async getHelperServiceTypeBreakdown() {
    return this.request('/analytics/helper/service-type-breakdown');
  }

  async getHelperSatisfactionTrends(period: 'daily' | 'weekly' | 'monthly' = 'weekly') {
    return this.request(`/analytics/helper/satisfaction-trends?period=${period}`);
  }
}

export const apiClient = new ApiClient(API_URL);

