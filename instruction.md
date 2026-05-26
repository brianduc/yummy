# YUMMY — Local Dev & Cloudflare Deploy

## Prerequisites

- **Node.js ≥ 20**
- **pnpm** (backend) + **npm** (frontend)
- **Cloudflare account** + `wrangler` (for deploy only)

---

## Local Development

### Backend (Hono API)

```bash
cd backend-ts
pnpm install
pnpm db:migrate        # first time only
pnpm dev               # http://localhost:8000
```

Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local` to point at local backend.

### One-command start

```bash
bash start.sh          # Linux/Mac
start.bat              # Windows
```

---

## Cloudflare Deploy

### 1. Login

```bash
npx wrangler login
```

### 2. Backend

```bash
cd backend-ts

# Install deps
pnpm install

# Generate SQL migration & apply to remote D1
pnpm db:generate
npx wrangler d1 migrations apply yummy-db --remote

# Deploy
npx wrangler deploy
```

After deploy, set secrets in Cloudflare Dashboard:
**Workers & Pages → yummy-api → Settings → Variables → Secrets**

Required:
- `GEMINI_API_KEY`

Optional (per provider):
- `OPENAI_API_KEY`
- `GITHUB_TOKEN`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`
- `COPILOT_GITHUB_TOKEN`

### 3. Frontend

```bash
cd frontend

# Install deps
npm install

# Build & deploy (replace URL with your backend Worker URL)
NEXT_PUBLIC_API_URL=https://yummy-api.<your-subdomain>.workers.dev \
  npx opennextjs-cloudflare build && \
  npx opennextjs-cloudflare deploy
```

### 4. (One-time) Create D1 database

Only needed on first deploy:

```bash
cd backend-ts
npx wrangler d1 create yummy-db
```

Copy the `database_id` from output into `backend-ts/wrangler.jsonc`:
```jsonc
"database_id": "<paste-id-here>"
```

---

## Current Deployments

| Service | URL |
|---|---|
| API | https://yummy-api.brianduc9112003.workers.dev |
| App | https://yummy-frontend.brianduc9112003.workers.dev |
| Swagger | https://yummy-api.brianduc9112003.workers.dev/docs |

---

## Useful Commands

```bash
# Backend
cd backend-ts
pnpm dev                  # local dev with hot-reload
pnpm build                # TypeScript check
pnpm test                 # run tests
pnpm lint                 # Biome check
pnpm db:generate          # generate Drizzle migrations
npx wrangler dev          # local dev with Wrangler (simulates Workers)
npx wrangler tail         # stream production logs

# Frontend
cd frontend
npm run dev               # local dev
npm run build             # production build
npm test                  # run tests
npx opennextjs-cloudflare preview   # preview Worker locally
npx opennextjs-cloudflare deploy    # deploy to Cloudflare
npx wrangler tail         # stream production logs
```
