import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
	api: {
		sdlc: {
			state: vi.fn(),
			stop: vi.fn(),
			approveBaStream: vi.fn(),
			approveSaStream: vi.fn(),
			approveDevLeadStream: vi.fn(),
			restore: vi.fn(),
		},
	},
}));

import { useWorkspaceSdlc } from "@/hooks/useWorkspaceSdlc";
import { api, type SdlcEvent } from "@/lib/api";
import type { Session } from "@/lib/types";

const baseSession: Session = {
	id: "s-1",
	name: "Test Session",
	created_at: "2026-01-01T00:00:00Z",
	workflow_state: "running_ba",
	chat_history: [],
	agent_outputs: { requirement: "Build thing" },
	jira_backlog: [],
	metrics: { tokens: 0 },
};

function makeHarness(session = baseSession) {
	let currentSession: Session | null = session;
	const setSession = vi.fn(
		(updater: (prev: Session | null) => Session | null) => {
			currentSession = updater(currentSession);
		},
	);
	const print = vi.fn();
	const setBusy = vi.fn();

	const hook = renderHook(() =>
		useWorkspaceSdlc("s-1", {
			session: currentSession,
			setSession,
			print,
			setBusy,
		}),
	);

	return {
		...hook,
		setSession,
		print,
		setBusy,
		getSession: () => currentSession,
	};
}

async function* events(items: SdlcEvent[]) {
	for (const item of items) yield item;
}

describe("useWorkspaceSdlc", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		vi.mocked(api.sdlc.state).mockResolvedValue({
			workflow_state: "done",
			agent_outputs: { requirement: "Build thing", ba: "final BA" },
			jira_backlog: [{ title: "Epic", tasks: [] }],
		});
		vi.mocked(api.sdlc.stop).mockResolvedValue(undefined);
	});

	it("applies stream start, chunk, tool, agent_done, and done events", async () => {
		vi.useFakeTimers();
		const { result, setBusy, getSession } = makeHarness();

		let stopped = false;
		await act(async () => {
			const promise = result.current.runSdlcStream(
				events([
					{ t: "start", agent: "ba" },
					{ t: "c", text: "Hel" },
					{ t: "tool_call", server: "srv", tool: "search", args: { q: "x" } },
					{
						t: "tool_result",
						server: "srv",
						tool: "search",
						content: [{ type: "text", text: "ok" }],
						is_error: false,
					},
					{ t: "c", text: "lo" },
					{ t: "agent_done", agent: "ba" },
					{
						t: "done",
						state: "waiting_ba_approval",
						agent_outputs: { requirement: "Build thing", ba: "Hello" },
						jira_backlog: [],
					},
				]),
			);
			await vi.runAllTimersAsync();
			stopped = await promise;
		});

		expect(stopped).toBe(false);
		expect(setBusy).toHaveBeenNthCalledWith(1, true);
		expect(setBusy).toHaveBeenLastCalledWith(false);
		expect(getSession()?.workflow_state).toBe("waiting_ba_approval");
		expect(getSession()?.agent_outputs.ba).toBe("Hello");
		expect(result.current.sdlcState.editBA).toBe("Hello");
		expect(result.current.sdlcState.streamingAgent).toBeNull();
		expect(result.current.sdlcState.streamingText).toBe("");
		expect(result.current.sdlcState.toolCalls.ba[0]).toMatchObject({
			server: "srv",
			tool: "search",
			args: { q: "x" },
			result: { content: [{ type: "text", text: "ok" }], is_error: false },
		});
	});

	it("exposes streaming text while a stream is active", async () => {
		vi.useFakeTimers();
		let release!: () => void;
		async function* pendingStream(): AsyncGenerator<SdlcEvent> {
			yield { t: "start", agent: "ba" };
			yield { t: "c", text: "Live " };
			yield { t: "c", text: "BA" };
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		}

		const { result } = makeHarness();

		let streamPromise!: Promise<boolean>;
		await act(async () => {
			streamPromise = result.current.runSdlcStream(pendingStream());
			await Promise.resolve();
			await Promise.resolve();
			await vi.advanceTimersByTimeAsync(60);
		});

		expect(result.current.sdlcState.streamingAgent).toBe("ba");
		expect(result.current.sdlcState.streamingText).toBe("Live BA");

		release();
		await act(async () => {
			await streamPromise;
		});
	});

	it("aborts owned controller, cleans up generator, and ignores updates after unmount", async () => {
		const abortSpy = vi.spyOn(AbortController.prototype, "abort");
		let release!: () => void;
		let generatorReturned = false;
		async function* pendingStream(): AsyncGenerator<SdlcEvent> {
			try {
				yield { t: "start", agent: "ba" };
				await new Promise<void>((resolve) => {
					release = resolve;
				});
				yield { t: "c", text: "late" };
			} finally {
				generatorReturned = true;
			}
		}

		const { result, unmount, setBusy } = makeHarness();

		let streamPromise!: Promise<boolean>;
		await act(async () => {
			streamPromise = result.current.runSdlcStream(pendingStream());
			await Promise.resolve();
		});

		expect(result.current.sdlcState.streamingAgent).toBe("ba");

		await act(async () => {
			await result.current.abort();
		});

		expect(abortSpy).toHaveBeenCalled();
		expect(api.sdlc.stop).toHaveBeenCalledWith("s-1");

		unmount();
		release();
		await act(async () => {
			await streamPromise;
		});

		await waitFor(() => expect(generatorReturned).toBe(true));
		expect(setBusy).toHaveBeenLastCalledWith(false);
		abortSpy.mockRestore();
	});
});
