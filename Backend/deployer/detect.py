import os
import re
import json
from packaging.requirements import Requirement

# Detech the what service is it.
def detech_stack(path: str) -> dict:
    # Check if it is python service
    has_requirements = os.path.exists(f"{path}/requirements.txt")
    # Check if it is Node.js service
    has_package_json = os.path.exists(f"{path}/package.json")

    if has_requirements:
        # detech if it is fastapi, flask or danjo service
        with open(f"{path}/requirements.txt", "r") as f:
            for line in f:
                line = line.strip()

                if not line or line.startswith("#"):
                    continue

                try:
                    req = Requirement(line)
                    name = req.name.lower()

                    if name == "fastapi":
                        return {"stack": "fastapi", "language": "python"}
                    elif name == "flask":
                        return {"stack": "flask", "language": "python"}
                    elif name == "django":
                        return {"stack": "django", "language": "python"}

                except Exception:
                    # skip invalid lines like -r other.txt
                    continue
        return {"stack": "unknown", "language": "unknown"}
    
    elif has_package_json:
        with open(f"{path}/package.json", "r") as f:
            try:
                data = json.load(f)
            except Exception:
                return False

        dependencies = data.get("dependencies", {})
        dev_dependencies = data.get("devDependencies", {})

        all_deps = {**dependencies, **dev_dependencies}

        # Normalize keys
        deps = {k.lower(): v for k, v in all_deps.items()}

        if "express" in deps:
            return {"stack": "express", "language": "node"}
        elif "next" in deps:
            return {"stack": "nextjs", "language": "node"}
        elif "nestjs" in deps or "@nestjs/core" in deps:
            return {"stack": "nestjs", "language": "node"}
        elif "koa" in deps:
            return {"stack": "koa", "language": "node"}
        elif "react" in deps:
            # React is present but no server framework → static React app
            return {"stack": "react-static", "language": "node"}
        else:
            return {"stack": "unknown", "language": "unknown"}
    return {"stack": "unknown", "language": "unknown"}


def _scan_python_file_for_instance(filepath: str) -> str:
    """Scan a Python file for FastAPI() or Flask() instantiation and return the variable name."""
    try:
        with open(filepath, "r") as f:
            content = f.read()
        
        # Match patterns like: app = FastAPI() or application = Flask(__name__)
        match = re.search(r'(\w+)\s*=\s*(?:FastAPI|Flask)\s*\(', content)
        if match:
            return match.group(1)
    except Exception:
        pass
    return "app"


def detect_entry_point(path: str, stack: str, port: int) -> dict:
    """Detect the correct start command for the given app path and stack."""

    # --- Python stacks: fastapi, flask ---
    if stack in ["fastapi", "flask"]:
        candidates = ["main.py", "app.py", "server.py"]
        for candidate in candidates:
            filepath = os.path.join(path, candidate)
            if os.path.exists(filepath):
                module = candidate.replace(".py", "")
                instance = _scan_python_file_for_instance(filepath)
                command = f"{path}/venv/bin/uvicorn {module}:{instance} --host 0.0.0.0 --port {port}"
                return {"command": command}
        
        return {"command": None, "error": "No entry point found"}

    # --- Django ---
    elif stack == "django":
        # Look for wsgi.py inside a subfolder (the Django project folder)
        for item in os.listdir(path):
            wsgi_path = os.path.join(path, item, "wsgi.py")
            if os.path.isdir(os.path.join(path, item)) and os.path.exists(wsgi_path):
                command = f"{path}/venv/bin/gunicorn {item}.wsgi:application --bind 0.0.0.0:{port}"
                return {"command": command}
        return {"command": None, "error": "No Django wsgi.py found"}

    # --- Node stacks: express, koa, nestjs ---
    elif stack in ["express", "koa", "nestjs"]:
        # Priority 1: package.json scripts.start
        pkg_path = os.path.join(path, "package.json")
        if os.path.exists(pkg_path):
            try:
                with open(pkg_path, "r") as f:
                    data = json.load(f)
                scripts = data.get("scripts", {})
                if "start" in scripts:
                    return {"command": "npm run start"}
            except Exception:
                pass
        
        # Priority 2-4: common entry files
        for candidate in ["index.js", "server.js", "app.js"]:
            if os.path.exists(os.path.join(path, candidate)):
                return {"command": f"node {candidate}"}
        
        return {"command": None, "error": "No entry point found"}

    # --- Next.js ---
    elif stack == "nextjs":
        return {"command": "npm run start"}

    # --- React static ---
    elif stack == "react-static":
        return {"command": "STATIC"}

    else:
        return {"command": None, "error": f"Unsupported stack: {stack}"}
