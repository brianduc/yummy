"use client";
import { useState } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
export default function ReviewPage() {
  const [code, setCode] = useState("");
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);

  const runReview = async () => {
    if (!code.trim()) return;
    setLoading(true); setReview("");
    const token = localStorage.getItem("yummy_token") || "";
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ agent: "review", message: "Review this code", context: { code, language: "typescript" } }),
    });
    const reader = resp.body?.getReader();
    const dec = new TextDecoder();
    if (!reader) return;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = dec.decode(value);
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try { const d = JSON.parse(line.slice(6)); if (d.chunk) setReview(p => p + d.chunk); } catch {}
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6 grid grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">🔍 Code Input</h2>
          <textarea className="flex-1 rounded-lg border bg-background p-4 font-mono text-sm resize-none"
            placeholder="Paste code here..." value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={runReview} disabled={loading}
            className="rounded-lg bg-yummy-500 text-white px-4 py-2 font-medium hover:bg-yummy-600 disabled:opacity-50">
            {loading ? "Reviewing..." : "🔍 Review Code"}
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">🤖 AI Review Result</h2>
          <div className="flex-1 rounded-lg border bg-background p-4 text-sm overflow-auto whitespace-pre-wrap font-mono">
            {review || <span className="text-muted-foreground">Review will appear here...</span>}
          </div>
        </div>
      </main>
    </div>
  );
}
