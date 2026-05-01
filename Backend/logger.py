import logging
import os

# Create logs directory
os.makedirs("/var/log/nexus", exist_ok=True)

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(levelname)s — %(message)s",
    handlers=[
        logging.FileHandler("/var/log/nexus/nexus.log"),
        logging.StreamHandler()  # also print to terminal
    ]
)

logger = logging.getLogger("nexus")