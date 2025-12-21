export const env = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  wsUrl: import.meta.env.VITE_WS_URL || 'http://localhost:3000/realtime',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
