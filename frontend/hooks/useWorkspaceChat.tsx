import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { api, type SdlcEvent } from "@/lib/api";
import type {
	ChatMessage,
	ScanStatus,
	Session,
	SystemStatus,
} from "@/lib/types";
import type {
	TerminalLogEntry,
	WorkspaceChatContext,
} from "./useWorkspaceContracts";

type AbortControllerRef = { current: AbortController };
type Provider = "gemini" | "openai" | "bedrock" | "copilot" | "ollama";
type HealthModelResult = {
	status: "ok" | "error";
	provider: string;
	model: string;
	latency_ms?: number;
	error?: string;
};

const VALID_PROVIDERS = [
	"gemini",
	"openai",
	"ollama",
	"copilot",
	"bedrock",
] as const;

function getErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function isProvider(provider: string): provider is Provider {
	return VALID_PROVIDERS.some((validProvider) => validProvider === provider);
}

export interface UseWorkspaceChatOptions {
	status?: SystemStatus | null;
	session?: Session | null;
	fetchStatus?: () => Promise<void>;
	fetchMetrics?: () => Promise<void>;
	startScanPoll?: () => void;
	setScanStatus?: (status: ScanStatus | null) => void;
	setActiveTab?: (tab: string) => void;
	setActiveActivity?: (act: string) => void;
	setSession?: (fn: (prev: Session | null) => Session | null) => void;
	runSdlcStream?: (gen: AsyncGenerator<SdlcEvent>) => Promise<boolean>;
	handleStop?: () => Promise<void>;
	ideFile?: string | null;
	ideContent?: string | null;
}

