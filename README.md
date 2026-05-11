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

## Prerequisites

Make sure the following are installed on your system before proceeding.

### Required

- **Python 3.11 or higher** — [python.org/downloads](https://www.python.org/downloads/)
- **Node.js 18 or higher** (includes npm) — [nodejs.org](https://nodejs.org/)
- **PostgreSQL 15 or higher** — [postgresql.org/download](https://www.postgresql.org/download/)
- **Git** — [git-scm.com](https://git-scm.com/)

### Verify installations

```bash
python --version      # Python 3.11+
node --version        # v18+
npm --version         # 9+
psql --version        # psql 15+
git --version
```

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/zidkid/emcatalyst-migration.git
cd emcatalyst-migration
```

---

### 2. PostgreSQL — Create the database

Open a terminal and connect to PostgreSQL:

```bash
psql -U postgres
```

Then run:

```sql
CREATE DATABASE emcatalyst;
CREATE USER emcatalyst_user WITH PASSWORD 'emcatalyst_pass';
GRANT ALL PRIVILEGES ON DATABASE emcatalyst TO emcatalyst_user;
\q
```

---

### 3. Backend — FastAPI + Python setup

#### 3a. Navigate to the backend folder

```bash
cd backend
```

#### 3b. Create a Python virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt after activation.

#### 3c. Install Python dependencies

```bash
pip install -r requirements.txt
```

This installs FastAPI, SQLAlchemy, Uvicorn, Pydantic, psycopg2, python-jose, passlib, and all other required packages.

#### 3d. Create the environment file

Copy the example env file and edit it:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

Open `.env` and set your database credentials:

```env
DATABASE_URL=postgresql://emcatalyst_user:emcatalyst_pass@localhost:5432/emcatalyst
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
APP_NAME=EMCatalyst
```

> **Tip:** Generate a strong SECRET_KEY with: `python -c "import secrets; print(secrets.token_hex(32))"`

#### 3e. Create database tables

```bash
python -c "from app.db.base import engine, Base; import app.models; Base.metadata.create_all(bind=engine); print('Tables created.')"
```

#### 3f. Start the backend server

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

The API is now running at **http://localhost:8002**

- Swagger UI (interactive docs): **http://localhost:8002/docs**
- Health check: **http://localhost:8002/health**

---

### 4. Frontend — React + Vite setup

Open a **new terminal** (keep the backend running).

#### 4a. Navigate to the frontend folder

```bash
cd frontend
```

#### 4b. Install Node dependencies

```bash
npm install
```

#### 4c. Start the development server

```bash
npm run dev
```

The frontend is now running at **http://localhost:5173**

---

### 5. Seed initial admin user

With the backend running, create the admin account by running the migration script (it creates admin and seeds master data):

```bash
# From the backend/ directory, with venv activated
python scripts/migrate_prod_data.py
```

> If you have a Mendix SQL dump, place it at the path set in `SQL_FILE` inside the script before running.  
> Without the dump, run this minimal seed instead:

```bash
python -c "
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
    print('Admin user created: admin@emcure.com / Admin@123')
db.close()
"
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

### Step 1 — Full migration (divisions, users, doctors, FMV criteria, masters)

```bash
cd backend
python scripts/migrate_prod_data.py
```

This migrates:
- 39 Emcure divisions
- 841 employee user accounts
- 1,000 HCP doctors (MCL)
- 53 FMV criteria
- 22 specialities, 6 HCP roles, 58 therapeutics, 37 states

### Step 2 — Supplemental migration (brands, meals, historical events)

```bash
python scripts/migrate_supplemental.py
```

This migrates:
- 332 brands
- 6 meal types
- 51 cities (seeded)
- 6 sponsorship types (seeded)
- 1,000 historical events

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
│   │   │       ├── vendors.py
│   │   │       ├── approvals.py
│   │   │       └── ...
│   │   ├── core/
│   │   │   ├── config.py            # Settings from .env
│   │   │   └── security.py         # JWT + password hashing
│   │   ├── db/
│   │   │   └── base.py              # SQLAlchemy engine + session
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── user.py              # User, Division
│   │   │   ├── event.py             # Event, EventAgreement, EventDoctor...
│   │   │   ├── master.py            # HcpDoctor, FmvCriteria, MasterBrand...
│   │   │   └── ...
│   │   ├── schemas/                 # Pydantic request/response schemas
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
│   │   ├── api/
│   │   │   ├── client.js            # Axios instance with auth header
│   │   │   └── endpoints.js         # All API call functions
│   │   ├── components/
│   │   │   ├── layout/              # Sidebar, Layout
│   │   │   ├── ui/                  # Modal, PageHeader, StatusBadge...
│   │   │   ├── FmvCalculator.jsx    # FMV calculation (frontend only)
│   │   │   └── DoctorSearchModal.jsx
│   │   ├── pages/
│   │   │   ├── events/              # EventList, EventDetail, EventForm
│   │   │   ├── masters/             # Masters (10-tab reference data page)
│   │   │   ├── reports/             # Reports (8-tab analytics)
│   │   │   ├── users/               # UserManagement
│   │   │   └── ...
│   │   ├── store/
│   │   │   └── authStore.js         # Zustand auth state
│   │   └── App.jsx                  # Routes
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.yml
├── start.ps1                        # Windows quick-start script
└── README.md
```

---

## Docker (optional)

To run everything with Docker Compose (no manual Python/Node setup needed):

```bash
docker-compose up --build
```

This starts PostgreSQL, the FastAPI backend, and the React frontend together.

---

## API Reference

The full interactive API documentation is auto-generated by FastAPI.

Open **http://localhost:8002/docs** after starting the backend to browse and test all endpoints directly in the browser.

Key API groups:

| Prefix | Description |
|---|---|
| `/api/auth/` | Login, user CRUD, password change |
| `/api/events/` | Event lifecycle + agreements sub-routes |
| `/api/master/` | Divisions, doctors, FMV, brands, meals, cities... |
| `/api/reports/` | Analytics: division-wise, state-wise, HCP honorarium... |
| `/api/vendors/` | Vendor management |
| `/api/invoices/` | Invoice approval workflow |
| `/api/promotional/` | Promotional events |

---

## Common Issues

**`psycopg2` install fails on Windows**
```bash
pip install psycopg2-binary
```

**Port 8002 already in use**
```bash
# Windows — find and kill the process
netstat -ano | findstr :8002
taskkill /PID <pid> /F
```

**Frontend can't reach backend (CORS error)**  
Make sure the backend is running on port 8002. The Vite dev server proxies `/api` to `http://localhost:8002` automatically.

**`MODULE_NOT_FOUND` on npm start**  
```bash
cd frontend
rm -rf node_modules
npm install
```

---

## License

Internal use — Emcure Pharmaceuticals Ltd.
