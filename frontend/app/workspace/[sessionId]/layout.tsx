"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import DeleteSessionModal, {
	DeleteSessionContext,
} from "@/components/workspace/DeleteSessionModal";
import WorkspaceLayout from "@/components/workspace/WorkspaceLayout";
import {
	useWorkspaceChat,
	WorkspaceChatProvider,
} from "@/hooks/useWorkspaceChat";
import { useWorkspaceSdlc } from "@/hooks/useWorkspaceSdlc";
import { useWorkspaceSession } from "@/hooks/useWorkspaceSession";
import { useWorkspaceStatus } from "@/hooks/useWorkspaceStatus";
import { useWorkspaceUi } from "@/hooks/useWorkspaceUi";
import { api } from "@/lib/api";
import type { Session } from "@/lib/types";
import { FileOpenContext } from "./file-open-context";
import { WorkspaceSdlcRouteContextObj } from "./sdlc-context";

export default function WorkspaceRouteLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ sessionId: string }>;
}) {
	const { sessionId } = React.use(params);
	const router = useRouter();
	const abortRef = useRef(new AbortController());

	const [ideFile, setIdeFile] = useState("");
	const [ideContent, setIdeContent] = useState("");
	const [ideLoading, setIdeLoading] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

	const sessionCtx = useWorkspaceSession(sessionId);
	const statusCtx = useWorkspaceStatus();
	const uiCtx = useWorkspaceUi();

	const [session, setSession] = useState<Session | null>(null);
	useEffect(() => {
		setSession(sessionCtx.session);
	}, [sessionCtx.session]);

	const sdlcCtx = useWorkspaceSdlc(sessionId, { session, setSession });

	const { setCommandPaletteOpen } = uiCtx;
	const handleOpenCommandPalette = useCallback(() => {
		setCommandPaletteOpen(true);
	}, [setCommandPaletteOpen]);

	const handleFileOpen = useCallback(
		async (path: string) => {
			if (!path) return;

			setIdeFile(path);
			setIdeLoading(true);
			setIdeContent("");

			try {
				const res = (await api.kb.file(path)) as { content?: string };
				setIdeContent(res.content || "// (empty)");
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				setIdeContent(`// [ERROR LOADING FILE]: ${message}`);
			} finally {
				setIdeLoading(false);
			}

			router.push(`/workspace/${sessionId}/explorer`);
		},
		[router, sessionId],
	);

	const navigateWorkspaceRoute = useCallback(
		(route: string) => {
			const suffix = route ? `/${route}` : "";
			router.push(`/workspace/${sessionId}${suffix}`);
		},
		[router, sessionId],
	);

	const handleDeleteSession = useCallback(async () => {
		if (!deleteTarget) return;
		const targetId = deleteTarget.id;
		setDeleteTarget(null);
		try {
			await sessionCtx.deleteSession(targetId);
			await sessionCtx.fetchSessions();
		} catch (e) {
			console.error("Failed to delete session:", e);
		}
	}, [deleteTarget, sessionCtx]);

	const chatCtx = useWorkspaceChat(sessionId, abortRef, {
		status: statusCtx.status,
		session,
		fetchStatus: statusCtx.fetchStatus,
		fetchMetrics: sessionCtx.fetchMetrics,
		startScanPoll: statusCtx.startScanPoll,
		setScanStatus: statusCtx.setScanStatus,
		setActiveTab: navigateWorkspaceRoute,
		setActiveActivity: navigateWorkspaceRoute,
		setSession,
		runSdlcStream: sdlcCtx.runSdlcStream,
		handleStop: sdlcCtx.abort,
	});

	return (
		<WorkspaceChatProvider value={chatCtx}>
			<div data-testid="workspace-layout">
				<nav data-testid="workspace-nav" aria-label="workspace navigation" />
				<WorkspaceLayout
					sessionName={session?.name ?? sessionId}
					session={session}
					workflowState={sdlcCtx.sdlcState.workflowState}
					streamingAgent={sdlcCtx.sdlcState.streamingAgent}
					isSDLCDone={session?.workflow_state === "done"}
					fileTree={statusCtx.kb?.tree ?? []}
					onFileOpen={handleFileOpen}
					status={statusCtx.status}
					metrics={sessionCtx.metrics}
					scanStatus={statusCtx.scanStatus}
					workflowRunning={sdlcCtx.workflowRunning}
					onOpenCommandPalette={handleOpenCommandPalette}
					onApproveBA={sdlcCtx.approveBA}
					onApproveSA={sdlcCtx.approveSA}
					onApproveDevLead={sdlcCtx.approveDevLead}
					onStop={sdlcCtx.abort}
					mainStageChildren={
						<FileOpenContext.Provider
							value={{ ideFile, ideContent, ideLoading }}
						>
							<WorkspaceSdlcRouteContextObj.Provider
								value={{ ...sdlcCtx, session }}
							>
								<DeleteSessionContext.Provider value={setDeleteTarget}>
									<main data-testid="workspace-main-slot">{children}</main>
								</DeleteSessionContext.Provider>
							</WorkspaceSdlcRouteContextObj.Provider>
						</FileOpenContext.Provider>
					}
				/>
				{deleteTarget && (
					<DeleteSessionModal
						session={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onConfirm={handleDeleteSession}
					/>
				)}
			</div>
		</WorkspaceChatProvider>
	);
}
