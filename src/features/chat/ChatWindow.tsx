import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, X, MessageSquare, Check, CheckCheck } from 'lucide-react';
import { apiClient } from '../../core/api/client';
import { chatSocket } from '../../core/socket/chatSocket';

interface Message {
  id: string;
  serviceId: string;
  senderId: string;
  senderType: 'PATIENT' | 'HELPER';
  messageType: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE' | 'TEMPLATE';
  message?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  mimeType?: string;
  isRead: boolean;
  createdAt: string;
}

interface ChatWindowProps {
  serviceId: string;
  patientName: string;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ serviceId, patientName, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [attachments, setAttachments] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUserId = localStorage.getItem('userId') || '';

  useEffect(() => {
    loadMessages();
    loadTemplates();
    
    const token = localStorage.getItem('accessToken');
    if (token) {
      chatSocket.connect(token);
      chatSocket.joinService(serviceId);
    }

    chatSocket.onNewMessage((message: Message) => {
      setMessages(prev => {
        // Check if message already exists (from optimistic update)
        const exists = prev.find(m => m.id === message.id);
        if (exists) {
          // Replace optimistic message with real one
          return prev.map(m => m.id === message.id ? message : m);
        }
        return [...prev, message];
      });
      scrollToBottom();
      
      // Mark as read if not sent by us
      if (message.senderId !== currentUserId) {
        apiClient.markChatAsRead(serviceId);
        chatSocket.emitMarkAsRead(serviceId, currentUserId);
      }
    });

    chatSocket.onMessagesRead(() => {
      // Update all our sent messages to read status
      setMessages(prev => prev.map(msg => 
        msg.senderId === currentUserId ? { ...msg, isRead: true } : msg
      ));
    });

    chatSocket.onTypingStart(({ senderId }) => {
      if (senderId !== currentUserId) {
        setIsTyping(true);
      }
    });

    chatSocket.onTypingStop(({ senderId }) => {
      if (senderId !== currentUserId) {
        setIsTyping(false);
      }
    });

    return () => {
      chatSocket.leaveService();
    };
  }, [serviceId]);

  const loadMessages = async () => {
    setLoading(true);
    const response = await apiClient.getChatMessages(serviceId);
    if (response.success && response.data) {
      setMessages(Array.isArray(response.data) ? response.data : []);
      scrollToBottom();
      apiClient.markChatAsRead(serviceId);
    }
    setLoading(false);
  };

