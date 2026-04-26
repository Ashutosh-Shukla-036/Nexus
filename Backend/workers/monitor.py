import asyncio
from routes.metrics import collect_and_store

# Background worker — runs forever, collects metrics every 10 seconds
async def start_monitor():
    # Continuously collect metrics
    while True:
        try:
            # Collect and store metrics
            await collect_and_store()
            # Print the collected metrics
            print("Metrics collected")
        except Exception as e:
            # Don't crash the loop on error — just log and continue
            print(f"Monitor error: {e}")
        # Wait for 10 seconds before collecting next metrics
        await asyncio.sleep(60)