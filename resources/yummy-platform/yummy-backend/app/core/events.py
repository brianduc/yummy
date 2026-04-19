import structlog
from app.core.database import engine, Base

logger = structlog.get_logger()

async def startup_event():
    logger.info("Starting Yummy Platform Backend")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized")

async def shutdown_event():
    logger.info("Shutting down Yummy Platform Backend")
    await engine.dispose()
