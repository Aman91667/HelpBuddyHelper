import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { apiClient } from '@/core/api/client';
import { socketClient } from '@/core/socket/client';
import type { User } from '@/types';

interface Helper {
  id: string;
  userId: string;
  isAvailable: boolean;
  isVerified?: boolean;
  rating?: number;
  completedServices?: number;
  totalEarnings?: number;
  currentBalance?: number;
}

interface AuthContextType {
  user: User | null;
  helper: Helper | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => void;
  updateHelper: (helper: Helper) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [helper, setHelper] = useState<Helper | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const authTimerRef = useRef<number | null>(null);
  const isCheckingRef = useRef(false);
  const lastRefreshRef = useRef<number | null>(null);
  
  useEffect(() => {
    authTimerRef.current = window.setTimeout(() => {
      checkAuth();
    }, 300);
    return () => {
      if (authTimerRef.current) {
        window.clearTimeout(authTimerRef.current);
        authTimerRef.current = null;
      }
    };
  }, []);

  const checkAuth = async () => {
    // Prevent concurrent runs which can cause refresh storming
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    let token = localStorage.getItem('accessToken');
    const logoutBlocked = localStorage.getItem('logoutBlock') === '1';

    // Verify token is for HELPER before proceeding
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.userType !== 'HELPER') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('logoutBlock');
          token = null; // Clear the token variable so we don't use it
        }
      } catch (e) {
        console.error('[AUTH] Failed to decode token:', e);
        // Invalid token, clear it
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        token = null;
      }
    }

    const attemptRefresh = async () => {
      // If user explicitly logged out, do not attempt cookie/body refresh
      if (logoutBlocked) return false;
      const now = Date.now();
      // avoid hammering the refresh endpoint: allow at most one attempt per 10s
      if (lastRefreshRef.current && now - lastRefreshRef.current < 10000) return false;
      lastRefreshRef.current = now;
      try {
        // Prefer using a stored refresh token (if present) so we avoid
        // a noisy cookie-only POST that frequently returns 400 when no
        // httpOnly cookie was set in this session.
        const stored = localStorage.getItem('refreshToken');
        if (stored) {
          const bodyResp = await apiClient.refreshTokens(stored);
          if (bodyResp && bodyResp.success && bodyResp.data) {
            const dd: any = bodyResp.data;
            if (dd.accessToken) {
              // Verify the refreshed token is for HELPER
              try {
                const payload = JSON.parse(atob(dd.accessToken.split('.')[1]));
                if (payload.userType !== 'HELPER') {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  return false;
                }
              } catch (e) {
                console.error('[AUTH] Failed to decode refreshed token:', e);
                return false;
              }
              
              localStorage.setItem('accessToken', dd.accessToken);
              if (dd.refreshToken) localStorage.setItem('refreshToken', dd.refreshToken);
              token = dd.accessToken;
              return true;
            }
          } else {
            // If refresh failed with 401, tokens are invalid - clear them
            if ((bodyResp as any)?.status === 401) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              return false;
            }
          }
        }

        // Fall back to cookie-based (httpOnly) refresh. Previously we avoided
        // calling this when a localStorage flag was missing to prevent noisy
        // 400s. In practice, failing to attempt cookie refresh here results in
        // persistent 403s when the browser actually does have a valid cookie.
        // Try it once as a fallback.
        try {
          const refreshResp = await apiClient.refreshTokens();
          if (refreshResp && refreshResp.success && refreshResp.data) {
            const dd: any = refreshResp.data;
            if (dd.accessToken) {
              // Verify the cookie-refreshed token is for HELPER
              try {
                const payload = JSON.parse(atob(dd.accessToken.split('.')[1]));
                if (payload.userType !== 'HELPER') {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  return false;
                }
              } catch (e) {
                console.error('[AUTH] Failed to decode cookie-refreshed token:', e);
                return false;
              }
              
              localStorage.setItem('accessToken', dd.accessToken);
              if (dd.refreshToken) localStorage.setItem('refreshToken', dd.refreshToken);
              token = dd.accessToken;
              return true;
            }
          } else if ((refreshResp as any)?.status === 401) {
            // Cookie-based refresh also failed with 401
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        } catch (e) {
          // ignore cookie-refresh failures
        }
      } catch (e) {
        // If error is 401, clear tokens
        if ((e as any)?.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      return false;
    };

    if (!token) {
      // If there's no token and logout was explicit, stop here
      if (logoutBlocked) {
        setIsLoading(false);
        isCheckingRef.current = false;
        return;
      }
      const ok = await attemptRefresh();
      if (!ok) {
        setIsLoading(false);
        isCheckingRef.current = false;
        return;
      }
      
      // After refresh, verify the new token is for HELPER
      token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.userType !== 'HELPER') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setIsLoading(false);
            isCheckingRef.current = false;
            return;
          }
        } catch (e) {
          console.error('[AUTH] Failed to decode refreshed token:', e);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setIsLoading(false);
          isCheckingRef.current = false;
          return;
        }
      }
    }

    try {
      const response = await apiClient.getMe();
      if (response.success && response.data) {
        const raw = response.data as any;
        const resolvedUser: User = raw.user ? raw.user : raw;
        setUser(resolvedUser);

        // Try to fetch helper profile. A 404 indicates the user has not
        // registered as a helper yet — treat that as "no helper" rather
        // than letting the error bubble and retrigger refresh logic.
        try {
          const helperResponse = await apiClient.getHelperProfile();
          
          if (helperResponse && helperResponse.success && helperResponse.data) {
            const helperData = helperResponse.data as Helper;
            setHelper(helperData);
          } else {
            // Keep helper as null so the onboarding page can handle
            // registration explicitly (do not auto-create).
            setHelper(null);
          }
        } catch (e) {
          // apiClient may throw for non-ok responses (404). Treat that as
          // "helper not found" and continue — avoid triggering a refresh
          // retry loop.
          setHelper(null);
        }

        // Ensure socket is connected when auth succeeds (e.g., on page reload)
        try {
          const tk = localStorage.getItem('accessToken');
          if (tk) {
            const { socketClient } = await import('@/core/socket/client');
            socketClient.connect(tk);
          }
        } catch (e) {
          // ignore
        }

      } else { 
        const ok = await attemptRefresh();
        if (!ok) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      const ok = await attemptRefresh();
      if (!ok) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    } finally {
      setIsLoading(false);
      isCheckingRef.current = false;
    }
  };

  const login = async (accessToken: string, refreshToken: string) => {
    // Verify that the token is for a HELPER user
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      if (payload.userType !== 'HELPER') {
        console.error('[AUTH] Invalid user type:', payload.userType);
        throw new Error('This account is not registered as a helper');
      }
    } catch (e) {
      console.error('[AUTH] Token validation failed:', e);
      throw e;
    }
    
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    // Mark that a refresh token / cookie was issued so subsequent reloads
    // can decide whether to attempt cookie-based refreshs. This avoids
    // noisy failed refresh POSTs when no cookie exists.
    try {
      localStorage.setItem('hasRefreshCookie', '1');
      localStorage.removeItem('logoutBlock');
    } catch (e) {
      // ignore
    }

    // Ensure socket connects immediately after login so realtime status is accurate
    try {
      // dynamic import of socket client to avoid circular deps
      const { socketClient } = await import('@/core/socket/client');
      socketClient.connect(accessToken);
    } catch (e) {
      // ignore
    }

    await checkAuth();
  };

  const logout = () => {
    // Attempt to clear server-side httpOnly cookie if supported
    try { void apiClient.logout(); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('hasRefreshCookie');
    // Block future automatic cookie refresh until explicit login
    try { localStorage.setItem('logoutBlock', '1'); } catch {}
    socketClient.disconnect();
    setUser(null);
    setHelper(null);
  };

  const updateHelper = (updatedHelper: Helper) => {
    setHelper(updatedHelper);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        helper,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateHelper,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
