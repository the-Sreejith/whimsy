
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { ChatStatus } from "@/types/chat";
import { useChatRoom } from "@/hooks/useChatRoom";
import { useMessages } from "@/hooks/useMessages";
import { chatService } from "@/services/chatService";

export { type ChatStatus } from "@/types/chat";
export { type Message } from "@/types/chat";

export function useChat() {
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [isTyping, setIsTyping] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>(uuidv4());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const { messages, addMessage, addSystemMessage, clearMessages } = useMessages();
  
  const handleMessageReceived = useCallback((text: string, sender: "stranger") => {
    addMessage(text, sender);
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [addMessage]);

  const handleTypingChange = useCallback((isTyping: boolean) => {
    setIsTyping(isTyping);
  }, []);
  
  const { setupRoomListeners, cleanup, sendTypingIndicator } = useChatRoom(
    userId,
    roomId,
    handleMessageReceived,
    handleTypingChange
  );
  
  // Clean up channels on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      cleanup();
    };
  }, [cleanup]);
  
  // Find a chat partner
  const startChat = useCallback(async () => {
    setStatus("searching");
    clearMessages();
    addSystemMessage("Looking for someone to chat with...");
    
    try {
      // Check for any available room with one participant
      const availableRoomId = await chatService.findAvailableRoom(userId);
      
      let newRoomId;
      
      if (availableRoomId) {
        // Join existing room
        newRoomId = availableRoomId;
        
        const joined = await chatService.joinRoom(newRoomId, userId);
        if (!joined) {
          throw new Error("Failed to join room");
        }
        
        // Add system message in the database
        await chatService.sendMessage(
          newRoomId,
          userId,
          'A stranger has joined the chat.',
          true
        );
          
      } else {
        // Create a new room
        newRoomId = await chatService.createNewRoom();
        if (!newRoomId) {
          throw new Error("Failed to create new room");
        }
          
        // Add user to room
        const joined = await chatService.joinRoom(newRoomId, userId);
        if (!joined) {
          throw new Error("Failed to join room");
        }
            
        addSystemMessage("Waiting for someone to join...");
        setStatus("searching");
      }
      
      if (newRoomId) {
        setRoomId(newRoomId);
        setupRoomListeners(newRoomId);
        
        // Subscribe to participant changes to detect when someone joins
        const participantChannel = supabase
          .channel(`participants:${newRoomId}`)
          .on('postgres_changes', 
            { 
              event: 'INSERT', 
              schema: 'public', 
              table: 'chat_participants',
              filter: `room_id=eq.${newRoomId}`
            }, 
            async () => {
              // Check if we have 2 participants now
              const { data: participants } = await supabase
                .from('chat_participants')
                .select('user_id')
                .eq('room_id', newRoomId);
                
              if (participants && participants.length >= 2) {
                setStatus("chatting");
                addSystemMessage("You are now chatting with a stranger!");
                
                // Remove this one-time listener
                supabase.removeChannel(participantChannel);
              }
            }
          )
          .subscribe();
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast({
        title: "Error",
        description: "Failed to start chat. Please try again.",
        variant: "destructive",
      });
      setStatus("idle");
    }
  }, [userId, addSystemMessage, setupRoomListeners, clearMessages]);
  
  // Send a message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !roomId) return;
    
    try {
      // Add message locally immediately for UI responsiveness
      addMessage(text, "me");
      
      // Send to database
      await chatService.sendMessage(roomId, userId, text);
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }, [roomId, userId, addMessage]);
  
  // Find new chat partner
  const nextChat = useCallback(async () => {
    if (roomId) {
      // Leave current room
      try {
        await chatService.sendMessage(
          roomId,
          userId,
          'Stranger has disconnected.',
          true
        );
          
        await chatService.leaveRoom(roomId, userId);
      } catch (error) {
        console.error("Error leaving chat:", error);
      }
    }
    
    // Clean up channels
    await cleanup();
    
    setRoomId(null);
    startChat();
  }, [roomId, userId, startChat, cleanup]);
  
  // End chat
  const endChat = useCallback(async () => {
    if (!roomId) return;
    
    try {
      // Add system message about disconnection
      await chatService.sendMessage(
        roomId,
        userId,
        'Stranger has disconnected.',
        true
      );
        
      // Remove participant from room
      await chatService.leaveRoom(roomId, userId);
      
      // Clean up channels
      await cleanup();
      
      setStatus("disconnected");
      setRoomId(null);
      addSystemMessage("You have disconnected.");
    } catch (error) {
      console.error("Error ending chat:", error);
      toast({
        title: "Error",
        description: "Failed to end chat. Please try again.",
        variant: "destructive",
      });
    }
  }, [roomId, userId, addSystemMessage, cleanup]);

  return {
    status,
    messages,
    isTyping,
    startChat,
    sendMessage,
    sendTyping: sendTypingIndicator,
    nextChat,
    endChat
  };
}
