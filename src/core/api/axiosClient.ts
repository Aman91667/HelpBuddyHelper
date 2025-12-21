import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import { socketClient } from '@/core/socket/client';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach access token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

        // Do not attempt retry for auth endpoints to avoid interceptor recursion
        const reqUrl = originalRequest.url || '';
        if (reqUrl.includes('/auth/me') || reqUrl.includes('/auth/refresh')) {
          return Promise.reject(error);
        }

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        // Store new tokens
        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        // If socket is connected, update the socket auth in-place so listeners remain intact
        try {
          // If socket is connected we could implement an auth update method.
          // Current socketClient lacks updateAuth; reconnect if needed.
          if (socketClient && socketClient.isConnected()) {
            try {
              socketClient.disconnect();
              socketClient.connect(data.accessToken);
            } catch (e) {
              // ignore reconnect failure
            }
          }
        } catch (e) {
          // ignore socket errors during refresh
        }

        return axiosClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
  // Redirect to unified OTP auth page instead of legacy /helper/login route
  window.location.href = '/auth';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
