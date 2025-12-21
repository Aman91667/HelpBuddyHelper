import { useEffect, useCallback } from 'react';
import { getSocket, emitEvent } from '@/core/socket/socketClient';
import { SOCKET_EVENTS } from '@/core/config/constants';

export const useHelperSocket = () => {
  const socket = getSocket();

  const updateLocation = useCallback((serviceId: string, location: { lat: number; lng: number }) => {
    emitEvent(SOCKET_EVENTS.HELPER_LOCATION_UPDATE, {
      serviceId,
      location,
      timestamp: Date.now(),
    });
  }, []);

  const onServiceRequest = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on(SOCKET_EVENTS.SERVICE_REQUEST_CREATED, callback);
      return () => {
        socket.off(SOCKET_EVENTS.SERVICE_REQUEST_CREATED, callback);
      };
    }
  }, [socket]);

  const onServiceUpdate = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on(SOCKET_EVENTS.SERVICE_REQUEST_UPDATED, callback);
      return () => {
        socket.off(SOCKET_EVENTS.SERVICE_REQUEST_UPDATED, callback);
      };
    }
  }, [socket]);

  const onPatientLocationUpdate = useCallback((callback: (data: any) => void) => {
    if (socket) {
      socket.on(SOCKET_EVENTS.PATIENT_LOCATION_UPDATE, callback);
      return () => {
        socket.off(SOCKET_EVENTS.PATIENT_LOCATION_UPDATE, callback);
      };
    }
  }, [socket]);

  useEffect(() => {
    return () => {
      // Cleanup socket listeners when component unmounts
      if (socket) {
        socket.off(SOCKET_EVENTS.SERVICE_REQUEST_CREATED);
        socket.off(SOCKET_EVENTS.SERVICE_REQUEST_UPDATED);
        socket.off(SOCKET_EVENTS.PATIENT_LOCATION_UPDATE);
      }
    };
  }, [socket]);

  return {
    socket,
    updateLocation,
    onServiceRequest,
    onServiceUpdate,
    onPatientLocationUpdate,
    isConnected: socket?.connected || false,
  };
};
