# DM Tool LAN (Node server + React)

PC runs Node server + JSON DB. Open from any browser on your LAN.

## Run
1) `npm install`
2) `npm run dev`

Web: http://localhost:5173  
API: http://localhost:5174  

LAN:
- Find PC IP: `ipconfig`
- Open `http://<PC_IP>:5173`

## Files
- `server/data/userData.json` shared state
- `server/data/compendium.json` shared compendium (import XML -> stored here)
