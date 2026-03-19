# 🧙‍♂️ Beholden

### A DM-First TTRPG Campaign Tracker

![TypeScript](https://img.shields.io/badge/Built%20With-TypeScript-3178C6?logo=typescript\&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react\&logoColor=black)
![Node](https://img.shields.io/badge/Backend-Node.js-339933?logo=node.js\&logoColor=white)
![Offline Friendly](https://img.shields.io/badge/Offline-Friendly-success)
![DM First](https://img.shields.io/badge/Designed%20For-Dungeon%20Masters-purple)

---

## 🎲 What Is Beholden?

Beholden is a **fast, clean, no-nonsense campaign tracker** built specifically for Dungeon Masters.

It is designed for:

* ⚔️ Running encounters quickly
* 📋 Tracking players & HP
* 📚 Managing adventures
* 🧠 Keeping your brain uncluttered

It is **not**:

* ❌ A character builder
* ❌ A virtual tabletop
* ❌ A rules engine

---

## 🚀 Getting Started (Super Simple)

### 1️⃣ Download

Click **Code → Download ZIP**
Or clone:

```bash
git clone https://github.com/cbgfx/beholden.git
cd beholden
```

---

### 2️⃣ Install

Install NodeJS on your machine.

```bash
npm install
```

---

### 3️⃣ Edit Your Settings File

Go to a file in the root folder called:

```
.env
```

Add this inside:

```
BEHOLDEN_SUPPORT=true
BEHOLDEN_ALLOWED_ORIGINS="https://localhost:5173"
BEHOLDEN_RATE_LIMIT_WINDOW_MS="900000"
BEHOLDEN_RATE_LIMIT_MAX="2000"

# Optional security
BEHOLDEN_BASIC_AUTH_USER=admin
BEHOLDEN_BASIC_AUTH_PASS=changeme
```

That’s it.

---

### 4️⃣ Build

```bash
cd web
npm run build
cd ..
```

---

### 5️⃣ Start

```bash
npm start
```

Open your browser to:

```
http://localhost:5174
```

---

## 🔐 Changing Username & Password

If you added:

```
BEHOLDEN_BASIC_AUTH_USER=admin
BEHOLDEN_BASIC_AUTH_PASS=changeme
```

Beholden will require login.

To change credentials:

1. Open `.env`
2. Change the values
3. Restart the app

Done.

---

## ☕ Turning Off the Support Button

If you don’t want the “Buy Me A Coffee” button:

```
BEHOLDEN_SUPPORT=false
```

Restart the app and it disappears.

---

## 🧩 Project Structure

```
beholden/
├── server/      → Backend API
├── web/         → React frontend
├── .env         → Your settings
└── start.bat    → Windows quick start
```

---

## 💡 Philosophy

Beholden follows strict design principles:

* 🎯 One primary action per panel
* 🧱 Modular components
* 🔄 No hidden side effects
* ⚡ Fast at the table
* 🧠 Zero cognitive overload

---

## 🛠 Tech Stack

* React + TypeScript
* Node + Express
* WebSocket support
* Local SQLite Persistance
* No external database required

---

## 🌍 Deployment

Beholden can be:

* 🏠 Run locally on your machine
* 🖥 Hosted on a home server
* ☁️ Reverse-proxied behind Cloudflare
* 🔒 Secured with basic auth

No special hosting provider required.

---

## 📜 License

MIT License
Free to use, modify, and fork.
