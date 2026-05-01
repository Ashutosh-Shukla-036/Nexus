### Deployer plan
```
~/nexus/Backend/
├── deployer/
│   ├── __init__.py
│   ├── clone.py        
│   ├── setup.py        
│   ├── service.py      
│   ├── detect.py       
│   └── nginx.py        
├── routes/
│   ├── apps.py        
│   ├── metrics.py      
│   ├── services.py     
│   └── logs.py         
└── workers/
    └── monitor.py      
```

### Deployment pipeline 
```
1. detect.py   → is this FastAPI or Node.js?
2. clone.py    → git clone to /srv/apps/<name>
3. setup.py    → install dependencies
4. service.py  → create systemd service file
5. nginx.py    → create nginx config
6. systemctl enable + start
7. Update apps table in DB
```

### Delete flow
```
1. systemctl stop <app>
2. systemctl disable <app>
3. rm /etc/systemd/system/<app>.service
4. systemctl daemon-reload
5. rm -rf /srv/apps/<app>
6. rm /etc/nginx/sites-enabled/<app>
7. rm /etc/nginx/sites-available/<app>
8. nginx reload
9. DELETE FROM apps WHERE name = <app>
```

### Add these to /etc/sudoers file using sudo EDITOR=vim visudo
```
ashutosh-dev ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl, /usr/bin/tee, /usr/sbin/nginx
```

### Update routes/apps.py
```
POST /apps/scan          → clone repo temporarily, return folder list
POST /apps/deploy        → full deployment pipeline
GET  /apps/              → list all deployed apps
GET  /apps/{app_name}    → get single app details
DELETE /apps/{app_name}  → full cleanup
```

### deploy flow
```
async def deploy(request):
    1. Validate input (name, repo_url, port, subfolder)
    2. Check port not taken (DB + socket)
    3. clone_repo()
    4. detect_stack()
    5. setup_app()
    6. create_service()
    7. create_nginx_config()
    8. INSERT into apps table
    9. Return success
```

### deploy pipeline
```
1) Check port not taken in DB
2) Check port not taken on system using socket
3) Move /tmp/nexus-scan/<scan_id> to /srv/apps/<name>
4) Set app_path — if subfolder: f"/srv/apps/{name}/{subfolder}" else f"/srv/apps/{name}"
5) detect.detech_stack(app_path)
6) setup.setup_app(app_path, stack)
7) service.create_service(name, app_path, stack, port, user)
8) nginx.create_nginx_config(name, port)
9) INSERT into apps table
10) Return success
```

### Remove app
```
1. stop <app>
2. disable <app>
3. rm -rf /srv/apps/<app>
4. rm /etc/systemd/system/<app>.service
5. rm -rf /etc/nginx/sites-available/<app>
6. rm -rf /etc/nginx/sites-enabled/<app>
7. nginx reload
8. delete from DB
```

### Nexus — Full Project Summary
```
What Nexus is:
A self-hosted PaaS (like Coolify/Render) that runs on your machine. Deploy apps from GitHub, manage systemd services, view live logs, monitor system metrics — all from one dashboard.

Architecture:
Browser (React + Vite)
        ↓
Nginx (port 80) — reverse proxy
        ↓
FastAPI (port 8000) — Nexus backend
        ↓
┌─────────────────────────────┐
│  PostgreSQL  │  Redis  │ systemd │
└─────────────────────────────┘

Backend location: ~/nexus/Backend/
Stack: FastAPI + asyncpg + PostgreSQL + Nginx + systemd + React frontend (not started yet)

Complete backend structure:
Backend/
├── main.py              ✅
├── db.py                ✅
├── logger.py            ✅
├── requirements.txt     ✅
├── .env                 ✅
├── routes/
│   ├── metrics.py       ✅
│   ├── services.py      ✅
│   ├── logs.py          ✅
│   └── apps.py          ✅
├── deployer/
│   ├── detect.py        ✅
│   ├── clone.py         ✅
│   ├── setup.py         ✅
│   ├── service.py       ✅
│   └── nginx.py         ✅
└── workers/
    └── monitor.py       ✅

Database schema (PostgreSQL):
sqlapps (id, name, repo_url, port, domain, subfolder, status, created_at)
metrics (id, cpu, ram, disk, recorded_at)
uptime_checks (id, app_id, status_code, response_time, checked_at)
services (id, name, enabled, created_at)

All API routes:
GET    /health                    → health check
GET    /metrics/                  → get metrics history
POST   /metrics/collect           → manually collect metrics

GET    /services/                 → list tracked services + live status
POST   /services/add              → register service in Nexus
POST   /services/{name}/start     → start service
POST   /services/{name}/stop      → stop service
POST   /services/{name}/restart   → restart service
POST   /services/{name}/enable    → enable on boot
POST   /services/{name}/disable   → disable on boot
DELETE /services/{name}           → remove from Nexus

WS     /logs/{name}               → real-time log streaming via WebSocket

GET    /apps/                     → list deployed apps
GET    /apps/{name}               → get single app
POST   /apps/scan                 → clone repo, return folder list
POST   /apps/deploy               → full deployment pipeline
DELETE /apps/{name}               → full cleanup

Deployment pipeline:
1. Port check (DB + socket)
2. git clone → /tmp/nexus-scan/<scan_id>
3. detect stack (FastAPI/Flask/Express/Next.js)
4. pip install / npm install
5. Generate systemd service file
6. Generate nginx config
7. systemctl enable + start
8. INSERT into apps table
9. Rollback everything if any step fails

Delete pipeline:
1. systemctl stop + disable
2. rm service file
3. systemctl daemon-reload
4. rm nginx sites-available + sites-enabled
5. nginx reload
6. rm -rf /srv/apps/<name>
7. DELETE FROM apps

Background workers:

Metrics collected every 60 seconds automatically
Temp scan folders cleaned up every hour
Metrics older than 1 hour deleted automatically


Sudoers configured for:
/usr/bin/systemctl
/usr/bin/journalctl
/usr/bin/tee
/usr/sbin/nginx

What's pending:
Testing:

Full deploy pipeline not tested yet — pip hanging on LeapMile server
Need to test on WSL or fix pip issue

Frontend (not started):
Pages needed:
- Dashboard    → server health cards, metrics charts
- Services     → list + control buttons + live logs
- Apps         → deployed apps + deploy new app form
- Logs         → real-time log viewer per service
After frontend:

Authentication (JWT) — anyone can hit API right now
Rate limiting
Input validation
HTTPS via Let's Encrypt
Make Nexus itself a systemd service


Key files to share in new chat:

main.py
db.py
routes/apps.py
deployer/service.py
```


