# Nexus Backend — v1.1 Documentation

> A self-hosted PaaS (like Coolify / Render) that runs on your machine.
> Deploy apps from GitHub, manage systemd services, view live logs, monitor system metrics — all from one dashboard.

---

## Architecture

```
Browser (React + Vite)  ← frontend (not started yet)
        ↓
Nginx (port 80)  ← reverse proxy for deployed apps
        ↓
FastAPI (port 8000)  ← Nexus backend API
        ↓
┌──────────────────────────────────────────┐
│  PostgreSQL  │  systemd  │  journalctl   │
└──────────────────────────────────────────┘
```

**Stack:** FastAPI · asyncpg · PostgreSQL · Nginx · systemd · psutil

---

## Project Structure

```
Backend/
├── main.py                 → app entry point, lifespan, CORS, logging middleware
├── db.py                   → asyncpg connection pool + table creation
├── logger.py               → centralized logging (file + stdout)
├── requirements.txt        → Python dependencies
├── .env                    → DATABASE_URL, NEXUS_USER
├── .gitignore
│
├── routes/
│   ├── apps.py             → deploy, scan, list, get, delete apps
│   ├── services.py         → register, start/stop/restart, enable/disable, delete services
│   ├── metrics.py          → system metrics (CPU, RAM, disk)
│   └── logs.py             → real-time log streaming via WebSocket
│
├── deployer/
│   ├── clone.py            → git clone repo to /tmp/nexus-scan/<scan_id>
│   ├── detect.py           → stack detection + entry point detection
│   ├── setup.py            → install dependencies (pip/npm) + build step
│   ├── service.py          → generate systemd .service file, enable + start
│   └── nginx.py            → generate nginx config (proxy or static), enable + reload
│
└── workers/
    └── monitor.py          → background: collect metrics every 60s, cleanup temp scans
```

---

## Database Schema (PostgreSQL)

### `apps`
| Column       | Type      | Default              | Notes                          |
|-------------|-----------|----------------------|--------------------------------|
| id          | UUID (PK) | `gen_random_uuid()`  |                                |
| name        | TEXT      | NOT NULL, UNIQUE     | app identifier (alphanumeric + hyphens) |
| repo_url    | TEXT      | NOT NULL             | GitHub repo URL                |
| port        | INTEGER   | NOT NULL             | port the app listens on        |
| domain      | TEXT      | nullable             | auto-set to `<name>.localhost` |
| subfolder   | TEXT      | nullable             | subfolder within the repo      |
| status      | TEXT      | `'stopped'`          | `pending → deploying → running / static / failed` |
| app_type    | TEXT      | `'service'`          | `'service'` (systemd) or `'static'` (nginx only) |
| created_at  | TIMESTAMP | `now()`              |                                |

### `metrics`
| Column      | Type      | Default              |
|------------|-----------|----------------------|
| id         | UUID (PK) | `gen_random_uuid()`  |
| cpu        | FLOAT     |                      |
| ram        | FLOAT     |                      |
| disk       | FLOAT     |                      |
| recorded_at| TIMESTAMP | `now()`              |

> Metrics older than **1 hour** are auto-deleted on each collection cycle.

### `uptime_checks`
| Column        | Type      | Default              | Notes                          |
|--------------|-----------|----------------------|--------------------------------|
| id           | UUID (PK) | `gen_random_uuid()`  |                                |
| app_id       | UUID (FK) | REFERENCES apps(id)  | `ON DELETE CASCADE`            |
| status_code  | INTEGER   |                      |                                |
| response_time| FLOAT     |                      |                                |
| checked_at   | TIMESTAMP | `now()`              |                                |

### `services`
| Column     | Type      | Default              |
|-----------|-----------|----------------------|
| id        | UUID (PK) | `gen_random_uuid()`  |
| name      | TEXT      | NOT NULL, UNIQUE     |
| enabled   | BOOLEAN   | `true`               |
| created_at| TIMESTAMP | `now()`              |

---

## API Routes

