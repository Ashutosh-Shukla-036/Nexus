### Deployer plan

~/nexus/Backend/
├── deployer/
│   ├── __init__.py
│   ├── clone.py        # git clone logic
│   ├── setup.py        # venv + pip install / npm install
│   ├── service.py      # generate + register systemd service file
│   └── detect.py       # detect tech stack from repo contents

### Deployment pipeline 

1. detect.py   → is this FastAPI or Node.js?
2. clone.py    → git clone to /srv/apps/<name>
3. setup.py    → install dependencies
4. service.py  → create systemd service file
5. nginx.py    → create nginx config
6. systemctl enable + start
7. Update apps table in DB