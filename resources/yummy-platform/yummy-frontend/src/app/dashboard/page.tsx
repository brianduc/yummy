import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { AgentCards } from "@/components/agents/agent-cards";
import { SprintWidget } from "@/components/sprint/sprint-widget";
import { MetricsRow } from "@/components/charts/metrics-row";
import { RecentActivity } from "@/components/layout/recent-activity";

export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <DashboardHeader />
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            🍜 Yummy Platform Dashboard
          </h1>
          <Suspense fallback={<div>Loading metrics...</div>}>
            <MetricsRow />
          </Suspense>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AgentCards />
            </div>
            <SprintWidget />
          </div>
          <RecentActivity />
        </div>
      </main>
    </div>
  );
}
