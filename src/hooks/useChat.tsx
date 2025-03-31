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
  const participantChannelRef = useRef<any>(null);
  
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
      cleanupSubscriptions();
      cleanup();
    };
  }, [cleanup]);

  const cleanupSubscriptions = useCallback(async () => {
    // Clean up participant channel if exists
    if (participantChannelRef.current) {
      await supabase.removeChannel(participantChannelRef.current);
      participantChannelRef.current = null;
    }
  }, []);
  
  // Set up participant channel to listen for changes
  const setupParticipantListener = useCallback((newRoomId: string) => {
    // Clean up existing channel if any
    if (participantChannelRef.current) {
      supabase.removeChannel(participantChannelRef.current);
    }
    
    const channel = supabase
      .channel(`participants:${newRoomId}`)
      .on('postgres_changes', 
        { 
          event: '*', // Listen to all operations (INSERT, UPDATE, DELETE)
          schema: 'public', 
          table: 'chat_participants',
          filter: `room_id=eq.${newRoomId}`
        }, 
        async (payload) => {
          // Check participant count
          const count = await chatService.getRoomParticipantsCount(newRoomId);
          console.log("Participant count changed:", count, "Current status:", status);
          
          if (count >= 2 && (status === "searching" || status === "idle")) {
            console.log("Switching to chatting state");
            setStatus("chatting");
            addSystemMessage("You are now chatting with a stranger!");
          }
        }
      )
      .subscribe((status) => {
        console.log("Participant channel status:", status);
      });
      
    participantChannelRef.current = channel;
  }, [status, addSystemMessage]);

  // Additionally listen for direct room events
  useEffect(() => {
    if (!roomId) return;
    
    // Poll periodically to check for participant count
    const intervalId = setInterval(async () => {
      if (roomId && status === "searching") {
        const count = await chatService.getRoomParticipantsCount(roomId);
        if (count >= 2) {
          setStatus("chatting");
          addSystemMessage("You are now chatting with a stranger!");
          clearInterval(intervalId);
        }
      }
    }, 2000); // Check every 2 seconds
    
    return () => {
      clearInterval(intervalId);
    };
  }, [roomId, status, addSystemMessage]);
  
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
        
        // Update status to chatting immediately since we know there's already someone in the room
        setStatus("chatting");
        addSystemMessage("You are now chatting with a stranger!");
          
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
        // Keep status as searching since we're waiting for someone to join
        setStatus("searching");
      }
      
      if (newRoomId) {
        setRoomId(newRoomId);
        setupRoomListeners(newRoomId);
        setupParticipantListener(newRoomId);
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
  }, [userId, addSystemMessage, setupRoomListeners, clearMessages, setupParticipantListener]);
  
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
    await cleanupSubscriptions();
    await cleanup();
    
    setRoomId(null);
    startChat();
  }, [roomId, userId, startChat, cleanup, cleanupSubscriptions]);
  
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
      await cleanupSubscriptions();
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
  }, [roomId, userId, addSystemMessage, cleanup, cleanupSubscriptions]);

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
