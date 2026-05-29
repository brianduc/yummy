"use client";

import SdlcPanel from "@/components/workspace/SdlcPanel";
import { useWorkspaceSdlcRoute } from "../sdlc-context";

export default function SdlcPage() {
	const sdlcCtx = useWorkspaceSdlcRoute();
	const { session } = sdlcCtx;

	if (!session) return null;

	return (
		<div data-testid="sdlc-page" className="h-full">
			<SdlcPanel
				session={session}
				editBA={sdlcCtx.sdlcState.editBA}
				editSA={sdlcCtx.sdlcState.editSA}
				editDevLead={sdlcCtx.sdlcState.editDevLead}
				busy={sdlcCtx.busy}
				workflowRunning={sdlcCtx.workflowRunning}
				streamingAgent={sdlcCtx.sdlcState.streamingAgent}
				streamingText={sdlcCtx.sdlcState.streamingText}
				toolCalls={sdlcCtx.sdlcState.toolCalls}
				onEditBA={sdlcCtx.setEditBA}
				onEditSA={sdlcCtx.setEditSA}
				onEditDevLead={sdlcCtx.setEditDevLead}
				onApproveBA={sdlcCtx.approveBA}
				onApproveSA={sdlcCtx.approveSA}
				onApproveDevLead={sdlcCtx.approveDevLead}
				onStop={sdlcCtx.abort}
				onRestore={sdlcCtx.restore}
			/>
		</div>
	);
}
