
import { supabase } from "@/integrations/supabase/client";

export const chatService = {
  async findAvailableRoom(userId: string): Promise<string | null> {
    // Find rooms with exactly one participant
    const { data: participants } = await supabase
      .from('chat_participants')
      .select('room_id, user_id')
      .neq('user_id', userId);
      
    // Count participants per room and find rooms with exactly one participant
    const roomCounts: Record<string, number> = {};
    participants?.forEach(p => {
      if (p.room_id) {
        roomCounts[p.room_id] = (roomCounts[p.room_id] || 0) + 1;
      }
    });
    
    // Find the first room with exactly 1 participant
    return Object.keys(roomCounts).find(id => roomCounts[id] === 1) || null;
  },
  
  async createNewRoom(): Promise<string | null> {
    const { data: newRoom } = await supabase
      .from('chat_rooms')
      .insert({})
      .select()
      .single();
      
    return newRoom?.id || null;
  },
  
  async joinRoom(roomId: string, userId: string): Promise<boolean> {
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
  }
};
