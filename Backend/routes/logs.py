from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import subprocess
from logger import logger

# Create a router for logs routes
router = APIRouter(prefix="/logs", tags=["logs"])

# WebSocket endpoint to stream logs
@router.websocket("/{service_name}")
async def stream_logs(websocket: WebSocket, service_name: str):
    # Accept the WebSocket connection
    await websocket.accept()    
    logger.info(f"Client connected for service {service_name}")

    if service_name == "nexus":
        command = ["sudo", "tail", "-f", "-n", "50", "/var/log/nexus/nexus.log"]
    elif service_name == "nginx":
        command = ["sudo", "tail", "-f", "-n", "50", "/var/log/nginx/access.log"]
    else:
        command = ["sudo", "journalctl", "-u", service_name, "-f", "-n", "50"]

    # Start the process to stream logs
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    logger.info(f"Stream started for service {service_name}")

    try:
        # Get the running loop
        loop = asyncio.get_running_loop()
        # Keep streaming logs until the client disconnects
        while True:
            # Read a line from the process
            line = await loop.run_in_executor(None, process.stdout.readline)
            # If the process is closed break
            if not line:    
                break
            # Send the line to the client
            await websocket.send_text(line)
    except WebSocketDisconnect:
        # Print the error when the client disconnects
        logger.error(f"Client disconnected for service {service_name}")
    except Exception as e:
        logger.error(f"Error in streaming logs: {e}")
    finally:
        # Kill the process when the client disconnects
        process.kill()
        # Print the error when the client disconnects
        logger.info(f"Stream closed for service {service_name}")
    
