import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
	api: {
		sdlc: {
			startStream: vi.fn(async function* () {}),
		},
	},
}));

import { useWorkspaceChat } from "@/hooks/useWorkspaceChat";
import { api } from "@/lib/api";
import type { Session, SystemStatus } from "@/lib/types";

const status: SystemStatus = {
	repo: { owner: "yummy", repo: "repo" },
	ai_provider: "gemini",
	has_gemini_key: true,
	gemini_key_source: "env",
	has_github_token: false,
	copilot_key_source: "none",
	openai_key_source: "none",
	bedrock_key_source: "none",
	kb_files: 1,
	kb_insights: 1,
	kb_has_summary: true,
	total_sessions: 1,
	scan_status: null,
	total_requests: 0,
	total_cost_usd: 0,
};

const session: Session = {
	id: "s-1",
	name: "Test Session",
	created_at: "2026-01-01T00:00:00Z",
	workflow_state: "idle",
	chat_history: [],
	agent_outputs: {},
	jira_backlog: [],
	metrics: { tokens: 0 },
};

describe("/cr workspace chat command", () => {
	it("routes to SDLC and starts the SDLC stream", async () => {
		const abortRef = { current: new AbortController() };
		const setActiveTab = vi.fn();
		const setSession = vi.fn();
		const runSdlcStream = vi.fn().mockResolvedValue(false);

		const { result } = renderHook(() =>
			useWorkspaceChat("s-1", abortRef, {
				status,
				session,
				setActiveTab,
				setSession,
				runSdlcStream,
			}),
		);

		await act(async () => {
			await result.current.handleCmd("/cr Add PDF export");
		});

		expect(setActiveTab).toHaveBeenCalledWith("sdlc");
		expect(api.sdlc.startStream).toHaveBeenCalledWith("s-1", "Add PDF export");
		expect(runSdlcStream).toHaveBeenCalledTimes(1);
		expect(setSession).toHaveBeenCalledTimes(1);
	});
});
