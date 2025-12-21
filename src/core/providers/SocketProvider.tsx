import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { socketClient } from '@/core/socket/client';

const SocketContext = createContext<{ socket: typeof socketClient | null; isConnected: boolean }>({ socket: null, isConnected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(socketClient.isConnected());
  const socketRef = useRef(socketClient);

  useEffect(() => {
    const token = (typeof window !== 'undefined') ? (localStorage.getItem('accessToken') || localStorage.getItem('token')) : null;
    if (token) socketRef.current.connect(token);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socketRef.current.on('connect', onConnect);
    socketRef.current.on('disconnect', onDisconnect);

    return () => {
      socketRef.current.off('connect', onConnect);
      socketRef.current.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => useContext(SocketContext);

export default SocketProvider;
