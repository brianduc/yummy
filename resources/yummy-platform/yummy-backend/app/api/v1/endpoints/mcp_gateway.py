from fastapi import APIRouter
router = APIRouter()
@router.get("/")
async def list_mcp_gateway():
    return {"items": [], "endpoint": "mcp_gateway"}
