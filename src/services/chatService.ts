
import { supabase } from "@/integrations/supabase/client";

export const chatService = {
  async findAvailableRoom(userId: string): Promise<string | null> {
    // Get all chat participants
    const { data: participants, error } = await supabase
      .from('chat_participants')
      .select('room_id, user_id');
      
    if (error || !participants) {
      console.error("Error fetching participants:", error);
      return null;
    }
    
    // Count participants per room (excluding the current user)
    const roomCounts: Record<string, string[]> = {};
    
    participants.forEach(p => {
      if (!p.room_id) return;
      
      if (!roomCounts[p.room_id]) {
        roomCounts[p.room_id] = [];
      }
      
      if (p.user_id !== userId) {
        roomCounts[p.room_id].push(p.user_id);
      }
    });
    
    // Find a room with exactly one participant
    for (const [roomId, users] of Object.entries(roomCounts)) {
      if (users.length === 1) {
        // Check if the current user is already in this room
        const isUserInRoom = participants.some(
          p => p.room_id === roomId && p.user_id === userId
        );
        
        if (!isUserInRoom) {
          return roomId; // Return the first room with exactly one participant
        }
      }
    }
    
    return null; // No available room found
  },
  
  async createNewRoom(): Promise<string | null> {
    const { data: newRoom, error } = await supabase
      .from('chat_rooms')
      .insert({})
      .select()
      .single();
      
    if (error) {
      console.error("Error creating new room:", error);
      return null;
    }
      
    return newRoom?.id || null;
  },
  
  async joinRoom(roomId: string, userId: string): Promise<boolean> {
    // Check if user is already in this room
    const { data: existingParticipant } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .maybeSingle();
    
    if (existingParticipant) {
      return true; // User is already in the room
    }
    
    const { error } = await supabase
      .from('chat_participants')
      .insert({
        room_id: roomId,
        user_id: userId
      });
      
    return !error;
  },
  
  async leaveRoom(roomId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('user_id', userId)
      .eq('room_id', roomId);
      
    return !error;
  },
  
  async sendMessage(roomId: string, userId: string, text: string, isSystem: boolean = false): Promise<boolean> {
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: isSystem ? 'system' : userId,
        message: text,
        is_system: isSystem
      });
      
    return !error;
  },

  async getRoomParticipantsCount(roomId: string): Promise<number> {
    const { data, error } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('room_id', roomId);
    
    if (error || !data) {
      console.error("Error counting room participants:", error);
      return 0;
    }
    
    return data.length;
  }
};
