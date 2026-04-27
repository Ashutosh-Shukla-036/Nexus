import os
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

        else:
            return {"stack": "unknown", "language": "unknown"}
    return {"stack": "unknown", "language": "unknown"}
