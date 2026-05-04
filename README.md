# Nexus — Self-Hosted PaaS Engine

Nexus is a lightweight, self-hosted Platform-as-a-Service (PaaS) designed to orchestrate and manage web applications and system services directly on your own Linux server. It acts as a localized alternative to services like Heroku or Vercel, giving you full control over your infrastructure with a beautiful, real-time observability dashboard.

## 🚀 Features

- **Automated Deployments:** Deploy applications directly from public GitHub repositories.
- **Smart Stack Detection:** Automatically detects entry points for Node.js (`npm start`, `server.js`), Python (`main.py`, `app.py`, `requirements.txt`), and static HTML applications.
- **Systemd Orchestration:** Converts deployed dynamic applications into native Linux `systemd` services for robust background execution and automatic restarts on crash/boot.
- **Nginx Reverse Proxy Automation:** Automatically generates and reloads Nginx server blocks to route traffic from specific ports/domains to your applications.
- **Service Management:** Full control plane to start, stop, restart, enable, and disable any tracked `systemd` service on your host machine.
- **Real-Time Observability:** 
  - Live system metrics (CPU, RAM, Disk) visualization.
  - WebSocket-powered live log streaming using native `journalctl`.
  - Automatic Nginx traffic log and Nexus deployment log routing.

---

## 📸 Screenshots

### Dashboard
![Dashboard](screenshots/Dashboard.png)

### Applications
![Applications](screenshots/Applications.png)

### Services
![Services](screenshots/Services.png)

### Logs
![Logs](screenshots/Logs.png)

---

## 🛠️ Tech Stack

**Backend Engine**
- **Framework:** Python 3.10+ with [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** PostgreSQL (via `asyncpg`)
- **System Integrations:** `systemd` (process management), `nginx` (routing), `psutil` (hardware metrics), `journalctl` (logging)

**Frontend Dashboard**
- **Framework:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4 + Lucide Icons
- **State Management:** TanStack React Query v5
- **Data Visualization:** Recharts

---

## 📂 Project Structure

```text
nexus/
├── Backend/                 # Python FastAPI Engine
│   ├── deployer/            # Core deployment pipeline (clone, detect, build, nginx)
│   ├── routes/              # API endpoints (apps, services, metrics, logs)
│   ├── workers/             # Background tasks (hardware metric polling)
│   ├── db.py                # PostgreSQL connection pooling and schema
│   ├── main.py              # Application entry point
│   └── Docs.md              # Deep-dive internal backend architecture
└── Frontend/                # React Vite Dashboard
    ├── src/api/             # Axios API client and WebSocket URL builder
    ├── src/components/      # Reusable UI (Sidebar, Toast, Modal, Buttons)
    ├── src/pages/           # Main views (Dashboard, Applications, Services, Logs)
    └── src/App.tsx          # Router configuration
```

---

## ⚙️ Installation & Setup

### Prerequisites
Before running Nexus, ensure your Linux host machine has the following installed:
- **Python 3.10+** & `pip`
- **Node.js 20+** & `npm`
- **PostgreSQL** (running and accessible)
- **Nginx** (installed and running)
- **Git** (for cloning user applications)
- Ensure the user running the backend has `sudo` privileges without a password prompt for specific commands (like `systemctl`, `journalctl`, and Nginx reloads).
- If `sudo` priveliges are not set, then in visudo add `<yourusername> ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/journalctl, /usr/bin/tee, /usr/sbin/nginx, /usr/bin/ln, /usr/bin/rm` (replace `<yourusername>` with your username) 
- If you are in windows you just setup WSL in you system and perform all the above steps in WSL. I have tested it on windows 11 with WSL 22.04 and it works perfectly.

### 1. Database Configuration
Create a PostgreSQL database and user for Nexus:
```sql
CREATE DATABASE nexus;
CREATE USER nexus_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE nexus TO nexus_user;
```

### 2. Backend Setup
```bash
cd Nexus/Backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Create a .env file and add:
# DATABASE_URL=postgresql://nexus_user:your_password@localhost/nexus
# NEXUS_USER=your_linux_username

# Start the backend engine
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Note: The backend will automatically create the required PostgreSQL tables on startup.*

### 3. Frontend Setup
Open a **new** terminal window:
```bash
cd Nexus/Frontend

# Install dependencies
npm install

# Start the dashboard
npm run dev
```
Navigate to `http://localhost:5173` in your browser.

---

## ⚠️ Security Notice

**Currently, the Nexus API does not implement Authentication (JWT/OAuth).** 
Because Nexus executes arbitrary code from GitHub and has `sudo` privileges to modify system services, **DO NOT expose port `8000` or `5173` to the public internet.**

It is strongly recommended to bind the backend strictly to `localhost` and access the dashboard through an SSH Tunnel or a secure VPN (like Tailscale/Wireguard) until an authentication layer is implemented.

---

## 📖 Further Reading
For a detailed breakdown of the deployment pipeline, app detection logic, and PostgreSQL schemas, please see the internal documentation at `Backend/Docs.md`.


## Note Nexus can deploy Nexus itself
A running Nexus instance can deploy another instance of Nexus itself. Then you can access the newly deployed nexus from nexusbackend.localhost and nexusfrontend.localhost this prcoess is called as dogfooding.

