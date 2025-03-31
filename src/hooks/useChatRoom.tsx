
import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export const useChatRoom = (userId: string, roomId: string | null, onMessageReceived: (message: string, sender: "stranger") => void, onTypingChange: (isTyping: boolean) => void) => {
  const channelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  
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
            onMessageReceived(payload.new.message, "stranger");
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
        onTypingChange(someoneTyping);
      })
      .subscribe();
  }, [userId, onMessageReceived, onTypingChange]);

  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    if (presenceChannelRef.current) {
      await supabase.removeChannel(presenceChannelRef.current);
      presenceChannelRef.current = null;
    }
  }, []);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (!roomId || !presenceChannelRef.current) return;
    
    presenceChannelRef.current.track({
      user_id: userId,
      room_id: roomId,
      isTyping
    });
  }, [roomId, userId]);

  return {
    setupRoomListeners,
    cleanup,
    sendTypingIndicator
  };
};
