# EMCatalyst — Pharmaceutical Event Management System

A full-stack event management and compliance platform for Emcure Pharmaceuticals, migrated from Mendix Catalyst to a self-hosted Python + React stack.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.11+) |
| Database | PostgreSQL 15+ |
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth | JWT (OAuth2 password flow) |
| ORM | SQLAlchemy 2.x |
| Container | Docker + Docker Compose (optional) |

> **Note:** This project uses **FastAPI**, not Django. FastAPI is a modern, async-capable Python web framework with automatic OpenAPI docs.

---

## Features

- Event lifecycle management (Draft → Submitted → Approved → Completed)
- HCP Doctor MCL (Master Contact List) with FMV calculator
- Agreement sub-module inside each Event
- Masters: Brands, Meals, Cities, Specialities, Therapeutics, States, HCP Roles, Sponsorship Types, Document Types
- 8-tab Reports: Division-wise, State-wise, Event Type-wise, HCP Honorarium, Finance, CME, Audit Trail
- User management with role-based access (841 Emcure employees imported)
- Vendor & Invoice management
- Promotional events module

---

## Installation Guide

- [Linux (Ubuntu / Debian)](#linux-ubuntu--debian)
- [Windows](#windows)
- [macOS](#macos)
- [Docker (all platforms)](#docker-all-platforms)

---

## Linux (Ubuntu / Debian)

> Tested on Ubuntu 22.04 LTS and Debian 12. Commands are the same for both.

### Step 1 — Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Node.js 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Build tools (required for some Python packages)
sudo apt install -y build-essential libpq-dev git curl

# Verify
python3.11 --version
node --version
npm --version
psql --version
```

### Step 2 — Start PostgreSQL and create the database

```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Open PostgreSQL shell as the postgres superuser
sudo -u postgres psql
```

Inside the `psql` prompt:

```sql
CREATE DATABASE emcatalyst;
CREATE USER emcatalyst_user WITH PASSWORD 'emcatalyst_pass';
GRANT ALL PRIVILEGES ON DATABASE emcatalyst TO emcatalyst_user;
\q
```

### Step 3 — Clone the repository

```bash
git clone https://github.com/zidkid/emcatalyst-migration.git
cd emcatalyst-migration
```

### Step 4 — Backend setup

```bash
cd backend

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cp .env.example .env
nano .env          # or use: vim .env
```

Set these values in `.env`:

```env
DATABASE_URL=postgresql://emcatalyst_user:emcatalyst_pass@localhost:5432/emcatalyst
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
APP_NAME=EMCatalyst
```

Generate a secure SECRET_KEY:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Create the database tables:

```bash
python3 -c "from app.db.base import engine, Base; import app.models; Base.metadata.create_all(bind=engine); print('Tables created.')"
```

Start the backend server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

API is live at **http://localhost:8002** — docs at **http://localhost:8002/docs**

### Step 5 — Frontend setup

Open a **new terminal** (keep the backend running):

```bash
cd emcatalyst-migration/frontend

npm install
npm run dev
```

Frontend is live at **http://localhost:5173**

### Step 6 — Seed admin user

In the backend terminal (venv activated):

```bash
cd backend
python3 -c "
from app.db.base import SessionLocal, engine, Base
import app.models
Base.metadata.create_all(bind=engine)
from app.models.user import User, UserRole
from app.core.security import get_password_hash
db = SessionLocal()
if not db.query(User).filter(User.email == 'admin@emcure.com').first():
    db.add(User(email='admin@emcure.com', hashed_password=get_password_hash('Admin@123'),
                first_name='System', last_name='Administrator',
                role=UserRole.ADMINISTRATOR, is_active=True, is_superuser=True))
    db.commit()
    print('Admin created: admin@emcure.com / Admin@123')
db.close()
"
```

### Running as a background service on Linux (systemd)

To keep the backend running after you close the terminal, create a systemd service:

```bash
sudo nano /etc/systemd/system/emcatalyst-backend.service
```

Paste the following (update paths to match your setup):

```ini
[Unit]
Description=EMCatalyst FastAPI Backend
After=network.target postgresql.service

[Service]
User=your_linux_username
WorkingDirectory=/home/your_linux_username/emcatalyst-migration/backend
Environment="PATH=/home/your_linux_username/emcatalyst-migration/backend/venv/bin"
EnvironmentFile=/home/your_linux_username/emcatalyst-migration/backend/.env
ExecStart=/home/your_linux_username/emcatalyst-migration/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8002
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable emcatalyst-backend
sudo systemctl start emcatalyst-backend

# Check status
sudo systemctl status emcatalyst-backend

# View logs
sudo journalctl -u emcatalyst-backend -f
```

### Linux common issues

**`psycopg2` build error**
```bash
sudo apt install -y libpq-dev python3.11-dev
pip install psycopg2-binary
```

**`permission denied` connecting to PostgreSQL**
```bash
# Edit pg_hba.conf to allow local password auth
sudo nano /etc/postgresql/15/main/pg_hba.conf
# Change the local line from "peer" to "md5", then restart:
sudo systemctl restart postgresql
```

**Port 8002 already in use**
```bash
sudo lsof -i :8002
sudo kill -9 <PID>
```

**`node: command not found` after NodeSource install**
```bash
source ~/.bashrc
# or restart the terminal
```

---

## Windows

### Step 1 — Install prerequisites

Download and install each of the following:

| Software | Download |
|---|---|
| Python 3.11+ | https://www.python.org/downloads/ — tick **"Add Python to PATH"** during install |
| Node.js 20 LTS | https://nodejs.org/ |
| PostgreSQL 15 | https://www.postgresql.org/download/windows/ — note the password you set for `postgres` |
| Git | https://git-scm.com/download/win |

After installing, open **PowerShell** and verify:

```powershell
python --version
node --version
npm --version
psql --version
git --version
```

### Step 2 — Create the database

Open **pgAdmin** (installed with PostgreSQL) or open PowerShell and run:

```powershell
psql -U postgres -c "CREATE DATABASE emcatalyst;"
psql -U postgres -c "CREATE USER emcatalyst_user WITH PASSWORD 'emcatalyst_pass';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE emcatalyst TO emcatalyst_user;"
```

### Step 3 — Clone and set up

```powershell
git clone https://github.com/zidkid/emcatalyst-migration.git
cd "emcatalyst-migration"
```

### Step 4 — Backend setup

```powershell
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Create .env
copy .env.example .env
notepad .env
```

Fill in `.env`:

```env
DATABASE_URL=postgresql://emcatalyst_user:emcatalyst_pass@localhost:5432/emcatalyst
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
APP_NAME=EMCatalyst
```

Create tables and start:

```powershell
python -c "from app.db.base import engine, Base; import app.models; Base.metadata.create_all(bind=engine); print('Tables created.')"

uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### Step 5 — Frontend setup

Open a **new PowerShell window**:

```powershell
cd "emcatalyst-migration\frontend"
npm install
npm run dev
```

### Quick start (Windows)

After the first setup, you can use the included start script:

```powershell
cd "emcatalyst-migration"
.\start.ps1
```

### Windows common issues

**`psycopg2` fails to install**
```powershell
pip install psycopg2-binary
```

**`venv\Scripts\activate` is blocked by execution policy**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Python not found after install**  
Re-run the Python installer and tick **"Add Python to PATH"**, then restart PowerShell.

---

## macOS

### Step 1 — Install prerequisites using Homebrew

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python@3.11 postgresql@15 node git

# Start PostgreSQL
brew services start postgresql@15

# Add PostgreSQL to PATH (add this to ~/.zshrc or ~/.bash_profile)
echo 'export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Step 2 — Create the database

```bash
psql postgres -c "CREATE DATABASE emcatalyst;"
psql postgres -c "CREATE USER emcatalyst_user WITH PASSWORD 'emcatalyst_pass';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE emcatalyst TO emcatalyst_user;"
```

### Step 3 — Clone and set up

```bash
git clone https://github.com/zidkid/emcatalyst-migration.git
cd emcatalyst-migration

# Backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your database credentials
nano .env

python3 -c "from app.db.base import engine, Base; import app.models; Base.metadata.create_all(bind=engine); print('Tables created.')"
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

Open a new terminal for the frontend:

```bash
cd emcatalyst-migration/frontend
npm install
npm run dev
```

---

## Docker (all platforms)

The easiest way to run the full stack on any OS — no Python or Node installation required.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

### Run

```bash
git clone https://github.com/zidkid/emcatalyst-migration.git
cd emcatalyst-migration
docker-compose up --build
```

Docker will automatically:
- Start a PostgreSQL container
- Build and start the FastAPI backend
- Build and start the React frontend (served via Nginx)

| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:8002 |
| API Docs | http://localhost:8002/docs |

Stop everything:
```bash
docker-compose down
```

Stop and remove all data:
```bash
docker-compose down -v
```

---

## Running the Application

Once both servers are started:

| Service | URL |
|---|---|
| Frontend (React) | http://localhost:5173 |
| Backend API (FastAPI) | http://localhost:8002 |
| API Docs (Swagger) | http://localhost:8002/docs |

### Default login credentials

| Role | Email | Password |
|---|---|---|
| Administrator | admin@emcure.com | Admin@123 |
| Imported users (841) | *(their email)* | Emcure@123 |

---

## Data Migration (from Mendix SQL dump)

If you have the original Mendix Catalyst PostgreSQL dump:

### Step 1 — Full migration

```bash
# From the backend/ directory, with venv activated
python scripts/migrate_prod_data.py
```

Migrates: 39 divisions, 841 users, 1,000 HCP doctors, 53 FMV criteria, 22 specialities, 6 HCP roles, 58 therapeutics, 37 states.

### Step 2 — Supplemental migration

```bash
python scripts/migrate_supplemental.py
```

Migrates: 332 brands, 6 meals, 51 cities, 6 sponsorship types, 1,000 historical events.

---

## Project Structure

```
emcatalyst-migration/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              # Auth dependencies
│   │   │   └── routers/
│   │   │       ├── auth.py          # Login, user management
│   │   │       ├── events.py        # Events + agreements sub-routes
│   │   │       ├── master.py        # All master data endpoints
│   │   │       ├── reports.py       # 8 report endpoints
│   │   │       └── ...
│   │   ├── core/
│   │   │   ├── config.py            # Settings from .env
│   │   │   └── security.py         # JWT + password hashing
│   │   ├── db/
│   │   │   └── base.py              # SQLAlchemy engine + session
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   └── main.py                  # FastAPI app entry point
│   ├── scripts/
│   │   ├── migrate_prod_data.py     # Full Mendix data migration
│   │   └── migrate_supplemental.py  # Brands, meals, historical events
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── api/                     # Axios client + all endpoint functions
│   │   ├── components/              # Sidebar, Modal, FmvCalculator...
│   │   ├── pages/                   # Events, Masters, Reports, Users...
│   │   └── App.jsx                  # Routes
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.yml
├── start.ps1                        # Windows quick-start script
└── README.md
```

---

## API Reference

Full interactive docs are auto-generated by FastAPI at **http://localhost:8002/docs**

| Prefix | Description |
|---|---|
| `/api/auth/` | Login, user CRUD, password change |
| `/api/events/` | Event lifecycle + agreements sub-routes |
| `/api/master/` | Divisions, doctors, FMV, brands, meals, cities... |
| `/api/reports/` | Division-wise, state-wise, HCP honorarium, CME... |
| `/api/vendors/` | Vendor management |
| `/api/invoices/` | Invoice approval workflow |
| `/api/promotional/` | Promotional events |

---

## License

Internal use — Emcure Pharmaceuticals Ltd.
