
import io, { Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://lovable-socket.glitch.me";

let socket: Socket | null = null;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL);
    
    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });
    
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });
    
    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });
  }
  
  return socket;
};

export const getSocket = (): Socket | null => socket;

export const closeSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
