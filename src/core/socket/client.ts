import { io, Socket } from 'socket.io-client';

const rawApiUrl = import.meta.env.VITE_API_URL || 'https://helpbuddyback.onrender.com/api';
const SOCKET_URL = (rawApiUrl as string).replace(/\/api\/?$/i, '') || 'https://helpbuddyback.onrender.com';

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token?: string) {
    // Prefer explicitly-provided token, otherwise try common localStorage keys.
    const tokenFromStorage = (typeof window !== 'undefined')
      ? (localStorage.getItem('accessToken') || localStorage.getItem('token') || localStorage.getItem('refreshToken'))
      : null;
    const tokenToUse = token || tokenFromStorage || '';

    if (!tokenToUse) {
      console.warn('socketClient.connect() called without an access token — skipping authenticated socket connection');
      return null;
    }

    // quick client-side expiry check to avoid connecting with an expired JWT
    try {
      const parts = tokenToUse.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload && typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
          console.warn('socketClient.connect() token appears expired — not connecting');
          return null;
        }
      }
    } catch (e) {
      // ignore parse errors and proceed
    }

    if (this.socket?.connected) {
      console.debug('socketClient.connect() called but socket already connected', { socketId: this.socket.id });
      return this.socket;
    }

    // mask token for logs (don't print full token)
    try {
      const masked = `${String(tokenToUse).slice(0, 8)}...${String(tokenToUse).slice(-8)}`;
      console.debug('socketClient.connect() initiating socket to', SOCKET_URL + '/realtime', { tokenMasked: masked });
    } catch (e) {
      // ignore masking errors
    }

    this.socket = io(`${SOCKET_URL}/realtime`, {
      auth: { token: tokenToUse },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // Attach any listeners that were registered before the socket existed.
    // `on()` stores callbacks in `this.listeners`; make sure they are bound
    // to the real socket now that it's created.
    console.debug('socketClient: attaching pre-registered listeners', { count: this.listeners.size });
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.socket?.on(event, cb);
      });
    });

    try {
      this.socket.onAny((ev, ...args) => {
        // eslint-disable-next-line no-console
        console.debug('[HELPER-WS] event recv', ev, args);
      });
    } catch (e) {
      // ignore
    }

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;

      const serviceId = localStorage.getItem('activeServiceId');
      if (serviceId) {
        try {
          if (this.socket) this.socket.emit('join:service', { serviceId });
        } catch (e) {
          // ignore
        }
      }
    });

    // Handle token rotation from gateway
    this.socket.on('auth:rotated', (data: { accessToken?: string }) => {
      if (data?.accessToken) {
        console.debug('[HELPER-WS] Received rotated token from gateway');
        localStorage.setItem('accessToken', data.accessToken);
        // Update socket auth with new token
        if (this.socket) {
          this.socket.emit('auth:update', { token: data.accessToken });
        }
      }
    });

    // Listen for invalid token signature from server
    this.socket.on('auth:invalid', (data: { reason?: string; message?: string }) => {
      console.warn('[HELPER-WS] Server rejected token:', data.message || data.reason);
      // Clear invalid tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('token');
      // Disconnect socket
      this.disconnect();
      // Redirect to login page if not already there
      try {
        if (window.location.pathname !== '/auth' && window.location.pathname !== '/login') {
          window.location.href = '/auth';
        }
      } catch {
        // ignore
      }
    });

    // Handle whoami response
    this.socket.on('whoami', (data: { userId?: string }) => {
      console.debug('[HELPER-WS] whoami response:', data);
    });

    this.socket.on('disconnect', () => {
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('reconnect', (attempt) => {
      console.debug('[HELPER-WS] reconnect', attempt, { id: this.socket?.id });
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  emit(event: string, data?: any, callback?: (...args: any[]) => void) {
    if (this.socket?.connected) {
      this.socket.emit(event, data, callback);
    } else {
      console.warn('Socket not connected. Event not sent:', event);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    if (eventListeners.has(callback)) {
      return;
    }

    eventListeners.add(callback);
    // If socket already exists, bind immediately. If not, the callback
    // remains in `this.listeners` and will be attached when connect() runs.
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (callback) {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    } else {
      this.listeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketClient = new SocketClient();
