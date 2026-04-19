"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async () => {
    setLoading(true); setError("");
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    if (resp.ok) {
      const data = await resp.json();
      localStorage.setItem("yummy_token", data.access_token);
      router.push("/dashboard");
    } else {
      setError("Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="text-4xl mb-2">🍜</div>
          <h1 className="text-2xl font-bold">Yummy Platform</h1>
          <p className="text-sm text-muted-foreground">AI-Native Software Engineering</p>
        </div>
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600">{error}</div>}
        <div className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yummy-500" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            className="w-full rounded-lg border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yummy-500" />
          <button onClick={login} disabled={loading}
            className="w-full rounded-lg bg-yummy-500 text-white py-2.5 font-medium hover:bg-yummy-600 disabled:opacity-50 transition-colors">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
