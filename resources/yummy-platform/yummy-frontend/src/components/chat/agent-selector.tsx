"use client";
import { AgentType } from "@/hooks/use-chat";

const AGENTS: { value: AgentType; label: string; icon: string; desc: string }[] = [
  { value: "po",       label: "yummy-po",       icon: "🎯", desc: "Product Owner" },
  { value: "ba",       label: "yummy-ba",       icon: "📋", desc: "Business Analyst" },
  { value: "scrum",    label: "yummy-scrum",    icon: "🔄", desc: "Scrum Master" },
  { value: "code",     label: "yummy-code",     icon: "⌨️", desc: "Code Agent" },
  { value: "review",   label: "yummy-review",   icon: "🔍", desc: "Code Review" },
  { value: "security", label: "yummy-guard",    icon: "🛡️", desc: "Security" },
  { value: "qa",       label: "yummy-qa",       icon: "🧪", desc: "QA Testing" },
  { value: "docs",     label: "yummy-docs",     icon: "📝", desc: "Documentation" },
  { value: "arch",     label: "yummy-arch",     icon: "🏗️", desc: "Architecture" },
];

interface Props {
  value: AgentType;
  onChange: (v: AgentType) => void;
}

export function AgentSelector({ value, onChange }: Props) {
  const current = AGENTS.find(a => a.value === value);
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value as AgentType)}
        className="flex h-8 items-center rounded-md border bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-yummy-500"
      >
        {AGENTS.map(a => (
          <option key={a.value} value={a.value}>
            {a.icon} {a.label} — {a.desc}
          </option>
        ))}
      </select>
    </div>
  );
}