export function useWorkspaceChat(
	sessionId: string,
	abortRef: AbortControllerRef,
	opts: UseWorkspaceChatOptions = {},
): WorkspaceChatContext {
	const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
	const [termLogs, setTermLogs] = useState<TerminalLogEntry[]>([]);
	const [busy, setBusy] = useState(false);
	const [btwBusy, setBtwBusy] = useState(false);
	const termRef = useRef<HTMLDivElement | null>(null);

	const print = useCallback((text: string, role = "system") => {
		setTermLogs((prev) => [...prev, { role, text }]);
	}, []);

	const sendAsk = useCallback(
		async (question: string, free = false) => {
			setChatHistory((prev) => [...prev, { role: "user", text: question }]);
			setChatHistory((prev) => [...prev, { role: "assistant", text: "" }]);
			setBusy(true);
			if (opts.setActiveTab) opts.setActiveTab("rag");

			let accumulated = "";
			let lastFlushed = "";
			let flushTimer: ReturnType<typeof setTimeout> | null = null;

			const flushAssistant = (force = false) => {
				if (!force && accumulated === lastFlushed) return;
				lastFlushed = accumulated;
				setChatHistory((prev) => {
					const next = [...prev];
					if (next[next.length - 1].role === "assistant")
						next[next.length - 1] = { role: "assistant", text: accumulated };
					return next;
				});
			};

			const scheduleFlush = () => {
				if (flushTimer) return;
				flushTimer = setTimeout(() => {
					flushTimer = null;
					flushAssistant();
				}, 60);
			};

			try {
				for await (const chunk of api.askStream(
					sessionId,
					question,
					opts.ideFile || undefined,
					opts.ideContent ? opts.ideContent.slice(0, 3000) : undefined,
					free,
				)) {
					if (chunk === "[DONE]") break;
					if (chunk.startsWith("[ERROR]")) {
						setChatHistory((prev) => {
							const next = [...prev];
							next[next.length - 1] = {
								role: "system",
								text: `❌ ${chunk.slice(8)}`,
							};
							return next;
						});
						return;
					}
					if (chunk.startsWith("[TRACE] ")) {
						try {
							const trace = JSON.parse(chunk.slice(8));
							setChatHistory((prev) => {
								const next = [...prev];
								const last = next[next.length - 1];
								next[next.length - 1] = { ...last, trace };
								return next;
							});
						} catch {}
						continue;
					}
					accumulated += chunk;
					scheduleFlush();
				}
			} catch (e) {
				setChatHistory((prev) => {
					const next = [...prev];
					next[next.length - 1] = {
						role: "system",
						text: `❌ ${getErrorMessage(e)}`,
					};
					return next;
				});
			} finally {
				if (flushTimer) clearTimeout(flushTimer);
				flushAssistant(true);
				setBusy(false);
			}
		},
		[sessionId, opts],
	);

	const sendBtw = useCallback(
		async (question: string) => {
			setChatHistory((prev) => [...prev, { role: "user", text: question }]);
			setChatHistory((prev) => [...prev, { role: "assistant", text: "" }]);
			setBtwBusy(true);

			let accumulated = "";
			let lastFlushed = "";
			let flushTimer: ReturnType<typeof setTimeout> | null = null;

			const flushAssistant = (force = false) => {
				if (!force && accumulated === lastFlushed) return;
				lastFlushed = accumulated;
				setChatHistory((prev) => {
					const next = [...prev];
					if (next[next.length - 1].role === "assistant")
						next[next.length - 1] = { role: "assistant", text: accumulated };
					return next;
				});
			};

			const scheduleFlush = () => {
				if (flushTimer) return;
				flushTimer = setTimeout(() => {
					flushTimer = null;
					flushAssistant();
				}, 60);
			};

			try {
				for await (const chunk of api.askStream(
					sessionId,
					question,
					undefined,
					undefined,
					true,
				)) {
					if (chunk === "[DONE]") break;
					if (chunk.startsWith("[ERROR]")) {
						setChatHistory((prev) => {
							const next = [...prev];
							next[next.length - 1] = {
								role: "system",
								text: `❌ ${chunk.slice(8)}`,
							};
							return next;
						});
						return;
					}
					accumulated += chunk;
					scheduleFlush();
				}
			} catch (e) {
				setChatHistory((prev) => {
					const next = [...prev];
					next[next.length - 1] = {
						role: "system",
						text: `❌ ${getErrorMessage(e)}`,
					};
					return next;
				});
			} finally {
				if (flushTimer) clearTimeout(flushTimer);
				flushAssistant(true);
				setBtwBusy(false);
			}
		},
		[sessionId],
	);

	const handleCmd = useCallback(
		async (rawInput: string) => {
			const raw = rawInput.trim();
			if (!raw) return;
			const args = raw.split(" ");
			const command = args[0].toLowerCase();

			if (busy && command !== "/btw" && command !== "/stop") {
				if (opts.session?.workflow_state?.includes("running")) {
					print(
						"⟳ Pipeline is running — use /btw <question> to chat, or /stop to abort.",
					);
				}
				return;
			}

			print(`> ${raw}`, "user");

			try {
				switch (command) {
					case "/help":
						print(
							"Available commands:\n" +
								"  /setup <url> [token]     — Configure GitHub repo\n" +
								"  /scan                    — Scan & index codebase\n" +
								"  /ask <question>          — RAG chat with AI (requires scan)\n" +
								"  /btw <question>          — Chat with AI freely (no scan needed)\n" +
								"  /cr <requirement>        — Start SDLC brainstorm\n" +
								"  /tool <srv>.<tool> [args]  — Invoke MCP tool\n" +
								"  /stop                    — Stop running SDLC pipeline\n" +
								"  /provider                — Show current AI provider\n" +
								"  /provider <name>         — Switch provider (gemini/openai/ollama/copilot/bedrock)\n" +
								"  /provider <name> <key>   — Switch provider and set API key in one step\n" +
								"  /new                     — Create new workspace\n" +
								"  /healthcheck             — Ping AI model connection\n" +
								"  /info                    — Show system info",
						);
						break;
					case "/setup": {
						const url = args[1];
						if (!url)
							throw new Error(
								"GitHub URL required. Example: /setup https://github.com/owner/repo",
							);
						await api.config.setup(url, args[2] || "", 10000);
						if (opts.fetchStatus) await opts.fetchStatus();
						print(`✅ Repo configured: ${url}`);
						break;
					}
					case "/scan": {
						if (!opts.status?.repo)
							throw new Error("No repo configured. Run /setup first.");
						setBusy(true);
						try {
							await api.kb.scan();
						} catch (e) {
							setBusy(false);
							throw e;
						}
						if (opts.setScanStatus)
							opts.setScanStatus({
								running: true,
								text: "Starting scan...",
								progress: 0,
							});
						print("🔍 Starting codebase scan...");
						if (opts.setActiveTab) opts.setActiveTab("explorer");
						if (opts.startScanPoll) opts.startScanPoll();
						setBusy(false);
						break;
					}
					case "/ask": {
						const q = args.slice(1).join(" ");
						if (!q)
							throw new Error(
								"Question required. Example: /ask Explain the auth flow?",
							);
						if (!opts.status?.kb_has_summary)
							throw new Error("KB not scanned yet. Run /scan first.");
						await sendAsk(q);
						break;
					}
					case "/btw": {
						const q = args.slice(1).join(" ");
						if (!q)
							throw new Error(
								"Question required. Example: /btw What is a JWT token?",
							);
						if (busy) await sendBtw(q);
						else await sendAsk(q, true);
						break;
					}
					case "/cr": {
						const req = args.slice(1).join(" ");
						if (!req)
							throw new Error(
								"Requirement required. Example: /cr Add PDF export module",
							);
						if (!opts.status?.kb_has_summary)
							throw new Error("KB not scanned yet. Run /scan first.");
						if (opts.setActiveTab) opts.setActiveTab("sdlc");
						else if (opts.setActiveActivity) opts.setActiveActivity("sdlc");
						if (opts.fetchMetrics) await opts.fetchMetrics();
						if (opts.setSession) {
							opts.setSession((prev) =>
								prev
									? {
											...prev,
											workflow_state: "running_ba",
											agent_outputs: {
												...prev.agent_outputs,
												requirement: req,
											},
										}
									: prev,
							);
						}
						print("[BA] Analyzing requirement...");
						if (opts.runSdlcStream) {
							const stopped = await opts.runSdlcStream(
								api.sdlc.startStream(sessionId, req),
							);
							if (!stopped) print("⚠️ BA done. Waiting for approval...");
						}
						break;
					}
					case "/stop": {
						if (!opts.session?.workflow_state?.includes("running")) {
							throw new Error("No pipeline is running.");
						}
						print("⏹ Stopping pipeline...");
						if (opts.handleStop) await opts.handleStop();
						break;
					}
					case "/provider": {
						const providerArg = args[1]?.toLowerCase();
						const keyArg = args.slice(2).join(" ");

						if (!providerArg) {
							print(
								`Current provider: ${opts.status?.ai_provider ?? "—"}\n` +
									`Available: ${VALID_PROVIDERS.join(" · ")}\n\n` +
									`Usage:\n` +
									`  /provider gemini AIza...     — set key + activate\n` +
									`  /provider openai sk-...      — set key + activate\n` +
									`  /provider ollama             — activate (no key needed)\n` +
									`  /provider copilot ghp_...    — set token + activate\n` +
									`  /provider bedrock            — activate (set creds in ⚙ Settings)`,
							);
							break;
						}

						if (!isProvider(providerArg)) {
							throw new Error(
								`Unknown provider "${providerArg}". Valid: ${VALID_PROVIDERS.join(", ")}`,
							);
						}

						setBusy(true);
						try {
							if (keyArg) {
								if (providerArg === "gemini")
									await api.config.setGeminiKey(keyArg);
								else if (providerArg === "openai")
									await api.config.setOpenAI(keyArg);
								else if (providerArg === "copilot")
									await api.config.setCopilot(keyArg);
								else
									print(
										`ℹ Bedrock/Ollama credentials can't be set via command — use ⚙ Settings.`,
									);
							}
							await api.config.setProvider(providerArg);
							if (opts.fetchStatus) await opts.fetchStatus();
							print(`✅ Provider set to: ${providerArg}`);
						} finally {
							setBusy(false);
						}
						break;
					}
					case "/new": {
						const s = (await api.sessions.create()) as { id: string };
						if (opts.fetchStatus) await opts.fetchStatus();
						window.location.href = `/workspace/${s.id}`;
						break;
					}
					case "/healthcheck": {
						print("⟳ Pinging AI model...");
						setBusy(true);
						const hc = (await api.health.model()) as HealthModelResult;
						setBusy(false);
						if (hc.status === "ok") {
							print(
								`✅ Model OK\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Latency  : ${hc.latency_ms}ms`,
							);
						} else {
							print(
								`❌ Model FAILED\n- Provider : ${hc.provider}\n- Model    : ${hc.model}\n- Error    : ${hc.error}`,
							);
						}
						break;
					}
					case "/info": {
						if (opts.status) {
							const modelMap: Record<string, string | undefined> = {
								gemini: opts.status.gemini_model,
								openai: opts.status.openai_model,
								ollama: opts.status.ollama_model,
								copilot: opts.status.copilot_model,
								bedrock: opts.status.bedrock_model,
							};
							const currentModel = modelMap[opts.status.ai_provider] || "—";
							print(
								`System Info:\n` +
									`- Repo     : ${opts.status.repo ? `${opts.status.repo.owner}/${opts.status.repo.repo}` : "not set"}\n` +
									`- AI       : ${opts.status.ai_provider}  (${currentModel})\n` +
									`- KB       : ${opts.status.kb_files} files, ${opts.status.kb_insights} chunks\n` +
									`- Sessions : ${opts.status.total_sessions}  Cost: ${opts.status.total_cost_usd.toFixed(5)}`,
							);
						}
						break;
					}
					case "/tool": {
						const target = args[1];
						if (!target) {
							print(
								'Usage: /tool <serverId>.<toolName> [json-args]\nExample: /tool srv-1.echo.ping {"message":"hello"}',
							);
							break;
						}
						const dotIdx = target.indexOf(".");
						if (dotIdx === -1) {
							print(
								"❌ Invalid format. Use: /tool <serverId>.<toolName> [json-args]",
							);
							break;
						}
						const serverId = target.slice(0, dotIdx);
						const toolName = target.slice(dotIdx + 1);
						const jsonStr = args.slice(2).join(" ") || "{}";
						let toolArgs: Record<string, unknown>;
						try {
							toolArgs = JSON.parse(jsonStr);
						} catch {
							print(`❌ Invalid JSON args: ${jsonStr}`);
							break;
						}
						print(`🔧 Invoking ${serverId}.${toolName}...`, "system");
						try {
							const result = await api.world.invoke(
								serverId,
								toolName,
								toolArgs,
							);
							const text =
								result.content.map((c) => c.text ?? "").join("\n") ||
								"(no output)";
							const prefix = result.is_error
								? "❌ Tool error:\n"
								: `✅ ${serverId}.${toolName}:\n`;
							print(prefix + text, result.is_error ? "error" : "tool");
						} catch (e) {
							print(`❌ Tool invocation failed: ${getErrorMessage(e)}`);
						}
						break;
					}

					default:
						throw new Error(
							`Unknown command "${command}". Type /help for available commands.`,
						);
				}
			} catch (e) {
				print(`❌ ${getErrorMessage(e)}`, "error");
			}
		},
		[sessionId, busy, opts, print, sendAsk, sendBtw],
	);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, [abortRef]);

	return {
		chatHistory,
		termLogs,
		termRef,
		busy,
		btwBusy,
		sendAsk,
		sendBtw,
		print,
		handleCmd,
		setBusy,
		setBtwBusy,
		setChatHistory,
	};
}

export const WorkspaceChatContextObj =
	createContext<WorkspaceChatContext | null>(null);

export function WorkspaceChatProvider({
	children,
	value,
}: {
	children: ReactNode;
	value: WorkspaceChatContext;
}) {
	return (
		<WorkspaceChatContextObj.Provider value={value}>
			{children}
		</WorkspaceChatContextObj.Provider>
	);
}

export function useChat() {
	const ctx = useContext(WorkspaceChatContextObj);
	if (!ctx)
		throw new Error("useChat must be used within WorkspaceChatProvider");
	return ctx;
}
