# GNS — GPS & Remote Monitoring Software

A full-stack remote monitoring platform for tracking GPS devices in real time.  
Built with **React + TypeScript + Mapbox GL JS** (frontend) and **Node.js + Express + PostgreSQL** (backend).

---

## Features

| Feature | Details |
|---|---|
| 🗺 **Live Map** | Mapbox GL JS map with moving device markers, popups, style switcher, layer controls, geofences, heatmap, route animation |
| 📊 **Dashboard** | Fleet KPIs, status breakdown pie chart, speed/battery bar chart, per-device battery progress bars |
| 🔔 **Alerts** | Severity-coded alert list (critical / warning / info), filter tabs, one-click acknowledge |
| ⚙️ **Device Admin** | Add, rename, delete GPS devices; see last known position and timestamp |
| 🔌 **WebSocket** | Live GPS updates and new alerts are pushed to all connected browser clients |
| 🔒 **Auth** | JWT-based login (bcrypt password hashing, 8-hour tokens) |

---

## Project Structure

```
gns/
├── backend/
│   ├── .env.example          # Copy to .env and fill in values
│   ├── package.json
│   └── src/
│       ├── server.js         # Express + HTTP + WebSocket server
│       ├── db.js             # Shared pg.Pool
│       ├── auth.js           # JWT middleware
│       └── routes/
│           ├── users.js      # POST /api/users/register|login, GET /api/users/profile
│           ├── devices.js    # CRUD  /api/devices
│           ├── gps.js        # GET/POST /api/gps/:deviceId, GET /api/gps/latest
│           ├── alerts.js     # CRUD + PATCH /api/alerts/:id/acknowledge
│           └── telemetry.js  # POST/GET /api/telemetry/:deviceId
├── database/
│   └── schema.sql            # PostgreSQL schema (run once)
└── frontend/
    ├── package.json
    └── src/
        ├── App.tsx           # Tab shell (Map / Dashboard / Alerts / Admin)
        ├── components/
        │   ├── MapContainer.tsx
        │   ├── Dashboard.tsx
        │   ├── AlertsPanel.tsx
        │   ├── DeviceAdmin.tsx
        │   ├── GeofenceLayer.tsx
        │   ├── HeatmapLayer.tsx
        │   ├── MapLayerControl.tsx
        │   ├── MapStyleSwitcher.tsx
        │   └── RouteAnimation.tsx
        └── utils/
            └── mapbox-utils.ts
```

---

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+
- A free **Mapbox** account → get a public token at <https://account.mapbox.com/access-tokens/>

---

## Quick Start

### 1. Database

```bash
# Create the database and user
psql -U postgres -c "CREATE USER gns_user WITH PASSWORD 'changeme';"
psql -U postgres -c "CREATE DATABASE gns_db OWNER gns_user;"

# Run the schema
psql -U gns_user -d gns_db -f database/schema.sql
```

### 2. Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DB_PASSWORD, JWT_SECRET, etc.

# Start (production)
npm start

# Start (development, auto-restart on changes)
npm run dev
```

The API will be available at **http://localhost:5000**.

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Create frontend/.env.local with your Mapbox token:
echo "REACT_APP_MAPBOX_TOKEN=pk.your_token_here" > .env.local
# Optionally point at a remote backend:
echo "REACT_APP_API_URL=http://localhost:5000/api" >> .env.local

# Start development server
npm start
```

The app will open at **http://localhost:3000**.

---

## API Reference

All `/api` routes (except `/api/users/register` and `/api/users/login`) require:

```
Authorization: Bearer <token>
```

| Method | Path | Description |
|---|---|---|
| POST | `/api/users/register` | Register a new user |
| POST | `/api/users/login` | Log in, receive JWT |
| GET  | `/api/users/profile` | Current user info |
| GET  | `/api/devices` | List devices (with last GPS position) |
| POST | `/api/devices` | Add a device |
| PUT  | `/api/devices/:id` | Rename a device |
| DELETE | `/api/devices/:id` | Delete a device |
| GET  | `/api/gps/latest` | Latest position for all devices |
| GET  | `/api/gps/:deviceId` | GPS history for a device |
| POST | `/api/gps/:deviceId` | Ingest a new GPS record |
| GET  | `/api/alerts` | List alerts (`?status=open\|acknowledged`) |
| POST | `/api/alerts` | Create an alert |
| PATCH | `/api/alerts/:id/acknowledge` | Acknowledge an alert |
| DELETE | `/api/alerts/:id` | Delete an alert |
| POST | `/api/telemetry/:deviceId` | Store telemetry data |
| GET  | `/api/telemetry/:deviceId` | Retrieve telemetry records |
| GET  | `/health` | Health check |

### WebSocket

Connect to `ws://localhost:5000/ws` to receive live push events:

```json
{ "type": "gps_update", "data": { ... } }
{ "type": "new_alert",  "data": { ... } }
{ "type": "telemetry",  "data": { ... } }
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DB_USER` | `gns_user` | PostgreSQL username |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_NAME` | `gns_db` | PostgreSQL database name |
| `DB_PASSWORD` | — | PostgreSQL password |
| `DB_PORT` | `5432` | PostgreSQL port |
| `JWT_SECRET` | — | **Required** — long random string |
| `PORT` | `5000` | HTTP server port |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `REACT_APP_MAPBOX_TOKEN` | Your Mapbox public token |
| `REACT_APP_API_URL` | Backend API base URL (default: `http://localhost:5000/api`) |

