import subprocess
import os

# Setting python env and running dependencies 
def setup_app(path: str, stack: str) -> dict:
    # Check if python or node or other language is used
    if stack == "python":
        venv_path = f"{path}/venv"
        
        # Create virtual environment
        result = subprocess.run(["python3", "-m", "venv", venv_path], capture_output=True, text=True)
        if result.returncode != 0:
            return {"success": False, "error": f"Failed to create venv: {result.stderr}"}
        
        # Install dependencies
        if os.path.exists(f"{path}/requirements.txt"):
            result = subprocess.run([f"{venv_path}/bin/pip", "install", "-r", f"{path}/requirements.txt"], capture_output=True, text=True)
            if result.returncode != 0:
                return {"success": False, "error": f"Failed to install dependencies: {result.stderr}"}
        else:
            return {"success": False, "error": "requirements.txt not found"}
        
        return {"success": True}
    elif stack == "node":
        # Install dependencies
        if os.path.exists(f"{path}/package.json"):
            result = subprocess.run(["npm", "install"], cwd=path, capture_output=True, text=True)
            if result.returncode != 0:
                return {"success": False, "error": f"Failed to install dependencies: {result.stderr}"}
        else:
            return {"success": False, "error": "package.json not found"}
        
        return {"success": True}
    else:
        return {"success": False, "error": "Unsupported stack"}
