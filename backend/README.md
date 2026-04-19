## YUMMY backend (FastAPI)

### Local development

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

### Key environment variables

- `AI_PROVIDER`: `gemini | openai | bedrock | copilot | ollama`
- `GEMINI_API_KEY`: required for Gemini provider
- `CORS_ORIGINS`: comma-separated list of browser origins allowed to call the API

Example:

```bash
CORS_ORIGINS=http://localhost:3000,https://app.yourdomain.com
```

### Important limitation

This prototype uses an **in-memory** store (`backend/config.py`). For production you will want PostgreSQL/Redis.

