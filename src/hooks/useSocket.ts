import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useSocket = () => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const customUrl = localStorage.getItem('__roms_server_ip');
    const newSocket = io(customUrl || window.location.origin);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join-room', user.role);
      newSocket.emit('register', user.id);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [user]);

  return { socket, connected };
};
