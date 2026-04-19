"use client";
import Link from "next/link";
import { Bell, Settings, Moon, Sun, Command } from "lucide-react";
import { useTheme } from "next-themes";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/chat", label: "AI Chat" },
  { href: "/sprint", label: "Sprint" },
  { href: "/review", label: "Review" },
  { href: "/security", label: "Security" },
];

export function DashboardHeader() {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center px-6 gap-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-yummy-500">
          <span className="text-xl">🍜</span>
          <span>Yummy</span>
        </Link>
        <nav className="flex items-center gap-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Command size={16} />
          </button>
          <button className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Bell size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
