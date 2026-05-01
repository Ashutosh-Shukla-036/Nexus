import asyncio
import os
import shutil
import time
from routes.metrics import collect_and_store
from logger import logger

# Background worker — runs forever, collects metrics every 10 seconds
async def start_monitor():
    # Continuously collect metrics
    logger.info("Monitor started")
    while True:
        try:
            # Collect and store metrics
            await collect_and_store()
            # Clean up old scan folders
            await cleanup_temp_scans()
        except Exception as e:
            # Don't crash the loop on error — just log and continue
            logger.error(f"Monitor error: {e}")
        # Wait for 10 seconds before collecting next metrics
        await asyncio.sleep(60)

# Cleanup temp scans
async def cleanup_temp_scans():
    scan_dir = "/tmp/nexus-scan"
    if not os.path.exists(scan_dir):
        return
    for folder in os.listdir(scan_dir):
        folder_path = f"{scan_dir}/{folder}"
        if not os.path.exists(folder_path):  # already deleted
            continue
        if time.time() - os.path.getctime(folder_path) > 3600:
            shutil.rmtree(folder_path)
            logger.info(f"Cleaned up temp scan: {folder_path}")