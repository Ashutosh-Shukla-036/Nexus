import subprocess
import os

def clone_repo(repo_url: str, app_name: str) -> dict:
    base_path = "/srv/apps"
    app_path = f"{base_path}/{app_name}"
    
    # Create /srv/apps if it doesn't exist
    os.makedirs(base_path, exist_ok=True)
    
    # If app folder already exists — fail
    if os.path.exists(app_path):
        return {"success": False, "error": f"{app_name} already exists"}
    
    # Clone the repo
    result = subprocess.run(
        ["git", "clone", repo_url, app_path],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        return # you fill this
    else:
        return # you fill this — hint: result.stderr has the error message