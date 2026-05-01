from fastapi import APIRouter
import db
import subprocess
from pydantic import BaseModel
from logger import logger

# Create a router for services routes
router = APIRouter(prefix="/services", tags=["services"])

# Type hints for request body
class Service(BaseModel):
    name: str
    enabled: bool = True

# Route to get all services from the database
@router.get("/")
async def get_services() -> list:
    try:
        logger.info("Fetching all services")
        # Borrow a connection from the pool
        async with db.pool.acquire() as conn:
            # Get all services from the database
            rows = await conn.fetch("SELECT * FROM services")
        result = []
        # For each service in row check systemctl is-active for that service name
        for service in rows:
            # Check if service is active
            status = subprocess.run(
                ["systemctl", "is-active", service["name"]],
                capture_output=True
            ).stdout.decode().strip()
            # Append the service to the result
            result.append({
                "id": str(service["id"]),
                "name": service["name"],
                "enabled": service["enabled"],
                "status": status
            })
        logger.info(f"Services fetched: {len(result)}")
        # Return the result
        return result
    except Exception as e:
        logger.error(f"Error fetching services: {e}")
        # Return the error
        return {"error": str(e)}

# Route to add a new service to the database
@router.post("/add")
async def add_service(service: Service) -> dict:
    # Try to add a new service to the database
    logger.info(f"Adding service: {service.name}")
    try:
        # Borrow a connection from the pool
        async with db.pool.acquire() as conn:
            # Check if service is already registered in Nexus
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service.name)
            # If service is already registered return error
            if row:
                logger.error(f"Service already registered in Nexus: {service.name}")
                return {"error": "Service already registered in Nexus"}
            # Insert service into the database
            await conn.execute(
                "INSERT INTO services (name, enabled) VALUES ($1, $2)",
                service.name, service.enabled
            )   
        # Return the result
        logger.info(f"Service added: {service.name}")
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error adding service: {e}")
        # Return the error
        return {"error": str(e)}

# Route to start a service
@router.post("/{service_name}/start")
async def start_service(service_name: str) -> dict:
    try:
        logger.info(f"Starting service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
        # Check if service is already running
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "active":
            logger.error(f"Service already running: {service_name}")
            return {"error": "Service already running. Use /restart to restart it."}
        # Start the service
        subprocess.run(["sudo", "systemctl", "start", service_name])
        # Check if service is running
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "active":
            return {"status": "ok"}
        # If service failed to start return error
        return {"error": "Service failed to start"}
    except Exception as e:
        return {"error": str(e)}

# Route to stop a service
@router.post("/{service_name}/stop")
async def stop_service(service_name: str) -> dict:
    try:
        logger.info(f"Stopping service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
        # Check if service is already stopped
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "inactive":
            logger.error(f"Service already stopped: {service_name}")
            return {"error": "Service already stopped. Use /start to start it."}
        # Stop the service
        subprocess.run(["sudo", "systemctl", "stop", service_name])
        # Check if service is stopped
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "inactive":
            logger.info(f"Service stopped: {service_name}")
            return {"status": "ok"}
        # If service failed to stop return error
        logger.error(f"Service failed to stop: {service_name}")
        return {"error": "Service failed to stop"}
    except Exception as e:
        logger.error(f"Error stopping service: {e}")
        # Return the error
        return {"error": str(e)}

# Route to restart a service
@router.post("/{service_name}/restart")
async def restart_service(service_name: str) -> dict:
    try:
        logger.info(f"Restarting service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
        # Check if service is already stopped
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "inactive":
            logger.error(f"Service not running: {service_name}")
            return {"error": "Service is not running. Use /start to start it."}
        # Restart the service
        subprocess.run(["sudo", "systemctl", "restart", service_name])
        # Check if service is running
        if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "active":
            logger.info(f"Service restarted: {service_name}")
            return {"status": "ok"}
        # If service failed to restart return error
        logger.error(f"Service failed to restart: {service_name}")
        return {"error": "Service failed to restart"}
    except Exception as e:
        logger.error(f"Error restarting service: {e}")
        # Return the error
        return {"error": str(e)}

# Route to enable a service
@router.post("/{service_name}/enable")
async def enable_service(service_name: str) -> dict:
    try:
        logger.info(f"Enabling service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
            # If service is already enabled return error
            if row["enabled"] == True:
                logger.error(f"Service already enabled: {service_name}")
                return {"error": "Service already enabled"}
        # Enable the service
        subprocess.run(["sudo", "systemctl", "enable", service_name])
        # Check if service is enabled
        if subprocess.run(["systemctl", "is-enabled", service_name], capture_output=True).stdout.decode().strip() == "enabled":
            async with db.pool.acquire() as conn:
                await conn.execute("UPDATE services SET enabled = $1 WHERE name = $2", True, service_name)
            logger.info(f"Service enabled: {service_name}")
            return {"status": "ok"}
        # If service failed to enable return error
        logger.error(f"Service failed to enable: {service_name}")
        return {"error": "Service failed to enable"}
    except Exception as e:
        logger.error(f"Error enabling service: {e}")
        # Return the error
        return {"error": str(e)}

# Route to disable a service
@router.post("/{service_name}/disable")
async def disable_service(service_name: str) -> dict:
    try:
        logger.info(f"Disabling service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
            # If service is already disabled return error
            if row["enabled"] == False:
                logger.error(f"Service already disabled: {service_name}")
                return {"error": "Service already disabled"}
        # Disable the service
        subprocess.run(["sudo", "systemctl", "disable", service_name])
        # Check if service is disabled
        if subprocess.run(["systemctl", "is-enabled", service_name], capture_output=True).stdout.decode().strip() == "disabled":
            async with db.pool.acquire() as conn:
                await conn.execute("UPDATE services SET enabled = $1 WHERE name = $2", False, service_name)
            logger.info(f"Service disabled: {service_name}")
            return {"status": "ok"}
        # If service failed to disable return error
        logger.error(f"Service failed to disable: {service_name}")
        return {"error": "Service failed to disable"}
    except Exception as e:
        logger.error(f"Error disabling service: {e}")
        # Return the error
        return {"error": str(e)}

# Delete a service from the database
@router.delete("/{service_name}")
async def delete_service(service_name: str) -> dict:
    try:
        logger.info(f"Deleting service: {service_name}")
        # Borrow a connection from pool
        async with db.pool.acquire() as conn:
            # Get service from database
            row = await conn.fetchrow("SELECT * FROM services WHERE name = $1", service_name)
            # If service is not found return error
            if not row:
                logger.error(f"Service not registered in Nexus: {service_name}")
                return {"error": "Service not registered in Nexus"}
            # If service is running return error
            if subprocess.run(["systemctl", "is-active", service_name], capture_output=True).stdout.decode().strip() == "active":
                logger.error(f"Service is running: {service_name}")
                return {"error": "Service is running. Use /stop to stop it."}
            # If service is enabled return error
            if subprocess.run(["systemctl", "is-enabled", service_name], capture_output=True).stdout.decode().strip() == "enabled":
                logger.error(f"Service is enabled: {service_name}")
                return {"error": "Service is enabled. Use /disable to disable it."}     
            # Delete the service from the database
            await conn.execute("DELETE FROM services WHERE name = $1", service_name)
            logger.info(f"Service deleted: {service_name}")
            return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error deleting service: {e}")
        # Return the error
        return {"error": str(e)}