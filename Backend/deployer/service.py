import subprocess
import os

# This function is used to create a systemd service file for the application and start the application
def create_service(app_name: str, path: str, stack: str, port: int, user: str, env_vars: dict = {}) -> dict:
    service_file = f"/etc/systemd/system/{app_name}.service"
    
    # Determine the correct exec_start command based on the stack
    if stack in ["fastapi", "flask", "python"]:
        exec_start = f"{path}/venv/bin/uvicorn main:app --host 0.0.0.0 --port {port}"
    elif stack in ["express", "node", "nextjs", "koa"]:
        exec_start = f"/usr/bin/node {path}/index.js"
    else:
        return {"success": False, "error": f"Unsupported stack: {stack}"}

    # Generating the environment variables
    env_vars_str = ""
    for key, value in env_vars.items():
        env_vars_str += f"Environment=\"{key}={value}\"\n"

    # Setting up the service content for the application (Only for ubuntu). 
    service_content = f"""[Unit]
Description={app_name} — deployed by Nexus
After=network.target

[Service]
User={user}
WorkingDirectory={path}
Environment="PORT={port}"
{env_vars_str}
ExecStart={exec_start}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""

    # Write service file using sudo tee — direct open() won't have permission
    result = subprocess.run(
        ["sudo", "tee", service_file],
        input=service_content,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to write service file: {result.stderr}"}

    # Reload systemd
    result = subprocess.run(["sudo", "systemctl", "daemon-reload"], capture_output=True, text=True)
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to reload systemd: {result.stderr}"}

    # Enable service
    result = subprocess.run(["sudo", "systemctl", "enable", app_name], capture_output=True, text=True)
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to enable service: {result.stderr}"}

    # Start service
    result = subprocess.run(["sudo", "systemctl", "start", app_name], capture_output=True, text=True)
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to start service: {result.stderr}"}

    return {"success": True, "service_file": service_file}