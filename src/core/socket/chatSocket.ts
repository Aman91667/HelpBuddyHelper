import { io, Socket } from 'socket.io-client';

class ChatSocketClient {
  private socket: Socket | null = null;
  private serviceId: string | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    const apiUrl = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin;
    this.socket = io(`${apiUrl}/chat`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    // Attach pre-registered listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        this.socket?.on(event, cb);
      });
    });

    this.socket.on('connect', () => {
      console.log('[ChatSocket] Connected to chat server');
    });

    this.socket.on('disconnect', () => {
      console.log('[ChatSocket] Disconnected from chat server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[ChatSocket] Connection error:', error);
    });

    this.socket.on('auth:invalid', () => {
      console.log('[ChatSocket] Invalid auth, clearing tokens');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/auth';
    });

    return this.socket;
  }

  joinService(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }

    this.serviceId = serviceId;
    this.socket.emit('join:service', { serviceId });
    console.log(`[ChatSocket] Joined service: ${serviceId}`);
  }

  leaveService() {
    if (!this.socket || !this.serviceId) return;

    this.socket.emit('leave:service', { serviceId: this.serviceId });
    console.log(`[ChatSocket] Left service: ${this.serviceId}`);
    this.serviceId = null;
  }

  sendMessage(data: {
    serviceId: string;
    senderId?: string;
    senderType?: 'PATIENT' | 'HELPER';
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
    message?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }

    const payload = {
      ...data,
      senderId: data.senderId || localStorage.getItem('userId') || undefined,
      senderType: data.senderType || 'HELPER',
    } as any;

    this.socket.emit('send:message', payload);
  }

  private _registerListener(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event)!;
    if (set.has(callback)) return;
    set.add(callback);
    if (this.socket) this.socket.on(event, callback);
  }

  onNewMessage(callback: (message: any) => void) {
    // Listen for both the service-room broadcast and the direct-to-user event.
    // Some recipients may not be joined to the service room (e.g., when not viewing
    // the specific service) but should still receive direct 'message:new' notifications.
    this._registerListener('message:received', callback);
    this._registerListener('message:new', callback);
  }

  onMessageRead(callback: (data: any) => void) {
    this._registerListener('message:read', callback);
  }

  onMessagesRead(callback: (data: any) => void) {
    this._registerListener('messages:read', callback);
  }

  emitMarkAsRead(serviceId: string, userId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    this.socket.emit('messages:mark-read', { serviceId, userId });
  }

  onTypingStart(callback: (data: { senderId: string }) => void) {
    this._registerListener('user:typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  onTypingStop(callback: (data: { senderId: string }) => void) {
    this._registerListener('user:stopped-typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  emitTypingStart(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    const userType = 'HELPER';
    this.socket.emit('typing:start', { serviceId, userId, userType });
  }

  emitTypingStop(serviceId: string) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }
    const userId = localStorage.getItem('userId') || '';
    this.socket.emit('typing:stop', { serviceId, userId });
  }

  disconnect() {
    if (this.socket) {
      this.leaveService();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  getSocket() {
    return this.socket;
  }
}

export const chatSocket = new ChatSocketClient();
