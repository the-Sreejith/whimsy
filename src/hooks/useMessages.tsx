
import { useState, useCallback } from "react";
import { Message } from "@/types/chat";
import { v4 as uuidv4 } from "uuid";

export const useMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  
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
      } as Message,
    ]);
  }, []);
  
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    messages,
    addMessage,
    addSystemMessage,
    clearMessages
  };
};
