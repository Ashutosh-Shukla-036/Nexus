import subprocess
import os

# This function is used to create a systemd service file for the application and start the application
def create_service(app_name: str, path: str, command: str, port: int, user: str, env_vars: dict = {}) -> dict:
    service_file = f"/etc/systemd/system/{app_name}.service"
    
    # Use the detected command directly as ExecStart
    exec_start = command

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