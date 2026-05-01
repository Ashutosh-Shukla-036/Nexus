from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import db
from routes import metrics
from routes import services
from routes import logs
from routes import apps
from workers.monitor import start_monitor
import asyncio
from logger import logger

# Lifespan manages startup and shutdown of the app
# Everything before yield runs on startup
# Everything after yield runs on shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Nexus starting up...")
    try:
        # Connect to database and create tables on startup
        await db.connect()
        logger.info("DataBase connected")
        # Start the monitor worker in background
        task = asyncio.create_task(start_monitor())
        logger.info("Created Back ground task")
        # Yield control back to FastAPI for requests
        yield
    finally:
        # Cancel the monitor task
        task.cancel()
        logger.info("Back ground task stopped")
        # Always disconnect cleanly even if something crashes
        await db.disconnect()
        logger.info("DataBase disconnected")
        logger.info("Nexus shutdown complete.")

# Pass lifespan to FastAPI so it knows what to run on startup/shutdown
app = FastAPI(lifespan=lifespan)

# Adding CORS middleware to allow frontend to make requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Adding logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"{request.method} {request.url.path} → {response.status_code}")
    return response

# Health check endpoint — used by monitoring tools to verify app is alive
@app.get("/health")
async def health():
    return {"status": "ok"}

# Include all routers in the main app
# This makes all routes under /metrics, /apps, etc. available
app.include_router(metrics.router)
app.include_router(services.router)
app.include_router(logs.router)
app.include_router(apps.router)