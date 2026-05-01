import subprocess
import os
import uuid

def clone_repo(repo_url: str) -> dict:
    base_path = "/tmp/nexus-scan"
    scan_id = str(uuid.uuid4())
    clone_path = f"{base_path}/{scan_id}"
    
    # Create /tmp/nexus-scan if it doesn't exist
    os.makedirs(base_path, exist_ok=True)
    
    # Clone the repo
    result = subprocess.run(
        ["git", "clone", repo_url, clone_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        return {"success": True, "path": clone_path, "scan_id": scan_id}
    else:
        return {"success": False, "error": result.stderr}