  const loadTemplates = async () => {
    const response = await apiClient.getChatTemplates();
    if (response.success && response.data) {
      setTemplates(Array.isArray(response.data) ? response.data : []);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Fetch attachments securely via authenticated API and cache as blob URLs.
  useEffect(() => {
    const toFetch = messages.filter(m => (m.messageType === 'IMAGE' || m.messageType === 'FILE' || m.messageType === 'VOICE') && !attachments[m.id]);
    if (toFetch.length === 0) return;

    toFetch.forEach(async (m) => {
      try {
        const token = localStorage.getItem('accessToken');
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const resp = await fetch(`/api/chat/file/${m.id}`, { headers });
        if (!resp.ok) {
          // fallback to public fileUrl if available
          if (m.fileUrl) {
            setAttachments(prev => ({ ...prev, [m.id]: m.fileUrl! }));
          }
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        setAttachments(prev => ({ ...prev, [m.id]: url }));
      } catch (e) {
        if (m.fileUrl) {
          setAttachments(prev => ({ ...prev, [m.id]: m.fileUrl! }));
        }
      }
    });

    // cleanup to revoke object URLs when messages change/unmount
    return () => {
      Object.values(attachments).forEach((u) => {
        try { URL.revokeObjectURL(u); } catch (e) { /* ignore */ }
      });
    };
  }, [messages, attachments]);

  const handleTyping = () => {
    chatSocket.emitTypingStart(serviceId);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      chatSocket.emitTypingStop(serviceId);
    }, 2000);
  };

  const sendMessage = async (text?: string, template?: boolean) => {
    const messageText = text || newMessage.trim();
    if (!messageText) return;

    const messageData = {
      serviceId,
      messageType: (template ? 'TEMPLATE' : 'TEXT') as 'TEXT' | 'TEMPLATE',
      message: messageText,
    };

    console.log('[HELPER] Sending message:', messageData);

    // Optimistic update
    const tempMessage: Message = {
      id: Date.now().toString(),
      serviceId,
      senderId: currentUserId,
      senderType: 'HELPER',
      messageType: messageData.messageType,
      message: messageText,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    console.log('[HELPER] Temp message:', tempMessage);

    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setShowTemplates(false);
    scrollToBottom();

    // Send via HTTP API (will also broadcast via WebSocket)
    try {
      const result = await apiClient.sendChatMessage(messageData);
      console.log('[HELPER] Send result:', result);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    }
    
    chatSocket.emitTypingStop(serviceId);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);

    try {
      // Determine message type based on file type
      let messageType: 'IMAGE' | 'FILE' | 'VOICE' = 'FILE';
      if (file.type.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (file.type.startsWith('audio/')) {
        messageType = 'VOICE';
      }

      const response = await apiClient.uploadChatFile(file, messageType);
      
      if (response.success && response.data) {
        const messageData = {
          serviceId,
          messageType,
          fileName: file.name,
          fileUrl: response.data.fileUrl,
          mimeType: file.type,
          fileSize: file.size,
        };

        // Optimistic update
        const tempMessage: Message = {
          id: Date.now().toString(),
          serviceId,
          senderId: currentUserId,
          senderType: 'HELPER',
          messageType,
          fileName: file.name,
          fileUrl: response.data.fileUrl,
          fileSize: file.size,
          mimeType: file.type,
          isRead: false,
          createdAt: new Date().toISOString(),
        };

        setMessages(prev => [...prev, tempMessage]);
        scrollToBottom();

        try {
          await apiClient.sendChatMessage(messageData);
        } catch (error) {
          console.error('Failed to send file message:', error);
          setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = (message: Message) => {
    // Helper sends messages with senderType 'HELPER' and matching senderId
    const isSentByMe = message.senderType === 'HELPER' && message.senderId === currentUserId;
    
    console.log('[HELPER] Rendering message:', {
      id: message.id,
      senderType: message.senderType,
      isSentByMe,
      messageType: message.messageType,
      hasMessage: !!message.message,
      message: message.message
    });

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-[70%]`}>
          <div
            className={`rounded-2xl px-4 py-2 ${
              isSentByMe
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
            }`}
          >
            {message.messageType === 'TEXT' && message.message && (
              <p className={`text-sm break-words ${isSentByMe ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>{message.message}</p>
            )}
            {message.messageType === 'IMAGE' && message.fileUrl && (
              <div className="space-y-2">
                <img
                  src={attachments[message.id] || message.fileUrl}
                  alt="Sent image"
                  className="rounded-lg max-w-full"
                />
                {message.message && (
                  <p className={`text-sm ${isSentByMe ? 'text-white' : 'text-black'}`}>{message.message}</p>
                )}
              </div>
            )}
            {message.messageType === 'FILE' && (attachments[message.id] || message.fileUrl) && (
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                <button
                  onClick={async () => {
                    try {
                      let url = attachments[message.id];
                      if (!url) {
                        const token = localStorage.getItem('accessToken');
                        const headers: Record<string, string> = {};
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        const resp = await fetch(`/api/chat/file/${message.id}`, { headers });
                        if (!resp.ok) {
                          if (message.fileUrl) {
                            window.open(message.fileUrl, '_blank');
                            return;
                          }
                          return;
                        }
                        const blob = await resp.blob();
                        url = URL.createObjectURL(blob);
                        setAttachments(prev => ({ ...prev, [message.id]: url }));
                      }

                      const a = document.createElement('a');
                      a.href = url;
                      a.download = message.fileName || 'file';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    } catch (e) {
                      if (message.fileUrl) window.open(message.fileUrl, '_blank');
                    }
                  }}
                  className="text-sm underline bg-transparent"
                >
                  {message.fileName || 'Download file'}
                </button>
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1 mt-1 px-2`}>
            {isSentByMe ? (
              <>
                <span className="text-slate-400">
                  {message.isRead ? (
                    <CheckCheck className="h-3 w-3 text-blue-400" />
                  ) : (
                    <Check className="h-3 w-3 text-white/70" />
                  )}
                </span>
                <span className="text-xs text-slate-400">
                  {formatTime(message.createdAt)}
                </span>
              </>
            ) : (
              <>
                <span className="w-3 h-3"></span>
                <span className="text-xs text-slate-400">
                  {formatTime(message.createdAt)}
                </span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-hidden">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[calc(100vh-32px)] sm:h-[calc(100vh-48px)] md:h-[600px] md:max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-emerald-500 text-white rounded-t-lg">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6" />
            <div>
              <h3 className="font-semibold text-lg">Chat with {patientName}</h3>
              <p className="text-sm text-white/80">Service support</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Send a message to start the conversation</p>
            </div>
          ) : (
            <>
              {messages.map(renderMessage)}
              {isTyping && (
                <div className="flex justify-start mb-3">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Quick Templates */}
        {showTemplates && templates.length > 0 && (
          <div className="p-3 border-t bg-white">
            <p className="text-xs text-gray-600 mb-2">Quick responses:</p>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => sendMessage(template.text, true)}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition"
                >
                  {template.text}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-white rounded-b-lg">
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-2 hover:bg-gray-100 rounded-full transition"
              title="Quick responses"
            >
              <MessageSquare className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-gray-100 rounded-full transition"
              title="Attach file"
            >
              {uploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
              ) : (
                <Paperclip className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*"
            />
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!newMessage.trim()}
              className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
