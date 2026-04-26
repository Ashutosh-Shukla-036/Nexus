from fastapi import APIRouter
import db
import psutil

# Create a router for metrics routes
router = APIRouter(prefix="/metrics", tags=["metrics"])

# Standalone function — used by both the route and the background worker
async def collect_and_store():
    # Get CPU percentage with 1 second interval
    cpu_percent = psutil.cpu_percent(interval=1)
    # Get virtual memory (RAM) usage percentage
    ram_percent = psutil.virtual_memory().percent
    # Get disk usage percentage for the root directory
    disk_percent = psutil.disk_usage('/').percent

    # Insert metrics into the database
    async with db.pool.acquire() as conn:
        # Insert metrics into the database
        await conn.execute(
            "INSERT INTO metrics (cpu, ram, disk) VALUES ($1, $2, $3)",
            cpu_percent, ram_percent, disk_percent
        )
        # Clean up of old records
        await conn.execute(
            "DELETE FROM metrics WHERE recorded_at < now() - INTERVAL '1 hours'"
        )
    # Return the result
    return {"cpu": cpu_percent, "ram": ram_percent, "disk": disk_percent}

# Route to get all metrics from the database
@router.get("/")
async def get_metrics():
    # Try to get all metrics from the database
    try:
        # Borrow a connection from the pool
        async with db.pool.acquire() as conn:
            # Get all metrics from the database
            rows = await conn.fetch("SELECT * FROM metrics ORDER BY recorded_at DESC")
            # Convert rows to list of dictionaries
            result = []
            for row in rows:
                result.append({
                    "cpu": row["cpu"],
                    "ram": row["ram"],
                    "disk": row["disk"],
                    "recorded_at": row["recorded_at"]
                })
            return result
    except Exception as e:
        # Return the error
        return {"error": str(e)}

# Route to manually trigger metric collection
@router.post("/collect")
async def collect_metrics() -> dict:
    # Try to collect metrics
    try:
        # Collect metrics
        result = await collect_and_store()
        # Return the result
        return {**result, "status": "collected"}
    except Exception as e:
        # Return the error
        return {"error": str(e)}