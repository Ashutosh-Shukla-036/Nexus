from fastapi import APIRouter
from pydantic import BaseModel, Field
from logger import logger
import deployer.detect as detect
import deployer.setup as setup
import deployer.service as service
import deployer.nginx as nginx
import deployer.clone as clone
import subprocess
import asyncio
import shutil
import socket
import db
import os

# Model for scan_repo request
class ScanRepo(BaseModel):
    repo_url: str

# Model for deploy request  
class DeployRequest(BaseModel):
    name: str = Field(..., pattern=r'^[a-zA-Z0-9-]+$')
    repo_url: str
    port: int
    scan_id: str
    subfolder: str = ""
    env_vars: dict = {}

# Create a router for apps routes
router = APIRouter(prefix="/apps", tags=["apps"])

# Rollback function
def rollback(app_name: str, app_base: str):
    subprocess.run(["sudo", "systemctl", "stop", app_name], capture_output=True)
    subprocess.run(["sudo", "systemctl", "disable", app_name], capture_output=True)
    subprocess.run(["sudo", "rm", "-f", f"/etc/systemd/system/{app_name}.service"], capture_output=True)
    subprocess.run(["sudo", "systemctl", "daemon-reload"], capture_output=True)
    subprocess.run(["sudo", "rm", "-f", f"/etc/nginx/sites-enabled/{app_name}"], capture_output=True)
    subprocess.run(["sudo", "rm", "-f", f"/etc/nginx/sites-available/{app_name}"], capture_output=True)
    subprocess.run(["sudo", "systemctl", "reload", "nginx"], capture_output=True)
    shutil.rmtree(app_base, ignore_errors=True)

# Get list of all apps
@router.get("/")
async def get_all_apps():
    try:
        async with db.pool.acquire() as conn:
            rows = await conn.fetch("SELECT * FROM apps")
            result = []
            for row in rows:
                result.append({
                    "name": row["name"],
                    "repo_url": row["repo_url"],
                    "port": row["port"],
                    "subfolder": row["subfolder"],
                    "status": row["status"],
                    "created_at": row["created_at"]
                })
            logger.info(f"Apps count: {len(result)}")
            return result
    except Exception as e:
        logger.error(f"Error getting all apps: {e}")
        return {"error": str(e)}
    
# Get app by name
@router.get("/{app_name}")
async def get_app(app_name: str):
    try:
        async with db.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM apps WHERE name = $1", app_name)
            if not row:
                logger.error(f"App not found: {app_name}")
                return {"error": "App not found"}
            logger.info(f"App {app_name} found.")
            return {
                "name": row["name"],
                "repo_url": row["repo_url"],
                "port": row["port"],
                "subfolder": row["subfolder"],
                "status": row["status"],
                "created_at": row["created_at"]
            }
    except Exception as e:
        logger.error(f"Error getting app: {e}")
        return {"error": str(e)}

# Scan a repo and return the list of folders in /tmp/nexus-scan/<scan_id>
@router.post("/scan")
async def scan_repo(request: ScanRepo):
    try:
        logger.info(f"Scanning repo: {request.repo_url}")
        loop = asyncio.get_event_loop()
        clone_result = await loop.run_in_executor(None, clone.clone_repo, request.repo_url)
        if clone_result["success"]:
            folders = [f for f in os.listdir(clone_result["path"]) 
                      if os.path.isdir(f"{clone_result['path']}/{f}")]
            logger.info(f"Scanned repo: {clone_result['path']}")
            return {"status": "ok", "scan_id": clone_result["scan_id"], "folders": folders}
        else:
            logger.error(f"Failed to scan repo: {clone_result['error']}")
            return {"error": clone_result["error"]}
    except Exception as e:
        logger.error(f"Error scanning repo: {e}")
        return {"error": str(e)}

