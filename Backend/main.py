from fastapi import FastAPI
from contextlib import asynccontextmanager
import db
from routes import metrics
from routes import services
from routes import logs
from workers.monitor import start_monitor
import asyncio

# Lifespan manages startup and shutdown of the app
# Everything before yield runs on startup
# Everything after yield runs on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # Connect to database and create tables on startup
        await db.connect()
        # Start the monitor worker in background
        task = asyncio.create_task(start_monitor())
        # Yield control back to FastAPI for requests
        yield
    finally:
        # Cancel the monitor task
        task.cancel()
        # Always disconnect cleanly even if something crashes
        await db.disconnect()

# Pass lifespan to FastAPI so it knows what to run on startup/shutdown
app = FastAPI(lifespan=lifespan)

# Health check endpoint — used by monitoring tools to verify app is alive
@app.get("/health")
async def health():
    return {"status": "ok"}

# Include all routers in the main app
# This makes all routes under /metrics, /apps, etc. available
app.include_router(metrics.router)
app.include_router(services.router)
app.include_router(logs.router)