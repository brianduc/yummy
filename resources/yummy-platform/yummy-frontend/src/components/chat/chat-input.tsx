"use client";
import { useState, KeyboardEvent } from "react";
import { Send, Paperclip, Code } from "lucide-react";
import { AgentType } from "@/hooks/use-chat";

interface Props {
  onSend: (msg: string) => void;
  disabled: boolean;
  agent: AgentType;
}

const PLACEHOLDER: Record<AgentType, string> = {
  po: "Describe a feature or business requirement...",
  ba: "Analyze requirements, draw diagrams...",
  scrum: "Ask about sprint, backlog, velocity...",
  code: "Write, fix, or refactor code...",
  review: "Paste code or a PR for review...",
  security: "Scan code or check vulnerabilities...",
  qa: "Generate tests, analyze coverage...",
  docs: "Generate documentation...",
  arch: "Analyze architecture and tech debt...",
};

export function ChatInput({ onSend, disabled, agent }: Props) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t p-4">
      <div className="flex items-end gap-2 rounded-xl border bg-background p-3 shadow-sm focus-within:ring-2 focus-within:ring-yummy-500">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={PLACEHOLDER[agent]}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50 max-h-48 min-h-[24px]"
          style={{ height: "auto" }}
        />
        <div className="flex gap-1">
          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <Paperclip size={16} />
          </button>
          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
            <Code size={16} />
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            className="p-1.5 rounded-md bg-yummy-500 text-white hover:bg-yummy-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">
        Press Enter to send · Shift+Enter for a new line
      </p>
    </div>
  );
}
