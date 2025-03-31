
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, RefreshCw, X } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import TypingIndicator from "@/components/TypingIndicator";
import { useChat, ChatStatus } from "@/hooks/useChat";

const ChatInterface = () => {
  const { status, messages, isTyping, startChat, sendMessage, sendTyping, nextChat, endChat } = useChat();
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);
  
  // Focus input when status changes to chatting
  useEffect(() => {
    if (status === "chatting") {
      inputRef.current?.focus();
    }
  }, [status]);
  
  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Send typing status to peer
    if (status === "chatting") {
      sendTyping(newValue.length > 0);
    }
  };
  
  const handleSendMessage = () => {
    if (inputValue.trim() && status === "chatting") {
      sendMessage(inputValue.trim());
      setInputValue("");
      sendTyping(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center">
          <div className="text-xl font-semibold">Whimsy</div>
          <div className="ml-4">
            {status === "idle" && <span className="text-muted-foreground">Not connected</span>}
            {status === "searching" && (
              <span className="flex items-center text-amber-500">
                <span className="mr-2">Searching</span>
                <RefreshCw className="w-4 h-4 animate-spin" />
              </span>
            )}
            {status === "chatting" && (
              <span className="flex items-center text-green-500">
                <span className="relative flex h-3 w-3 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Connected
              </span>
            )}
            {status === "disconnected" && <span className="text-destructive">Disconnected</span>}
          </div>
        </div>
        
        <div className="flex gap-2">
          {status === "idle" ? (
            <Button onClick={startChat}>Start Chatting</Button>
          ) : (
            <>
              <Button 
                variant="outline"
                size="sm"
                onClick={nextChat}
                className="flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New Chat
              </Button>
              
              {(status === "chatting" || status === "searching") && (
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={endChat}
                  className="flex items-center"
                >
                  <X className="w-4 h-4 mr-2" />
                  End Chat
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Messages container */}
      <div className="flex-grow overflow-y-auto p-4">
        {status === "idle" ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-4xl font-bold text-center bg-gradient-to-r from-whimsy-500 to-whimsy-700 bg-clip-text text-transparent pb-2">
              Welcome to Whimsy
            </div>
            <p className="text-muted-foreground mb-6 text-center max-w-md">
              Chat randomly with strangers from around the world.
              You never know who you'll meet!
            </p>
            <Button size="lg" onClick={startChat}>Start a Random Chat</Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isTyping && status === "chatting" && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              status === "chatting"
                ? "Type a message..."
                : status === "searching"
                ? "Searching for someone to chat with..."
                : "Start a chat to begin messaging"
            }
            disabled={status !== "chatting"}
            className="flex-grow"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={status !== "chatting" || !inputValue.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
