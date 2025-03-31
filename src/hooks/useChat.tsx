
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { initSocket, getSocket, closeSocket } from "@/lib/socket";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  id: string;
  text: string;
  sender: "me" | "stranger";
  timestamp: number;
}

export type ChatStatus = "idle" | "searching" | "chatting" | "disconnected";

export function useChat() {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Initialize socket connection
  useEffect(() => {
    const socket = initSocket();
    
    // Clean up on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      closeSocket();
    };
  }, []);
  
  // Set up listeners when socket is ready
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    
    socket.on("matched", (data: { roomId: string }) => {
      setRoomId(data.roomId);
      setStatus("chatting");
      addSystemMessage("You are now chatting with a stranger!");
    });
    
    socket.on("message", (data: { text: string }) => {
      addMessage(data.text, "stranger");
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    });
    
    socket.on("typing", () => {
      setIsTyping(true);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    });
    
    socket.on("stopped_typing", () => {
      setIsTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    });
    
    socket.on("disconnect_chat", () => {
      setStatus("disconnected");
      addSystemMessage("Stranger has disconnected.");
      setRoomId(null);
    });
    
    socket.on("error", (error: string) => {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    });
    
    // Clean up listeners when component unmounts
    return () => {
      socket.off("matched");
      socket.off("message");
      socket.off("typing");
      socket.off("stopped_typing");
      socket.off("disconnect_chat");
      socket.off("error");
    };
  }, []);
  
  const addMessage = useCallback((text: string, sender: "me" | "stranger") => {
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), text, sender, timestamp: Date.now() },
    ]);
  }, []);
  
  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { 
        id: uuidv4(), 
        text, 
        sender: "stranger", 
        timestamp: Date.now(),
        system: true 
      } as Message & { system?: boolean },
    ]);
  }, []);
  
  const startChat = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    
    setStatus("searching");
    setMessages([]);
    addSystemMessage("Looking for someone to chat with...");
    socket.emit("find_match");
  }, [addSystemMessage]);
  
  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    
    const socket = getSocket();
    if (!socket || !roomId) return;
    
    addMessage(text, "me");
    socket.emit("message", { roomId, text });
  }, [roomId, addMessage]);
  
  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    
    socket.emit(isTyping ? "typing" : "stopped_typing", { roomId });
  }, [roomId]);
  
  const nextChat = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    
    if (roomId) {
      socket.emit("disconnect_chat", { roomId });
    }
    
    startChat();
  }, [roomId, startChat]);
  
  const endChat = useCallback(() => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    
    socket.emit("disconnect_chat", { roomId });
    setStatus("disconnected");
    setRoomId(null);
  }, [roomId]);

  return {
    status,
    messages,
    isTyping,
    startChat,
    sendMessage,
    sendTyping,
    nextChat,
    endChat
  };
}
