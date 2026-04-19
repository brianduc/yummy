from fastapi import APIRouter
router = APIRouter()
@router.get("/")
async def list_docs_gen():
    return {"items": [], "endpoint": "docs_gen"}
