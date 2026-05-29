"use client";

import { Folder, Loader2 } from "lucide-react";
import type { FileNode } from "@/lib/types";
import { buildFileTree, TreeNode } from "./FileTree";

interface IdePanelProps {
	tree: FileNode[];
	ideFile: string;
	ideContent: string;
	ideLoading: boolean;
	onFileOpen: (path: string) => void;
}

export default function IdePanel({
	tree,
	ideFile,
	ideContent,
	ideLoading,
	onFileOpen,
}: IdePanelProps) {
	const fileTree = buildFileTree(tree);

	return (
		<div className="flex h-full min-h-0 overflow-hidden text-base">
			{/* File explorer sidebar */}
			<div
				className="border-r flex min-h-0 flex-col overflow-hidden"
				style={{
					width: "28%",
					minWidth: 220,
					borderColor: "var(--border)",
					background: "var(--bg)",
				}}
			>
				<div
					className="flex justify-between items-center border-b text-2xs uppercase tracking-widest px-3 py-2"
					style={{
						borderColor: "var(--border)",
						color: "var(--text-3)",
						background: "var(--bg-1)",
						letterSpacing: ".08em",
					}}
				>
					<span>FILE EXPLORER</span>
					<span
						className="rounded px-1.5 py-px"
						style={{ color: "var(--green)", background: "var(--green-mute)" }}
					>
						{tree.length}
					</span>
				</div>
				<div className="min-h-0 flex-1 overflow-auto pt-1">
					{!tree.length ? (
						<div
							className="flex flex-col items-center justify-center text-sm gap-2 text-center px-4"
							style={{ height: "70%", color: "var(--text-3)" }}
						>
							<Folder size={32} style={{ opacity: 0.15 }} />
							<p>
								Workspace empty.
								<br />
								Run /scan to index.
							</p>
						</div>
					) : (
						Object.values(fileTree.children)
							.sort((a, b) => (a.isDir === b.isDir ? 0 : a.isDir ? -1 : 1))
							.map((node) => (
								<TreeNode
									key={node.name}
									node={node}
									onFile={onFileOpen}
									selected={ideFile}
								/>
							))
					)}
				</div>
			</div>

			{/* Editor pane */}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
				<div
					className="border-b flex items-center pl-4 flex-shrink-0"
					style={{
						height: 38,
						background: "var(--bg)",
						borderColor: "var(--border)",
					}}
				>
					<span
						className="font-mono text-sm pt-1"
						style={{ color: "var(--text-2)", borderTop: "2px solid #ff79c6" }}
					>
						{ideFile ? ideFile.split("/").pop() : "Welcome"}
					</span>
				</div>
				<div className="flex min-h-0 flex-1 overflow-hidden">
					{/* Line numbers */}
					<div
						className="border-r p-4 pr-2 font-mono text-sm text-right overflow-hidden select-none leading-relaxed"
						style={{
							width: 44,
							background: "var(--bg)",
							borderColor: "var(--border)",
							color: "var(--text-3)",
						}}
					>
						{Array.from({ length: 120 }, (_, i) => i + 1).map((lineNumber) => (
							<div key={lineNumber}>{lineNumber}</div>
						))}
					</div>
					{/* Code content */}
					<div
						className="min-h-0 flex-1 overflow-auto whitespace-pre p-4 font-mono text-base leading-relaxed"
						style={{ color: "var(--text)" }}
					>
						{ideLoading ? (
							<span
								className="flex items-center gap-1.5"
								style={{ color: "var(--green)" }}
							>
								<Loader2 size={14} className="animate-spin" /> Loading source
								code...
							</span>
						) : ideContent ? (
							<code>{ideContent}</code>
						) : (
							<div
								className="flex flex-col items-center justify-center gap-2 opacity-20"
								style={{ height: "60%", color: "var(--text-3)" }}
							>
								<div className="text-5xl">⬡</div>
								<p>IDE Ready.</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
