"use client";
import { useState, useCallback } from "react";

export type AgentType = "po" | "ba" | "scrum" | "review" | "security" | "qa" | "docs" | "code" | "arch";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: AgentType;
  timestamp: Date;
  isStreaming?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<AgentType>("po");
  const [sessions] = useState([]);

  const sendMessage = useCallback(async (content: string, context: Record<string, unknown> = {}) => {
    if (!content.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      agent: currentAgent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      agent: currentAgent,
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreaming(true);

    try {
      const token = localStorage.getItem("yummy_token") || "";
      const resp = await fetch(`${API_URL}/api/v1/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ agent: currentAgent, message: content, context }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + data.chunk }
                    : m
                ));
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
      ));
    }
  }, [currentAgent, isStreaming]);

  return { messages, sendMessage, isStreaming, currentAgent, setCurrentAgent, sessions };
}