### Health Check
| Method | Path       | Description       |
|--------|-----------|-------------------|
| GET    | `/health` | Returns `{"status": "ok"}` |

---

### Metrics — `/metrics`

| Method | Path                | Description                              |
|--------|---------------------|------------------------------------------|
| GET    | `/metrics/`         | Get all metrics (sorted newest first)    |
| POST   | `/metrics/collect`  | Manually trigger metric collection       |

**GET `/metrics/`** → Returns:
```json
[
  { "cpu": 12.5, "ram": 45.2, "disk": 67.8, "recorded_at": "2026-05-03T12:00:00" }
]
```

**POST `/metrics/collect`** → Returns:
```json
{ "cpu": 12.5, "ram": 45.2, "disk": 67.8, "status": "collected" }
```

---

### Services — `/services`

| Method | Path                              | Description                          |
|--------|-----------------------------------|--------------------------------------|
| GET    | `/services/`                      | List all tracked services + live status |
| POST   | `/services/add`                   | Register a systemd service in Nexus  |
| POST   | `/services/{name}/start`          | Start a service                      |
| POST   | `/services/{name}/stop`           | Stop a service                       |
| POST   | `/services/{name}/restart`        | Restart a service                    |
| POST   | `/services/{name}/enable`         | Enable service on boot               |
| POST   | `/services/{name}/disable`        | Disable service on boot              |
| DELETE | `/services/{name}`                | Remove service from Nexus            |

**POST `/services/add`** — Request body:
```json
{ "name": "my-service", "enabled": true }
```

**GET `/services/`** → Returns:
```json
[
  { "id": "uuid", "name": "nginx", "enabled": true, "status": "active" }
]
```

> The `status` field is queried **live** from `systemctl is-active` on every request.

**DELETE `/services/{name}`** — Guards:
- Cannot delete a **running** service → stop it first
- Cannot delete an **enabled** service → disable it first

---

### Logs — `/logs` (WebSocket)

| Protocol  | Path               | Description                            |
|-----------|--------------------|----------------------------------------|
| WebSocket | `/logs/{name}`     | Real-time log streaming via journalctl |

- Streams output of `sudo journalctl -u <name> -f -n 50`
- Sends last 50 lines on connect, then streams new lines
- Process is killed when the client disconnects

---

### Apps — `/apps`

| Method | Path              | Description                          |
|--------|-------------------|--------------------------------------|
| GET    | `/apps/`          | List all deployed apps               |
| GET    | `/apps/{name}`    | Get single app details               |
| POST   | `/apps/scan`      | Clone repo temporarily, return folder list |
| POST   | `/apps/deploy`    | Full deployment pipeline (async)     |
| DELETE | `/apps/{name}`    | Full cleanup + delete                |

**POST `/apps/scan`** — Request body:
```json
{ "repo_url": "https://github.com/user/repo.git" }
```
Returns:
```json
{ "status": "ok", "scan_id": "uuid", "folders": ["frontend", "backend", "docs"] }
```

**POST `/apps/deploy`** — Request body:
```json
{
  "name": "my-app",
  "repo_url": "https://github.com/user/repo.git",
  "port": 3001,
  "scan_id": "uuid-from-scan",
  "subfolder": "backend",
  "env_vars": { "NODE_ENV": "production" }
}
```
Returns immediately (deployment runs in background):
```json
{
  "status": "deploying",
  "message": "Deployment started in background",
  "check_status": "/apps/my-app"
}
```

**Validations before deploy:**
- `name` must match `^[a-zA-Z0-9-]+$`
- Port not already taken in DB
- Port not already in use on system (socket check)
- App name not already exists
- App folder doesn't already exist at `/srv/apps/<name>`
- Scan ID must exist at `/tmp/nexus-scan/<scan_id>`

---

## Deployment Pipeline

The full deployment runs **asynchronously** as a background task via `asyncio.create_task()`.

