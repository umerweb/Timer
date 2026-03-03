# CountTimer Pro — Full Stack Countdown Timer

Exactly like mailtimers.com / emailcountdowntimer.com.
The server generates a **fresh animated GIF on every request** — works in email, iframe, anywhere.

---

## Project Structure

```
countdown-app/
├── server/          ← Node.js Express API (GIF generator)
│   ├── index.js
│   └── package.json
└── client/          ← React frontend
    ├── src/App.js
    └── package.json
```

---

## Quick Start

### 1. Start the server
```bash
cd server
npm install
npm start
# → running at http://localhost:3001
```

### 2. Start the client (new terminal)
```bash
cd client
npm install
npm start
# → opens at http://localhost:3000
```

---

## API Endpoints

### `GET /gif` — Animated GIF (for email)
Returns a fresh animated GIF every request. 60 frames, 1fps, loops forever.

```
http://localhost:3001/gif?target=2025-12-31T23:59:59
  &bg=0f0f1a&box=1e1b4b&text=e0e7ff&accent=818cf8
  &title=OFFER+ENDS+IN&fontSize=36&borderRadius=12
  &days=1&hours=1&minutes=1&seconds=1
  &mode=countdown
```

**Paste directly into email:**
```html
<img src="https://yourserver.com/gif?target=2025-12-31T23:59:59&..."
     style="display:inline-block;line-height:0;width:100%;max-width:380px"
     alt="Countdown Timer">
```

### `GET /embed` — Live JS Timer HTML (for iframes)
Self-contained HTML page with a live JavaScript countdown.

```html
<iframe src="https://yourserver.com/embed?target=2025-12-31T23:59:59&..."
        width="420" height="130" frameborder="0"
        style="border:none;overflow:hidden;display:block">
</iframe>
```

### `GET /preview` — Single PNG frame
Quick static preview of the current time state.

### `GET /health` — Health check

---

## Query Parameters

| Param         | Default         | Description                          |
|---------------|-----------------|--------------------------------------|
| `target`      | +7 days         | ISO date string                      |
| `mode`        | `countdown`     | `countdown` / `countup` / `evergreen`|
| `egHours`     | `48`            | Evergreen duration in hours          |
| `bg`          | `0f0f1a`        | Background color (hex, no #)         |
| `box`         | `1e1b4b`        | Number box color                     |
| `text`        | `e0e7ff`        | Text color                           |
| `accent`      | `818cf8`        | Accent/glow color                    |
| `title`       | (empty)         | Label above timer                    |
| `fontSize`    | `36`            | Number font size (max 48)            |
| `borderRadius`| `12`            | Box corner radius                    |
| `transparent` | `0`             | `1` for transparent background       |
| `days`        | `1`             | `0` to hide                         |
| `hours`       | `1`             | `0` to hide                         |
| `minutes`     | `1`             | `0` to hide                         |
| `seconds`     | `1`             | `0` to hide                         |
| `width`       | `380`           | GIF/canvas width                     |
| `height`      | `110`           | GIF/canvas height                    |

---

## Deploy to Production

### Server (any Node host)
```bash
# Render, Railway, Fly.io, VPS, etc.
cd server && npm install && npm start
```

Set `REACT_APP_API_URL=https://your-server-url.com` in client env.

### Client (static)
```bash
cd client
REACT_APP_API_URL=https://your-server-url.com npm run build
# Deploy /build folder to Netlify, Vercel, Cloudflare Pages, etc.
```

### .env example (client)
```
REACT_APP_API_URL=https://your-countdown-server.com
```

---

## How It Works (Like the real providers)

```
User opens email
  → email client fetches: https://yourserver.com/gif?target=...
  → server runs: calcTime(Date.now(), target) → draws canvas → streams GIF
  → returns fresh 60-frame animated GIF reflecting current time
  → email client shows the GIF — timer appears to tick (loops 60 sec)
```

The GIF loops every 60 seconds. On each email open, a new GIF is fetched
so the "current" time is always baked into frame 1. That's the trick.