### Entry Point Detection — Full Plan
```
Supported stacks and detection strategy:
Python:
  detect:   requirements.txt exists
  framework: scan requirements.txt for fastapi/flask/django
  entry:    main.py → app.py → server.py → wsgi.py → Procfile
  command:
    fastapi/flask → uvicorn <entry>:<instance> --host 0.0.0.0 --port <port>
    django        → gunicorn <project>.wsgi:application --bind 0.0.0.0:<port>

Node.js:
  detect:   package.json exists
  framework: scan dependencies for express/koa/nestjs/next/react
  entry:    package.json "scripts.start" → index.js → server.js → app.js
  command:
    express/koa/nestjs → node <entry>
    next.js            → npm run build && npm run start
    plain node         → node <entry>

React (Static):
  detect:   package.json exists + react in dependencies + NO server framework
  build:    npm run build → produces /dist or /build folder
  serve:    nginx serves static files directly — no process needed
  command:  STATIC (no systemd service needed — just nginx config pointing to dist/)

Detection priority order:
1. Has requirements.txt?
   → Python project
   → scan for fastapi, flask, django

2. Has package.json?
   → Node/React project
   → check dependencies:
     - has "react" but no express/next → STATIC React
     - has "next" → Next.js
     - has "express" → Express
     - has "@nestjs/core" → NestJS
     - has "koa" → Koa

3. Neither?
   → unknown, reject with clear error

Entry point detection for Python:
Priority:
1. main.py   → uvicorn main:app
2. app.py    → uvicorn app:app
3. server.py → uvicorn server:app
4. wsgi.py   → gunicorn wsgi:application (Django)
5. Procfile  → parse "web:" line

Instance name detection:
- scan file for: "= FastAPI()" or "= Flask(__name__)"
- extract variable name before =
- default to "app" if not found

Entry point detection for Node.js:
Priority:
1. package.json "scripts.start" exists → use that command
2. index.js exists → node index.js
3. server.js exists → node server.js
4. app.js exists → node app.js
5. none found → reject with clear error

Next.js special case:
→ always: npm run build && npm run start
→ or: node .next/standalone/server.js

React static special case:
Detection:
- has react in dependencies
- does NOT have express, next, koa, nestjs

Build:
- npm run build
- check for /dist folder (Vite) or /build folder (CRA)

Nginx config:
- root /srv/apps/<name>/dist (or /build)
- try_files $uri $uri/ /index.html
- no proxy_pass needed

Systemd:
- NO service file created
- nginx serves files directly
- status tracked as "static"

New column needed in apps table:
sqlALTER TABLE apps ADD COLUMN app_type TEXT DEFAULT 'service';
-- values: 'service' (has systemd) or 'static' (nginx only)

Changes needed in code:
detect.py   → add detect_entry_point(path, stack) function
service.py  → use detected command instead of hardcoded uvicorn
nginx.py    → handle static case (root instead of proxy_pass)
apps.py     → skip create_service() if app_type == 'static'
db.py       → add app_type column to apps table

Implementation order when ready:
1. Update detect.py — detect_entry_point()
2. Update db.py — add app_type column
3. Update service.py — use detected command
4. Update nginx.py — static vs proxy config
5. Update apps.py — skip systemd for static apps
6. Test each stack individually
```