```
Step  Action                                  Module
────  ──────────────────────────────────────  ──────────────
  1   Validate (port, name, scan_id)          routes/apps.py
  2   INSERT into apps (status = 'pending')   routes/apps.py
  3   Return 200 immediately                  routes/apps.py

  ─── Background task starts ───
  4   UPDATE status → 'deploying'             routes/apps.py
  5   Move /tmp/nexus-scan/<id> → /srv/apps/  routes/apps.py
  6   Detect stack (FastAPI/Flask/Express…)    deployer/detect.py
  7   Detect entry point + start command      deployer/detect.py
  8   Install dependencies (pip/npm)          deployer/setup.py
  9   Build (Next.js / React static only)     deployer/setup.py
 10   Create systemd service (or skip)        deployer/service.py
 11   Create nginx config                     deployer/nginx.py
 12   UPDATE status → 'running' or 'static'   routes/apps.py
```

**On failure at any step:**
- Status is set to `'failed'`
- Full rollback executes (systemd stop/disable/rm, nginx cleanup, rm app folder)
- Static apps skip systemd cleanup during rollback

---

## Delete Pipeline

```
Step  Action
────  ──────────────────────────────────────────────
  1   Verify app exists in DB
  2   systemctl stop + disable  (skipped for static)
  3   rm /etc/systemd/system/<name>.service  (skipped for static)
  4   systemctl daemon-reload  (skipped for static)
  5   rm /etc/nginx/sites-enabled/<name>
  6   rm /etc/nginx/sites-available/<name>
  7   systemctl reload nginx
  8   rm -rf /srv/apps/<name>
  9   DELETE FROM apps WHERE name = <name>
```

---

## Stack Detection (`deployer/detect.py`)

### `detech_stack(path)` — Identifies the framework

**Detection priority:**

| Priority | Indicator             | Stack Detected     | Language |
|----------|----------------------|--------------------|----------|
| 1        | `requirements.txt` → fastapi | `fastapi`      | python   |
| 1        | `requirements.txt` → flask   | `flask`        | python   |
| 1        | `requirements.txt` → django  | `django`       | python   |
| 2        | `package.json` → express     | `express`      | node     |
| 2        | `package.json` → next        | `nextjs`       | node     |
| 2        | `package.json` → @nestjs/core| `nestjs`       | node     |
| 2        | `package.json` → koa         | `koa`          | node     |
| 2        | `package.json` → react (only)| `react-static` | node     |

> Python deps are parsed using `packaging.requirements.Requirement` for accuracy.
> Node deps merge both `dependencies` and `devDependencies`.

### `detect_entry_point(path, stack, port)` — Determines the start command

| Stack         | Entry Point Resolution                                              | Command                                              |
|--------------|---------------------------------------------------------------------|------------------------------------------------------|
| fastapi/flask | `main.py` → `app.py` → `server.py` (scans for `FastAPI()` / `Flask()` instance name) | `<path>/venv/bin/uvicorn <module>:<instance> --host 0.0.0.0 --port <port>` |
| django        | Finds `wsgi.py` inside Django project subfolder                     | `<path>/venv/bin/gunicorn <project>.wsgi:application --bind 0.0.0.0:<port>` |
| express/koa/nestjs | `scripts.start` → `index.js` → `server.js` → `app.js`         | `npm run start` or `node <entry>`                    |
| nextjs        | Always uses npm scripts                                             | `npm run start`                                      |
| react-static  | N/A — no process needed                                             | `STATIC` (nginx serves files directly)               |

---

## Dependency Setup (`deployer/setup.py`)

### `setup_app(path, language)`

| Language | Steps                                                    |
|----------|----------------------------------------------------------|
| python   | `python3 -m venv <path>/venv` → `pip install -r requirements.txt` |
| node     | `npm install`                                            |

### `build_app(path, stack)`
- Runs `npm run build` for `nextjs` and `react-static` stacks
- React static: checks for `/dist` (Vite) or `/build` (CRA) after build

---

## Systemd Service (`deployer/service.py`)

### `create_service(app_name, path, command, port, user, env_vars)`

