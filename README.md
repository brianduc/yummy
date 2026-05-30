# YUMMY - AI-powered SDLC Platform

YUMMY is a monorepo with a Next.js frontend and a TypeScript/Hono backend.

```text
yummy-monorepo/
├── frontend/           # Next.js app (default port 3000)
├── backend-ts/         # TypeScript / Hono API (default port 8000)
├── docker-compose.yml  # Optional containerized startup
├── docs/               # Deployment and supporting docs
├── start.bat           # One-command startup for Windows
├── start.sh            # One-command startup for Linux / macOS / Git Bash
└── .env.example        # Root environment template
```

## Run in a dev environment

### Requirements

- Node.js 20+
- npm
- pnpm for the backend (installed automatically by `start.sh` if missing)

### Recommended: one-command startup

#### Windows (CMD or PowerShell)

```bat
start.bat
```

#### Linux / macOS / Git Bash

```bash
bash start.sh
```

What the startup scripts do:

- create `.env` from `.env.example` if it does not exist
- create `.env.<mode>` from `.env.<mode>.example` on first run
- load `.env`, then overlay `.env.<mode>`
- install backend/frontend dependencies on first run
- run backend migrations
- start the backend and frontend locally

Provider credentials can be configured later in the app UI or via `.env`.

### Startup modes

```bash
bash start.sh           # same as: bash start.sh dev
bash start.sh dev       # local backend + frontend using .env + .env.dev
bash start.sh staging   # local servers using .env + .env.staging
bash start.sh prod      # refused; use docker compose or a deploy pipeline
bash start.sh --help    # show usage
```

Mode-specific override files:

- `.env.dev`
- `.env.staging`
- `.env.prod`

Committed templates:

- `.env.dev.example`
- `.env.staging.example`
- `.env.prod.example`

### Manual startup

Use this if you want to run each app separately.

#### 1 Configure environment

Create the root env file from the template if you are not using the startup script:

```bash
cp .env.example .env
```

Important variables:

| Variable | Description | Default |
| --- | --- | --- |
| `GEMINI_API_KEY` | Gemini API key | optional at startup; can be set in the UI |
| `AI_PROVIDER` | `gemini` or `ollama` | `gemini` |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `OLLAMA_MODEL` | Ollama model name | `codellama` |
| `GITHUB_TOKEN` | Token for private repo scanning | optional |
| `BACKEND_PORT` | Backend port | `8000` |
| `FRONTEND_PORT` | Frontend port | `3000` |
| `CORS_ORIGINS` | Allowed browser origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL | `http://localhost:8000` |

#### 2 Start the backend

```bash
cd backend-ts
pnpm install
pnpm db:migrate
pnpm dev
```

Backend docs: [backend-ts/README.md](backend-ts/README.md)

#### 3 Start the frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

If needed, create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Local URLs

| Service | URL |
| --- | --- |
| App | [http://localhost:3000](http://localhost:3000) |
| API | [http://localhost:8000](http://localhost:8000) |
| Swagger | [http://localhost:8000/docs](http://localhost:8000/docs) |

## Docker Compose (Postgres + backend + frontend)

The compose stack starts three services: a Postgres 16 database, the TypeScript backend, and the Next.js frontend.

```bash
docker compose up -d
```

Services:

| Service  | Host port | Notes |
|----------|-----------|-------|
| postgres | 5433      | Internal port 5432. Credentials: yummy/yummy/yummy |
| backend  | 8000      | Runs `pnpm db:migrate` then `pnpm start`. Waits for postgres healthy. |
| frontend | 3000      | `NEXT_PUBLIC_API_URL` baked at build time (default `http://localhost:8000`). |

Verify after startup:

```bash
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:3000/
```

Expected: `{"status":"ok","db":"ok"}` and YUMMY HTML.

To override the public API URL (e.g. for a remote backend):

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com docker compose build frontend
docker compose up -d
```

Provider API keys and other secrets should be placed in a root `.env` file (copy from `.env.example`). The backend service loads `.env` if present but does **not** require it — provider credentials can be set in the UI after startup.

> **Note:** Postgres host port defaults to 5433 (not 5432) to avoid conflicts with a locally running Postgres instance.

AWS deploy docs: [docs/aws/APP_RUNNER_AMPLIFY.md](docs/aws/APP_RUNNER_AMPLIFY.md)  
Docs index: [docs/README.md](docs/README.md)

## Notes

- Backend uses `pnpm`; frontend uses `npm`.
- `start.sh` writes `frontend/.env.local` automatically for local API routing.
- The backend serves Swagger docs at `/docs`.
- Product backlog lives in `requirements/README.md`.
