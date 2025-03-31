
export interface Message {
  id: string;
  text: string;
  sender: "me" | "stranger";
  timestamp: number;
  system?: boolean;
}

export type ChatStatus = "idle" | "searching" | "chatting" | "disconnected";
