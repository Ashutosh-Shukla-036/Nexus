import subprocess

def create_nginx_config(app_name: str, port: int) -> dict:
    config_content = f"""server {{
    listen 80;
    server_name {app_name}.localhost;

    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
"""
    config_file = f"/etc/nginx/sites-available/{app_name}"
    enabled_file = f"/etc/nginx/sites-enabled/{app_name}"

    # Write config file
    result = subprocess.run(
        ["sudo", "tee", config_file],
        input=config_content,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to write nginx config: {result.stderr}"}

    # Create symlink
    result = subprocess.run(
        ["sudo", "ln", "-sf", config_file, enabled_file],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to enable site: {result.stderr}"}

    # Test nginx config
    result = subprocess.run(
        ["sudo", "nginx", "-t"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": f"Invalid nginx config: {result.stderr}"}

    # Reload nginx
    result = subprocess.run(
        ["sudo", "systemctl", "reload", "nginx"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": f"Failed to reload nginx: {result.stderr}"}

    return {"success": True, "domain": f"{app_name}.localhost"}