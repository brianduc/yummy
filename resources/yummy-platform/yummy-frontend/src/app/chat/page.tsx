"use client";
import { useState, useRef, useEffect } from "react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatInput } from "@/components/chat/chat-input";
import { AgentSelector } from "@/components/chat/agent-selector";
import { useChat } from "@/hooks/use-chat";

export default function ChatPage() {
  const { messages, sendMessage, isStreaming, currentAgent, setCurrentAgent, sessions } = useChat();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar — sessions list */}
      <ChatSidebar sessions={sessions} />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Agent selector bar */}
        <div className="border-b px-4 py-2 flex items-center gap-3">
          <AgentSelector value={currentAgent} onChange={setCurrentAgent} />
          <span className="text-xs text-muted-foreground">
            {isStreaming ? "Generating..." : "Ready"}
          </span>
        </div>

        {/* Messages */}
        <ChatMessages messages={messages} isStreaming={isStreaming} />

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isStreaming} agent={currentAgent} />
      </div>
    </div>
  );
}
