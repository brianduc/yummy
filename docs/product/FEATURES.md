## Features (current prototype)

### Core workflow

- **Workspace sessions**: create/list/reset sessions
- **GitHub repo scan**: index a GitHub repository into an in-memory “knowledge base”
- **RAG chat**: ask questions against the indexed repo (SSE streaming)
- **SDLC multi-agent pipeline**: BA → SA → Dev Lead → Dev → Security → QA → SRE (with approval checkpoints)
- **Provider switching**: Gemini / Ollama / Copilot / OpenAI / Bedrock (varies by config)
- **Metrics**: basic request logs + token/cost estimation (in-memory)

### UI panels (frontend)

- Chat
- Sessions
- Tracing / metrics
- Settings (API keys / provider / GitHub setup)
- IDE simulator (view file content from scanned repo)
- Wiki/insights panels (summary + chunk insights)
- SDLC panel (run pipeline and approve steps)

### Known limitations (important)

- **No persistence**: sessions/KB are in RAM (restart = data loss)
- **No auth**: anyone who can reach the API can use it
- **No multi-tenant isolation**: not ready for enterprise use without data/auth layers

### Deployment status / what is NOT production-ready yet

The recommended fast deploy path is [docs/aws/APP_RUNNER_AMPLIFY.md](../aws/APP_RUNNER_AMPLIFY.md) (App Runner backend + Amplify Hosting frontend + Route 53). It is PoC-grade and has these concrete caveats:

- **In-memory DB**: sessions, knowledge base, and request logs live in process memory (see `backend/config.py` `DB`). App Runner redeploys and container restarts reset this state. Keep App Runner auto-scaling at Min/Max = 1 so state does not desynchronize across instances.
- **App Runner ~120s request timeout**: very long `/ask` SSE streams get cut. Keep `max_scan_limit` between 20 and 200 for first demos; typical chat answers complete well under the limit.
- **No authentication**: `CORS_ORIGINS` is the only access control. Anyone who learns `https://api.yourdomain.com` can spend your LLM budget. Put the domain behind HTTP basic auth at the edge, or add real auth soon (see `BACKLOG.md` P0).
- **Secrets**: `GEMINI_API_KEY` (and other provider keys) must be stored in AWS Secrets Manager and referenced by App Runner, never committed or pasted as plain env vars.
- **Horizontal scale, HA, DB, Redis, VPC, SSO, audit**: intentionally out of scope for the fast path. When you need any of these, migrate to the ECS/ALB path in [docs/aws/AWS_DEPLOYMENT_ECS_FARGATE.md](../aws/AWS_DEPLOYMENT_ECS_FARGATE.md) and follow the backlog in [BACKLOG.md](BACKLOG.md).

