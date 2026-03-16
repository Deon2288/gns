# GNS – GPS Network System

A full-stack GPS device tracking application with a Node.js/Express backend, PostgreSQL database, real-time WebSocket updates, and a React + Mapbox GL JS frontend.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Set up the database](#2-set-up-the-database)
  - [3. Configure the backend](#3-configure-the-backend)
  - [4. Install and start the backend](#4-install-and-start-the-backend)
  - [5. Configure the frontend](#5-configure-the-frontend)
  - [6. Install and start the frontend](#6-install-and-start-the-frontend)
- [Environment Variables](#environment-variables)
  - [Backend](#backend-environment-variables)
  - [Frontend](#frontend-environment-variables)
- [API Overview](#api-overview)
- [Mapbox Map Features](#mapbox-map-features)
- [Development Tips](#development-tips)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Make sure the following tools are installed before you begin:

| Tool | Minimum Version | Install |
|------|----------------|---------|
| [Node.js](https://nodejs.org/) | 18 LTS | `nvm install 18` |
| [npm](https://www.npmjs.com/) | 9 | bundled with Node.js |
| [PostgreSQL](https://www.postgresql.org/) | 14 | [postgresql.org/download](https://www.postgresql.org/download/) |
| [Git](https://git-scm.com/) | any | [git-scm.com](https://git-scm.com/) |

You also need a free **Mapbox account** to get a public access token for the map:

- Sign up at [account.mapbox.com](https://account.mapbox.com/)
- Copy your **Default public token** from the Tokens page

---

## Project Structure

```
gns/
├── backend/             # Node.js / Express API + WebSocket server
│   ├── package.json
│   ├── .env.example     # ← copy to .env and fill in values
│   └── src/
│       ├── server.js
│       └── routes/
│           ├── devices.js
│           ├── gps.js
│           └── users.js
├── database/
│   └── schema.sql       # PostgreSQL schema (run once to create tables)
└── frontend/            # React + TypeScript + Mapbox GL JS
    ├── package.json
    ├── .env.local.example  # ← copy to .env.local and fill in values
    └── src/
        ├── components/
        │   ├── MapContainer.tsx
        │   ├── MapStyleSwitcher.tsx
        │   ├── MapLayerControl.tsx
        │   ├── GeofenceLayer.tsx
        │   ├── HeatmapLayer.tsx
        │   └── RouteAnimation.tsx
        └── utils/
            └── mapbox-utils.ts
```

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/Deon2288/gns.git
cd gns
```

---

### 2. Set up the database

#### a. Create a PostgreSQL user and database

```bash
# Log in as the postgres superuser
psql -U postgres

# Inside the psql shell:
CREATE USER gns_user WITH PASSWORD 'change_me';
CREATE DATABASE gns OWNER gns_user;
GRANT ALL PRIVILEGES ON DATABASE gns TO gns_user;
\q
```

#### b. Apply the schema

```bash
psql -U gns_user -d gns -f database/schema.sql
```

> **Windows users:** run the same commands inside **pgAdmin** or the PostgreSQL shell (`psql`).

---

### 3. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in your editor and set at minimum:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gns
DB_USER=gns_user
DB_PASSWORD=change_me          # the password you chose above

JWT_SECRET=replace_with_a_long_random_string
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

### 4. Install and start the backend

```bash
cd backend
npm install
npm start          # production
# or
npm run dev        # auto-reload with nodemon (recommended for development)
```

The API server starts on **http://localhost:3000** (configurable via `PORT`).  
The WebSocket server starts on **ws://localhost:8080** (configurable via `WEBSOCKET_PORT`).

---

### 5. Configure the frontend

```bash
# from the repo root
cp frontend/.env.local.example frontend/.env.local
```

Open `frontend/.env.local` and paste your Mapbox public token:

```env
REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJ...   # your real token
REACT_APP_WS_URL=ws://localhost:8080
```

---

### 6. Install and start the frontend

```bash
cd frontend
npm install
npm start
```

The app opens automatically at **http://localhost:3000**.

> **Note:** if the backend is also on port 3000, set `PORT=3001` in `backend/.env` before starting both servers.

---

## Environment Variables

### Backend environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `gns` | Database name |
| `DB_USER` | `gns_user` | Database user |
| `DB_PASSWORD` | *(required)* | Database password |
| `JWT_SECRET` | *(required)* | Secret for signing JWT tokens |
| `PORT` | `3000` | HTTP API port |
| `WEBSOCKET_PORT` | `8080` | WebSocket server port |

### Frontend environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_MAPBOX_TOKEN` | *(required)* | Mapbox public access token |
| `REACT_APP_WS_URL` | `ws://localhost:8080` | WebSocket server URL |

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/register` | Register a new user |
| `POST` | `/api/login` | Login and receive a JWT |
| `GET` | `/api/devices` | List all devices |
| `POST` | `/api/devices` | Create a new device |
| `PUT` | `/api/devices/:id` | Update a device |
| `DELETE` | `/api/devices/:id` | Delete a device |
| `GET` | `/api/gps/:deviceId` | Get all GPS records for a device |
| `GET` | `/api/gps/latest` | Get the latest GPS record per device |
| `POST` | `/api/gps` | Insert a GPS record (triggers WebSocket broadcast) |

---

## Mapbox Map Features

The `MapContainer` component supports:

- **5 map styles** – Streets, Light, Dark, Satellite, Outdoors
- **Layer toggles** – Roads, Traffic, Boundaries, Labels, Heatmap, Geofences, Device Trails
- **Custom SVG markers** – colour-coded by device status (online / warning / offline) with heading arrow
- **Geofence polygons** – fill + stroke with configurable colours
- **Activity heatmap** – weighted intensity heat overlay
- **Route animation** – play/pause/reset playback along a recorded path
- **3D terrain** – optional terrain exaggeration (satellite / outdoors styles)

Usage example:

```tsx
import MapContainer from './components/MapContainer';

<MapContainer
  devices={[
    { id: 1, name: 'Truck A', lngLat: [18.4241, -33.9249], status: 'online', speed: 60, battery: 85 }
  ]}
  geofences={[
    { id: 'zone1', name: 'Depot', coordinates: [[18.42, -33.92], [18.43, -33.92], [18.43, -33.93], [18.42, -33.93]] }
  ]}
  initialStyle="satellite"
  terrain
/>
```

---

## Development Tips

- **Hot reload** – `npm run dev` in the backend uses `nodemon` for automatic restarts on file changes.
- **TypeScript** – all frontend code is TypeScript; run `npx tsc --noEmit` inside `frontend/` to type-check without building.
- **Database migrations** – the project currently uses a single `database/schema.sql`; re-run it against a fresh database to reset the schema.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Start it with `sudo service postgresql start` (Linux) or via the PostgreSQL app (macOS/Windows). |
| `invalid token` / `403 Forbidden` | Your JWT has expired or `JWT_SECRET` in `.env` does not match what was used to sign the token. |
| Map shows "⚠️ Mapbox token is missing" | `REACT_APP_MAPBOX_TOKEN` is not set in `frontend/.env.local`. |
| `Module not found: mapbox-gl` | Run `npm install` inside the `frontend/` directory. |
| Port already in use | Change `PORT` (backend) or set `PORT=3001` before starting the frontend dev server. |
