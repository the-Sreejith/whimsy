
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";

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
  const [userId, setUserId] = useState<string>(uuidv4());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  
  // Set up listeners for room changes
  const setupRoomListeners = useCallback(async (roomId: string) => {
    // Clean up any existing channel subscription
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }
    
    // Subscribe to chat messages
    channelRef.current = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        }, 
        (payload) => {
          if (payload.new && payload.new.sender_id !== userId) {
            addMessage(payload.new.message, "stranger");
            setIsTyping(false);
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
          }
        }
      )
      .subscribe();
      
    // Set up presence channel for typing indicators
    if (presenceChannelRef.current) {
      await supabase.removeChannel(presenceChannelRef.current);
    }
    
    presenceChannelRef.current = supabase
      .channel(`presence:${roomId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannelRef.current?.presenceState() || {};
        const strangersState = Object.values(state).flat().filter((p: any) => 
          p.user_id !== userId && p.room_id === roomId
        );
        
        const someoneTyping = strangersState.some((p: any) => p.isTyping);
        setIsTyping(someoneTyping);
      })
      .subscribe();
  }, [userId]);
  
  // Clean up channels on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
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
  
  // Find a chat partner
  const startChat = useCallback(async () => {
    setStatus("searching");
    setMessages([]);
    addSystemMessage("Looking for someone to chat with...");
    
    try {
      // Check for any available room with one participant
      const { data: rooms } = await supabase
        .from('chat_participants')
        .select('room_id, count(*)')
        .neq('user_id', userId)
        .group('room_id')
        .having('count(*) = 1')
        .limit(1);
      
      let newRoomId;
      
      if (rooms && rooms.length > 0) {
        // Join existing room
        newRoomId = rooms[0].room_id;
        
        await supabase
          .from('chat_participants')
          .insert({
            room_id: newRoomId,
            user_id: userId
          });
        
        // Add system message in the database
        await supabase
          .from('chat_messages')
          .insert({
            room_id: newRoomId,
            sender_id: 'system',
            message: 'A stranger has joined the chat.',
            is_system: true
          });
          
      } else {
        // Create a new room
        const { data: newRoom } = await supabase
          .from('chat_rooms')
          .insert({})
          .select()
          .single();
          
        if (newRoom) {
          newRoomId = newRoom.id;
          
          // Add user to room
          await supabase
            .from('chat_participants')
            .insert({
              room_id: newRoomId,
              user_id: userId
            });
            
          addSystemMessage("Waiting for someone to join...");
          setStatus("searching");
        }
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
  }, [userId, addSystemMessage, setupRoomListeners]);
  
  // Send a message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !roomId) return;
    
    try {
      // Add message locally immediately for UI responsiveness
      addMessage(text, "me");
      
      // Send to database
      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          message: text
        });
      
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  }, [roomId, userId, addMessage]);
  
  // Send typing indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (!roomId || !presenceChannelRef.current) return;
    
    presenceChannelRef.current.track({
      user_id: userId,
      room_id: roomId,
      isTyping
    });
  }, [roomId, userId]);
  
  // Find new chat partner
  const nextChat = useCallback(async () => {
    if (roomId) {
      // Leave current room
      try {
        await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            sender_id: 'system',
            message: 'Stranger has disconnected.',
            is_system: true
          });
          
        await supabase
          .from('chat_participants')
          .delete()
          .eq('user_id', userId)
          .eq('room_id', roomId);
      } catch (error) {
        console.error("Error leaving chat:", error);
      }
    }
    
    // Clean up channels
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (presenceChannelRef.current) {
      await supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
    
    setRoomId(null);
    startChat();
  }, [roomId, userId, startChat]);
  
  // End chat
  const endChat = useCallback(async () => {
    if (!roomId) return;
    
    try {
      // Add system message about disconnection
      await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: 'system',
          message: 'Stranger has disconnected.',
          is_system: true
        });
        
      // Remove participant from room
      await supabase
        .from('chat_participants')
        .delete()
        .eq('user_id', userId)
        .eq('room_id', roomId);
      
      // Clean up channels
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (presenceChannelRef.current) {
        await supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      
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
  }, [roomId, userId, addSystemMessage]);

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
