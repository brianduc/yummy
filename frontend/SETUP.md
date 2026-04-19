## Frontend setup (Next.js)

### Install & run

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:3000`

### Environment variables

- `NEXT_PUBLIC_API_URL`: the public URL your browser will call (default `http://localhost:8000`)

Example for local dev:

```bash
set NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Notes

- The frontend uses `fetch()` and does not require a special proxy configuration.
- For production containers, Next.js is built with `output: 'standalone'` (see `frontend/next.config.js`).

