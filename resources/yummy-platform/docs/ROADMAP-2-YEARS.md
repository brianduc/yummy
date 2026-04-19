# Yummy Platform — 2-Year Roadmap (2025-2027)

## Phase 1: Foundation (Q2-Q3 2025) — Ship the Core

- Separated frontend Next.js 15 + backend FastAPI
- yummy-mcp-server: IDE-agnostic via MCP protocol  
- Core agents: po, ba, scrum, review, guard, qa, docs
- GitHub webhooks, PR automation, branch protection gates
- Real-time streaming (SSE + WebSocket)
- Local model Ollama (zero egress mode)
- JWT + RBAC, PostgreSQL + pgvector
- Docker Compose + K8s manifests
- VS Code VSIX extension + Cursor MCP config

## Phase 2: Intelligence (Q4 2025 - Q1 2026) — Smarter Agents

- Multi-agent orchestration (yummy-brain A2A protocol)
- Composer mode: multi-file AI editing (Cursor-parity)
- Shadow workspace: AI proposes in parallel branch
- Apply-to-codebase with checkpoint restore
- Monaco Editor embedded + LSP integration
- Prompt caching: 90% hit rate for codebase context
- Image/screenshot input (design-to-code)
- Voice input via Whisper
- Custom agent personas + Agent marketplace
- Multi-model routing: task → optimal model → cost

## Phase 3: Enterprise (Q2-Q3 2026) — Production-Grade

- SSO/SAML/LDAP enterprise auth
- OPA policy engine (GDPR, ISO 27001, SOC2)
- HashiCorp Vault integration (yummy-vault)
- Air-gapped deployment (fully offline Ollama)
- Multi-tenant isolated workspaces
- Tamper-proof audit logging for compliance
- SIEM integration (Splunk, ELK, Datadog)
- Financial services: transaction monitoring, regulatory agents
- Healthcare: HIPAA-compliant mode

## Phase 4: Platform (Q4 2026 - Q2 2027) — AI Development OS

- Yummy App Store: community agent marketplace
- Agent SDK for external developers
- 100+ MCP server integrations
- Self-improving agents via feedback loops
- Autonomous feature delivery pipeline
- Real-time multi-developer + AI pair programming
- Post-quantum encryption for secrets
- LLM fine-tuning on organization codebase

