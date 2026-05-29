import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceSdlcRouteContext } from "@/app/workspace/[sessionId]/sdlc-context";
import { WorkspaceSdlcRouteContextObj } from "@/app/workspace/[sessionId]/sdlc-context";
import type { Session } from "@/lib/types";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
	useParams: () => ({ sessionId: "test-sdlc-session" }),
	usePathname: () => "/workspace/test-sdlc-session/sdlc",
}));

const mockSession = {
	id: "test-sdlc-session",
	name: "Test Session",
	created_at: "2026-01-01T00:00:00Z",
	workflow_state: "idle",
	chat_history: [],
	agent_outputs: {},
	jira_backlog: [],
	metrics: { tokens: 0 },
} satisfies Session;

const sdlcContext: WorkspaceSdlcRouteContext = {
	session: mockSession,
	sdlcState: {
		workflowState: "idle",
		editBA: "",
		editSA: "",
		editDevLead: "",
		streamingAgent: null,
		streamingText: "",
		toolCalls: {},
	},
	busy: false,
	workflowRunning: false,
	runSdlcStream: vi.fn(),
	abort: vi.fn(),
	refreshSDLC: vi.fn(),
	approveBA: vi.fn(),
	approveSA: vi.fn(),
	approveDevLead: vi.fn(),
	restore: vi.fn(),
	setEditBA: vi.fn(),
	setEditSA: vi.fn(),
	setEditDevLead: vi.fn(),
};

vi.mock("@/components/workspace/SdlcPanel", () => ({
	default: () => <div data-testid="sdlc-panel-stub">SdlcPanel</div>,
}));

import SdlcPage from "@/app/workspace/[sessionId]/sdlc/page";

function renderSdlcPage(context: WorkspaceSdlcRouteContext = sdlcContext) {
	return render(
		<WorkspaceSdlcRouteContextObj.Provider value={context}>
			<SdlcPage />
		</WorkspaceSdlcRouteContextObj.Provider>,
	);
}

describe("SdlcPage", () => {
	it("renders sdlc-page wrapper", async () => {
		await act(async () => {
			renderSdlcPage();
		});
		expect(screen.getByTestId("sdlc-page")).toBeInTheDocument();
	});

	it("renders SdlcPanel component", async () => {
		await act(async () => {
			renderSdlcPage();
		});
		expect(screen.getByTestId("sdlc-panel-stub")).toBeInTheDocument();
	});
});
