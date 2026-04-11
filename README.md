# Beholden

### A TTRPG Campaign Tracker for DMs and Players

![TypeScript](https://img.shields.io/badge/Built%20With-TypeScript-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)
![Node](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js&logoColor=white)
![SQLite](https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite&logoColor=white)

---

## What Is Beholden?

Beholden is a fast, self-hosted campaign tracker for tabletop RPGs. It has two distinct interfaces that share a single backend:

- **DM App** (`web-dm`) — for Dungeon Masters to manage campaigns, encounters, combat, NPCs, treasure, notes, and the compendium
- **Player App** (`web-player`) — for players to manage their characters, view shared campaign info, and follow along in real time

Everything runs on a single Node.js server with a local SQLite database. No cloud account required.

---

## Features

**DM App**
- Campaign, adventure, and encounter management
- Live combat tracker with initiative, HP, conditions, spell slots, and legendary actions
- Player roster with HP, AC, conditions, and death saves
- INPCs (in-party NPCs) with full stat tracking
- Monster, item, and spell compendium (importable via XML or SQLite)
- Treasure and notes per campaign and adventure
- Real-time sync across all connected clients via WebSocket

**Player App**
- Character creation and management
- Character sheet with stats, HP, AC, speed, and abilities
- Campaign dashboard showing your assigned campaigns
- Real-time updates from the DM

**Auth & Multi-user**
- JWT-based login with per-user accounts
- Role-based access: Admin, DM, Player
- Admins manage users and campaign memberships
- Players are redirected to the player app automatically; DMs access the full DM interface

---

## Project Structure

```
beholden/
├── server/        → Express API, SQLite, WebSocket
├── web-dm/        → DM React app (Vite)
├── web-player/    → Player React app (Vite)
├── shared/        → Shared styles
├── .env           → Local configuration
└── start.bat      → Windows quick-start script
```

---

## Getting Started (Local)

### 1. Install

Requires Node.js 18+.

```bash
git clone https://github.com/cbgfx/beholden.git
cd beholden
npm install
```

### 2. Configure

Create a `.env` file in the repo root:

```env
BEHOLDEN_SUPPORT=true
BEHOLDEN_RATE_LIMIT_WINDOW_MS=900000
BEHOLDEN_RATE_LIMIT_MAX=5000
WEB_PORT=5173
SERVER_PORT=5174
```

### 3. Dev mode

```bash
npm run dev
```

- DM app: `http://localhost:5173`
- Player app: `http://localhost:5175`
- API: `http://localhost:5174`

### 4. Production build

```bash
npm run build
npm start
```

The server serves both apps and the API from a single port (default `5174`):

- DM app: `http://localhost:5174/`
- Player app: `http://localhost:5174/player/`
- API: `http://localhost:5174/api/`

### 5. First login

On first run a default admin account is created:

```
Username: admin
Password: admin
```

Change the password immediately via Admin → Users, or set `BEHOLDEN_ADMIN_USER` / `BEHOLDEN_ADMIN_PASS` in `.env` before the first run.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5174` | Server port (Railway injects this automatically) |
| `SERVER_PORT` | `5174` | Dev-mode server port |
| `WEB_PORT` | `5173` | Dev-mode DM app port |
| `WEB_PLAYER_PORT` | `5175` | Dev-mode player app port |
| `BEHOLDEN_DATA_DIR` | Platform default | Directory for the SQLite database and uploaded images |
| `BEHOLDEN_DB_PATH` | `<data_dir>/beholden.db` | Override the database file path |
| `BEHOLDEN_ADMIN_USER` | `admin` | Initial admin username (used only on first run) |
| `BEHOLDEN_ADMIN_PASS` | `admin` | Initial admin password (used only on first run) |
| `BEHOLDEN_JWT_SECRET` | dev secret | Secret for signing JWTs — **change this in production** |
| `BEHOLDEN_SUPPORT` | `false` | Show a support link in the UI |
| `BEHOLDEN_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms |
| `BEHOLDEN_RATE_LIMIT_MAX` | `5000` | Max requests per window |
| `BEHOLDEN_LOG_EGRESS` | `-` | Set to `true` to log per-request egress bytes + duration |
| `BEHOLDEN_DEBUG` | — | Set to `true` for verbose server logs |

---

## Deployment (Railway)

Beholden is designed to deploy to [Railway](https://railway.app) as three services from the same repo:

| Service | Start command | Domain |
|---|---|---|
| `server` | `npm start` | `api.yourapp.com` |
| `web-dm` | `npm -w web-dm start` | `dm.yourapp.com` |
| `web-player` | `npm -w web-player start` | `player.yourapp.com` |

Set `BEHOLDEN_DATA_DIR=/data` and mount a Railway volume at `/data` to persist the database across deploys.

Set `VITE_API_ORIGIN` on both web services to point at your server's public URL (e.g. `https://api.yourapp.com`) so the frontend knows where to connect.

---

## Compendium

Beholden supports importing monster, item, spell, class, race, background, and feat data from:

- **XML** — compatible with common 5e compendium XML formats
- **SQLite** — direct import from another Beholden database

Import via **Compendium → Admin** in the DM app. The compendium is shared across all campaigns.

---

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, WebSocket (ws), JWT auth, sharp
- **DM Frontend:** React, TypeScript, Vite, React Router
- **Player Frontend:** React, TypeScript, Vite, React Router
- **Database:** SQLite (single file, no external server)

---

## License

MIT — free to use, modify, and self-host.
