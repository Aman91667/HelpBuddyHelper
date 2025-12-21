export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000/realtime';

export const ROUTES = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  ACTIVE_SERVICE: '/job/:serviceId',
  HISTORY: '/history',
  PROFILE: '/profile',
} as const;

export const SERVICE_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SERVICE_REQUEST_CREATED: 'service:request:created',
  SERVICE_REQUEST_UPDATED: 'service:request:updated',
  HELPER_LOCATION_UPDATE: 'helper:location:update',
  PATIENT_LOCATION_UPDATE: 'patient:location:update',
} as const;
