"use client";
import { DashboardHeader } from "@/components/layout/dashboard-header";
export default function SprintPage() {
  return (
    <div className="flex h-screen flex-col">
      <DashboardHeader />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-semibold mb-6">🔄 Sprint Board — yummy-scrum</h1>
        <div className="grid grid-cols-4 gap-4">
          {["Backlog","To Do","In Progress","Done"].map(col => (
            <div key={col} className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-medium text-sm mb-3">{col}</h3>
              <div className="space-y-2">
                <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                  AI-generated sprint cards appear here
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