async def run_deployment(request: DeployRequest):
    app_base = f"/srv/apps/{request.name}"
    loop = asyncio.get_event_loop()
    
    try:
        # Update status to deploying
        async with db.pool.acquire() as conn:
            await conn.execute(
                "UPDATE apps SET status = 'deploying' WHERE name = $1",
                request.name
            )
        logger.info(f"Updated status to deploying for: {request.name}")

        # Move temp clone — blocking, run in executor
        scan_path = f"/tmp/nexus-scan/{request.scan_id}"
        await loop.run_in_executor(None, shutil.move, scan_path, app_base)
        logger.info(f"Moved temp clone to: {app_base}")

        # Set app path
        app_path = f"{app_base}/{request.subfolder}" if request.subfolder else app_base

        # Detect stack — blocking
        stack_info = await loop.run_in_executor(None, detect.detech_stack, app_path)
        if stack_info["stack"] == "unknown":
            raise Exception("Could not detect stack")

        stack_name = stack_info["stack"]

        # Setup dependencies — most blocking operation
        result = await loop.run_in_executor(None, setup.setup_app, app_path, stack_info["language"])
        if not result["success"]:
            raise Exception(f"Setup failed: {result['error']}")

        # Create systemd service — blocking
        result = await loop.run_in_executor(
            None, service.create_service,
            request.name, app_path, stack_name, request.port,
            os.getenv("NEXUS_USER", "ashutoshshukla"), request.env_vars
        )
        if not result["success"]:
            raise Exception(f"Service failed: {result['error']}")

        # Create nginx config — blocking
        result = await loop.run_in_executor(None, nginx.create_nginx_config, request.name, request.port)
        if not result["success"]:
            raise Exception(f"Nginx failed: {result['error']}")

        # Update status to running
        async with db.pool.acquire() as conn:
            await conn.execute(
                "UPDATE apps SET status = 'running' WHERE name = $1",
                request.name
            )
        logger.info(f"App deployed successfully: {request.name}")

    except Exception as e:
        logger.error(f"Deployment failed for {request.name}: {e}")
        # Update status to failed
        async with db.pool.acquire() as conn:
            await conn.execute(
                "UPDATE apps SET status = 'failed' WHERE name = $1",
                request.name
            )
        # Rollback
        await loop.run_in_executor(None, rollback, request.name, app_base)
    
# Deploy an app
@router.post("/deploy")
async def deploy_app(request: DeployRequest):
    app_base = f"/srv/apps/{request.name}"
    try:
        # All validations upfront — fast, no blocking
        async with db.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM apps WHERE port = $1", request.port)
            if row:
                return {"error": "Port already taken"}
            row = await conn.fetchrow("SELECT * FROM apps WHERE name = $1", request.name)
            if row:
                return {"error": "App already exists"}
        

        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("localhost", request.port)) == 0:
                return {"error": "Port already in use on system"}

        if os.path.exists(app_base):
            return {"error": "App folder already exists"}

        scan_path = f"/tmp/nexus-scan/{request.scan_id}"
        if not os.path.exists(scan_path):
            return {"error": "Scan not found. Please scan again."}

        # Insert into DB immediately with status pending
        async with db.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO apps (name, repo_url, port, subfolder, domain, status) VALUES ($1, $2, $3, $4, $5, $6)",
                request.name, request.repo_url, request.port, request.subfolder, f"{request.name}.localhost", "pending"
            )

        # Fire and forget — don't await
        logger.info(f"Starting background task for: {request.name}")
        asyncio.create_task(run_deployment(request))

        logger.info(f"Deployment started for: {request.name}")
        return {
            "status": "deploying",
            "message": "Deployment started in background",
            "check_status": f"/apps/{request.name}"
        }

    except Exception as e:
        logger.error(f"Error starting deployment: {e}")
        return {"error": str(e)}
    
@router.delete("/{app_name}")
async def remove_app(app_name: str):
    try:
        logger.info(f"Removing app: {app_name}")
        
        # Check app exists in DB first
        async with db.pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM apps WHERE name = $1", app_name)
            if not row:
                return {"error": "App not found"}
        
        app_base = f"/srv/apps/{app_name}"
        
        # Stop and cleanup everything
        await asyncio.get_event_loop().run_in_executor(None, rollback, app_name, app_base)
        logger.info(f"App stopped and cleaned up: {app_name}")
        
        # Remove from DB
        async with db.pool.acquire() as conn:
            await conn.execute("DELETE FROM apps WHERE name = $1", app_name)
        
        logger.info(f"App removed successfully: {app_name}")
        return {"status": "ok", "message": "App removed successfully"}
    except Exception as e:
        logger.error(f"Error removing app: {e}")
        return {"error": str(e)}