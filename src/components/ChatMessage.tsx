import { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ChatMessageProps {
  message: Message & { system?: boolean };
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const timestamp = format(new Date(message.timestamp), "HH:mm");
  
  if (message.system) {
    return (
      <div className="flex justify-center my-2 animate-fade-in">
        <div className="px-4 py-2 text-sm text-center text-muted-foreground bg-muted/50 rounded-md">
          {message.text}
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn(
      "flex mb-3 animate-slide-in",
      message.sender === "me" ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[75%] px-4 py-2 rounded-2xl break-words",
        message.sender === "me" 
          ? "bg-primary text-primary-foreground rounded-tr-none" 
          : "bg-secondary text-secondary-foreground rounded-tl-none"
      )}>
        <div>{message.text}</div>
        <div className={cn(
          "text-[10px] mt-1 text-right",
          message.sender === "me" ? "text-primary-foreground/70" : "text-muted-foreground"
        )}>
          {timestamp}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
