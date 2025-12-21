import { io, Socket } from 'socket.io-client';

class ChatSocketClient {
  private socket: Socket | null = null;
  private serviceId: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io('http://localhost:3000/chat', {
      auth: { token },
      transports: ['websocket', 'polling'],
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
    senderId: string;
    senderType: 'PATIENT' | 'HELPER';
    messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
    message?: string;
    fileUrl?: string;
    fileName?: string;
  }) {
    if (!this.socket) {
      console.warn('[ChatSocket] Socket not connected');
      return;
    }

    this.socket.emit('send:message', data);
  }

  onNewMessage(callback: (message: any) => void) {
    if (!this.socket) return;
    this.socket.on('message:received', callback);
  }

  onMessageRead(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('message:read', callback);
  }

  onMessagesRead(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('messages:read', callback);
  }

  emitMarkAsRead(serviceId: string, userId: string) {
    if (!this.socket) return;
    this.socket.emit('messages:mark-read', { serviceId, userId });
  }

  onTypingStart(callback: (data: { senderId: string }) => void) {
    if (!this.socket) return;
    this.socket.on('user:typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  onTypingStop(callback: (data: { senderId: string }) => void) {
    if (!this.socket) return;
    this.socket.on('user:stopped-typing', (data: { userId: string }) => {
      callback({ senderId: data.userId });
    });
  }

  emitTypingStart(serviceId: string) {
    if (!this.socket) return;
    const userId = localStorage.getItem('userId') || '';
    const userType = 'HELPER';
    this.socket.emit('typing:start', { serviceId, userId, userType });
  }

  emitTypingStop(serviceId: string) {
    if (!this.socket) return;
    const userId = localStorage.getItem('userId') || '';
    this.socket.emit('typing:stop', { serviceId, userId });
  }

  disconnect() {
    if (this.socket) {
      this.leaveService();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }
}

export const chatSocket = new ChatSocketClient();
