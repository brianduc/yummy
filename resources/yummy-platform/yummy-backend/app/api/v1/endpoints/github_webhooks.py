from fastapi import APIRouter
router = APIRouter()
@router.get("/")
async def list_github_webhooks():
    return {"items": [], "endpoint": "github_webhooks"}
