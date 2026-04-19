## Contributing

Thanks for contributing to YUMMY.

### Repo structure

- `backend/`: FastAPI
- `frontend/`: Next.js
- `docs/`: project documentation
- `resources/`: reference materials / architecture drafts

### Local development

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

### Pull requests

- Keep PRs focused and small
- Include a short test plan in the PR description
- Do not commit secrets (`.env`, API keys)

### Code style

- Python: keep functions small, prefer explicit types where helpful
- TypeScript/React: keep components cohesive; avoid “god components”

