"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/hooks/use-chat";

interface Props { messages: ChatMessage[]; isStreaming: boolean }

export function ChatMessages({ messages, isStreaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <div className="text-4xl">🍜</div>
          <p className="text-sm">Select an agent and start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map(msg => (
        <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          {msg.role === "assistant" && (
            <div className="w-8 h-8 rounded-full bg-yummy-500 flex items-center justify-center text-white text-xs flex-shrink-0">
              🍜
            </div>
          )}
          <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
            msg.role === "user"
              ? "bg-yummy-500 text-white"
              : "bg-muted text-foreground"
          }`}>
            {msg.role === "assistant" ? (
              <div className={`prose prose-sm dark:prose-invert max-w-none ${msg.isStreaming ? "streaming-cursor" : ""}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || " "}</ReactMarkdown>
              </div>
            ) : (
              <p>{msg.content}</p>
            )}
          </div>
          {msg.role === "user" && (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
              👤
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