Generates a `.service` file at `/etc/systemd/system/<name>.service`:
```ini
[Unit]
Description=<name> — deployed by Nexus
After=network.target

[Service]
User=<user>
WorkingDirectory=<path>
Environment="PORT=<port>"
Environment="KEY=VALUE"          ← custom env_vars
ExecStart=<detected command>
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then runs: `daemon-reload` → `enable` → `start`

> **Static apps skip service creation entirely** — nginx serves files directly.

---

## Nginx Config (`deployer/nginx.py`)

### `create_nginx_config(app_name, port, app_type, static_root)`

**Service apps** (proxy):
```nginx
server {
    listen 80;
    server_name <name>.localhost;

    location / {
        proxy_pass http://127.0.0.1:<port>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Static apps** (direct file serving):
```nginx
server {
    listen 80;
    server_name <name>.localhost;

    root <static_root>;      ← /srv/apps/<name>/dist or /build
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then: write to `sites-available` → symlink to `sites-enabled` → `nginx -t` → `systemctl reload nginx`

---

## Background Workers (`workers/monitor.py`)

Runs as an `asyncio.create_task()` in the FastAPI lifespan:

| Task                  | Interval | Description                                      |
|-----------------------|----------|--------------------------------------------------|
| Metric collection     | 60s      | CPU, RAM, disk → INSERT into metrics table       |
| Metrics cleanup       | 60s      | DELETE metrics older than 1 hour                 |
| Temp scan cleanup     | 60s      | Delete `/tmp/nexus-scan/*` folders older than 1hr |

---

## Application Entry Point (`main.py`)

### Lifespan
- **Startup:** Connect to DB → Create tables → Start background monitor
- **Shutdown:** Cancel monitor task → Disconnect from DB

### Middleware
- **CORS:** Allows `http://localhost:5173` (Vite dev server)
- **Logging:** Logs every `METHOD /path` and response status code

### Routers
```python
app.include_router(metrics.router)    # /metrics
app.include_router(services.router)   # /services
app.include_router(logs.router)       # /logs (WebSocket)
app.include_router(apps.router)       # /apps
```

---

## Logging (`logger.py`)

- File output: `/var/log/nexus/nexus.log`
- Console output: `stdout`
- Format: `%(asctime)s — %(levelname)s — %(message)s`

---

## Environment Variables (`.env`)

| Variable       | Description                    | Example                                        |
|---------------|--------------------------------|------------------------------------------------|
| `DATABASE_URL` | PostgreSQL connection string   | `postgresql://nexus_user:nexus123@localhost/nexus` |
| `NEXUS_USER`   | Linux user for systemd services | `ashutoshshukla`                                |

---

## Dependencies (`requirements.txt`)

| Package           | Purpose                              |
|-------------------|--------------------------------------|
| fastapi           | Web framework                        |
| uvicorn           | ASGI server                          |
| asyncpg           | Async PostgreSQL driver              |
| websockets        | WebSocket support                    |
| python-dotenv     | Load `.env` file                     |
| psutil            | System metrics (CPU, RAM, disk)      |
| redis             | Redis client (reserved for future)   |
| python-multipart  | Form data parsing                    |
| packaging         | Parse `requirements.txt` entries     |

---

## Server Setup

### Sudoers Configuration
Add to `/etc/sudoers` via `sudo EDITOR=vim visudo`:
```
<user> ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl, /usr/bin/tee, /usr/sbin/nginx, /usr/bin/ln, /usr/bin/rm
```

### Required System Services
- PostgreSQL (running on default port 5432)
- Nginx (running on port 80)

### Running the Backend
```bash
cd ~/nexus/Backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Future Roadmap

### Frontend (not started)
- **Dashboard** → server health cards, metrics charts
- **Services** → list + control buttons + live logs
- **Apps** → deployed apps + deploy new app form
- **Logs** → real-time log viewer per service

### Security & Production
- Authentication (JWT) — API is currently open
- Rate limiting
- Input validation hardening
- HTTPS via Let's Encrypt
- Make Nexus itself a systemd service
