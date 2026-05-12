# YUMMY - AI-powered SDLC Platform

```
yummy/
├── frontend/     - Next.js app (port 3000)
├── backend/      - FastAPI app (port 8000)
├── docker-compose.yml - Backend + frontend containers (optional)
├── docs/         - Deployment guides (e.g. AWS)
├── start.bat     - One-command start (Windows CMD / PowerShell)
├── start.sh      - One-command start (Linux / Mac / Git Bash)
└── .env.example  - Config template
```

---

## Quick Start

### Windows - CMD or PowerShell (recommended)

```
start.bat
```

### Windows - Git Bash / Linux / Mac

```bash
bash start.sh
```

On first run the script auto-creates `.env` and asks you to fill in your API key.  
Get a free Gemini key at: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Run the same command again after filling in the key — everything else is automatic.

### Modes

Both `start.sh` and `start.bat` accept a mode argument:

```bash
bash start.sh           # equivalent to: bash start.sh dev
bash start.sh dev       # local backend + frontend, .env + .env.dev
bash start.sh staging   # local servers, .env + .env.staging (e.g. point frontend at staging API)
bash start.sh prod      # REFUSED — use docker compose or your deploy pipeline
bash start.sh --help    # show usage
```

Each mode loads `.env` first, then overlays `.env.<mode>` on top (mode-specific
values win). On first run for a given mode, `.env.<mode>` is auto-created from
the committed `.env.<mode>.example` template — fill in any secrets and re-run.

Per-mode override files (gitignored, hold your real secrets):
`.env.dev`, `.env.staging`, `.env.prod`

Per-mode example templates (committed, contain placeholders only):
`.env.dev.example`, `.env.staging.example`, `.env.prod.example`

Requirements:
- **Node.js 20+** (https://nodejs.org)
- **pnpm** (auto-installed by the start scripts if missing)

---

## Configuration (.env)

> The variables below can be overridden per-mode by setting them in `.env.<mode>`.

| Variable          | Description               | Default                  |
| ----------------- | ------------------------- | ------------------------ |
| `GEMINI_API_KEY`  | Your Gemini API key       | required                 |
| `AI_PROVIDER`     | `gemini` or `ollama`      | `gemini`                 |
| `OLLAMA_BASE_URL` | Ollama server URL         | `http://localhost:11434` |
| `OLLAMA_MODEL`    | Ollama model name         | `codellama`              |
| `GITHUB_TOKEN`    | For private repo scanning | optional                 |
| `BACKEND_PORT`    | Backend port              | `8000`                   |
| `FRONTEND_PORT`   | Frontend port             | `3000`                   |
| `CORS_ORIGINS`    | Comma-separated browser origins allowed to call the API | `http://localhost:3000,http://127.0.0.1:3000` |
| `NEXT_PUBLIC_API_URL` | Public URL of the API (frontend build / `next dev`) | `http://localhost:8000` |

---

## Docker (split deploy)

Build locally or use **GitHub Actions** (`.github/workflows/docker-build.yml`) so you do not need Docker on your machine.

```bash
export NEXT_PUBLIC_API_URL=http://localhost:8000
export CORS_ORIGINS=http://localhost:3000
docker compose build
docker compose up -d
```

For separate domains: set `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` when building the frontend image, and `CORS_ORIGINS=https://app.yourdomain.com` on the backend.

AWS (fastest path, no Docker needed): [docs/aws/APP_RUNNER_AMPLIFY.md](docs/aws/APP_RUNNER_AMPLIFY.md). Full docs index: [docs/README.md](docs/README.md).

---

## URLs


| Service | URL                                                      |
| ------- | -------------------------------------------------------- |
| App     | [http://localhost:3000](http://localhost:3000)           |
| API     | [http://localhost:8000](http://localhost:8000)           |
| Swagger | [http://localhost:8000/docs](http://localhost:8000/docs) |


---

## Product Requirements Backlog

- Full user-story backlog (500 stories, epic/story/task/subtask + Gherkin): `requirements/README.md`
- Structure follows a template-style format with table of contents and story ranges (`US-001` to `US-500`).

---

## Manual Setup (for debugging)

**Backend:**

```bash
cd backend-ts
pnpm install
pnpm db:migrate
pnpm dev               # http://localhost:8000  (docs at /docs)
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

