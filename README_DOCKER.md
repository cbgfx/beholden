## Running Beholden

### Local (no Docker)
```bash
npm ci
npm run build        # builds web
npm -w server run start
```

Data is stored in a platform-appropriate folder by default:
- Windows: %APPDATA%\Beholden
- macOS: ~/Library/Application Support/Beholden
- Linux: $XDG_DATA_HOME/beholden (or ~/.local/share/beholden)

You can override with:
```bash
BEHOLDEN_DATA_DIR=./beholden-data npm -w server run start
```

### Docker
```bash
docker compose up --build
```

This exposes the app at:
- http://localhost:5174

Data persists in `./beholden-data` on your host via a mounted volume.

Notes:
- The container runs as a non-root user.
- The filesystem is read-only except for `/data` (mounted volume) and `/tmp` (tmpfs).
