// timer.js
const express        = require("express");
const { createCanvas } = require("canvas");
const GIFEncoder     = require("gifencoder");
const { fromZonedTime } = require("date-fns-tz");

const router = express.Router();

/* ─── GIF cache ──────────────────────────────────────────────────────────── *
 * Keyed by timer id (short URLs) or param string hash (long /gif?... URL).
 * TTL = 58s so cache turns over just before each new minute.
 * Call gifCache.delete(id) from timers PUT/DELETE routes to bust on save.
 * ─────────────────────────────────────────────────────────────────────────── */
const gifCache  = new Map();   // key → { buf: Buffer, ts: number }
const CACHE_TTL = 58_000;      // 58s — re-render just before each new minute
const STALE_AT  = 45_000;      // start background re-render at 45s so it's ready

function renderGifBuffer(p) {
  return new Promise((resolve, reject) => {
    const W = p.width, H = p.height;
    const encoder = new GIFEncoder(W, H);
    const chunks  = [];
    encoder.createReadStream()
      .on("data",  c   => chunks.push(c))
      .on("end",   ()  => resolve(Buffer.concat(chunks)))
      .on("error", err => reject(err));
    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(1000);
    encoder.setQuality(10);
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");
    const base   = calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours);
    const total  = base.days * 86400 + base.hours * 3600 + base.minutes * 60 + base.seconds;
    for (let s = 0; s < 10; s++) {
      const rem = Math.max(0, total - s);
      drawFrame(ctx, W, H, {
        days:    Math.floor(rem / 86400),
        hours:   Math.floor((rem % 86400) / 3600),
        minutes: Math.floor((rem % 3600)  / 60),
        seconds: rem % 60,
        done:    rem === 0,
      }, p);
      encoder.addFrame(ctx);
    }
    encoder.finish();
  });
}

/**
 * Serve from cache if available (stale-while-revalidate).
 * - Always returns cached buf immediately if it exists.
 * - Triggers a background re-render once cache is 45s old.
 * - Only blocks the request if there is no cache at all.
 */
async function serveGif(res, cacheKey, p) {
  const cached = gifCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.ts;
    // Background refresh — doesn't block response
    if (age > STALE_AT) {
      renderGifBuffer(p)
        .then(buf => gifCache.set(cacheKey, { buf, ts: Date.now() }))
        .catch(console.error);
    }
    // Still within TTL — serve immediately
    if (age < CACHE_TTL) return sendGif(res, cached.buf);
  }
  // No cache or fully expired — render and wait
  const buf = await renderGifBuffer(p);
  gifCache.set(cacheKey, { buf, ts: Date.now() });
  sendGif(res, buf);
}

function sendGif(res, buf) {
  res.setHeader("Content-Type",   "image/gif");
  res.setHeader("Content-Length", buf.length);
  res.setHeader("Cache-Control",  "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma",         "no-cache");
  res.setHeader("Expires",        "0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(buf);
}

module.exports.gifCache = gifCache; // export so timers.js can bust on save

/* ─── helpers ────────────────────────────────────────────────────────────── */
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function parseColor(raw) {
  return raw.startsWith("#") ? raw : "#" + raw;
}

/**
 * Convert a naive datetime-local string ("2026-03-20T18:00") plus a
 * timezone name ("Asia/Karachi") into a real UTC Date object.
 *
 * If the target already looks like a full ISO string with offset (contains
 * "Z" or "+") we use it directly — no conversion needed.
 */
function resolveTarget(target, timezone) {
  if (!target) return new Date(Date.now() + 7 * 86400000);

  // Already has timezone info — use as-is
  if (target.includes("Z") || target.includes("+") || target.includes("-", 10)) {
    return new Date(target);
  }

  // Naive datetime-local string — interpret it in the given timezone
  try {
    return fromZonedTime(target, timezone || "UTC");
  } catch {
    return new Date(target); // fallback: treat as UTC
  }
}

function calcTime(target, timezone, mode, countUp, egHours) {
  if (mode === "evergreen") {
    const h = Number(egHours) || 48;
    return { days: Math.floor(h / 24), hours: h % 24, minutes: 0, seconds: 0, done: false };
  }

  const targetDate = resolveTarget(target, timezone);
  let diff = targetDate - new Date();
  if (countUp) diff = -diff;
  if (diff < 0) diff = 0;

  return {
    days:    Math.floor(diff / 86400000),
    hours:   Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000)  / 60000),
    seconds: Math.floor((diff % 60000)    / 1000),
    done:    diff === 0,
  };
}

function parseParams(q) {
  return {
    target:       q.target      || new Date(Date.now() + 7 * 86400000).toISOString(),
    timezone:     q.timezone    || "UTC",
    mode:         q.mode        || "countdown",
    countUp:      q.countUp === "1" || q.countUp === "true",
    egHours:      parseInt(q.egHours) || 48,
    bg:           parseColor(q.bg     || "0f0f1a"),
    box:          parseColor(q.box    || "1e1b4b"),
    textColor:    parseColor(q.text   || "e0e7ff"),
    accent:       parseColor(q.accent || "818cf8"),
    title:        q.title       || "",
    fontSize:     Math.min(parseInt(q.fontSize) || 36, 72),
    borderRadius: parseInt(q.borderRadius) || 12,
    transparent:  q.transparent === "1",
    showDays:     q.days    !== "0",
    showHours:    q.hours   !== "0",
    showMinutes:  q.minutes !== "0",
    showSeconds:  q.seconds !== "0",
    // Render at 600px wide (standard email width) — scales down beautifully on all screens
    width:        parseInt(q.width)  || 600,
    height:       parseInt(q.height) || 160,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

function drawFrame(ctx, W, H, timeObj, p) {
  if (p.transparent) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
  }

  const units = [
    p.showDays    && { lbl: "DAYS", val: pad(timeObj.days)    },
    p.showHours   && { lbl: "HRS",  val: pad(timeObj.hours)   },
    p.showMinutes && { lbl: "MIN",  val: pad(timeObj.minutes) },
    p.showSeconds && { lbl: "SEC",  val: pad(timeObj.seconds) },
  ].filter(Boolean);

  if (!units.length) return;

  const titleH   = p.title ? 28 : 0;
  const padding  = 24;                        // breathing room each side
  const maxInner = W - padding * 2;
  const gap      = Math.max(6, Math.min(16, Math.floor(maxInner / (units.length * 10))));
  let   boxW     = p.fontSize * 2.4;
  const maxBoxW  = Math.floor((maxInner - gap * (units.length - 1)) / units.length);
  boxW           = Math.min(boxW, maxBoxW);
  const fs       = Math.min(p.fontSize, Math.floor(boxW / 2.4));
  const innerBoxH = fs * 1.5;                 // the coloured box height (no label)
  const labelH   = 18;                        // DAYS / HRS / MIN / SEC label area
  const totalH   = titleH + innerBoxH + labelH;
  const totalW   = units.length * (boxW + gap) - gap;
  const sx       = (W - totalW) / 2;
  const sy       = Math.max(titleH + 8, (H - totalH) / 2 + titleH);

  // Title
  if (p.title) {
    ctx.fillStyle    = p.textColor;
    ctx.globalAlpha  = 0.9;
    ctx.font         = `bold ${Math.round(fs * 0.3)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - titleH / 2 - 2);
    ctx.globalAlpha  = 1;
  }

  // EXPIRED state
  if (timeObj.done) {
    ctx.fillStyle    = p.accent;
    ctx.font         = `bold ${Math.round(fs * 0.7)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXPIRED", W / 2, H / 2);
    return;
  }

  units.forEach(({ lbl, val }, i) => {
    const x  = sx + i * (boxW + gap);
    const y  = sy;
    const br = Math.min(p.borderRadius, Math.floor(innerBoxH / 4));

    // Drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    roundRect(ctx, x + 3, y + 3, boxW, innerBoxH, br);
    ctx.fill();

    // Box background
    ctx.fillStyle = p.box;
    roundRect(ctx, x, y, boxW, innerBoxH, br);
    ctx.fill();

    // Box border / glow
    ctx.strokeStyle = p.accent + "66";
    ctx.lineWidth   = 2;
    roundRect(ctx, x, y, boxW, innerBoxH, br);
    ctx.stroke();

    // Number
    ctx.fillStyle    = p.textColor;
    ctx.font         = `bold ${fs}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(val, x + boxW / 2, y + innerBoxH / 2);

    // Label below box
    ctx.fillStyle    = p.textColor;
    ctx.globalAlpha  = 0.55;
    ctx.font         = `bold ${Math.round(fs * 0.25)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + innerBoxH + 5);
    ctx.globalAlpha  = 1;

    // Separator colon between boxes
    if (i < units.length - 1) {
      ctx.fillStyle    = p.accent;
      ctx.globalAlpha  = 0.75;
      ctx.font         = `bold ${Math.round(fs * 0.7)}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(":", x + boxW + gap / 2, y + innerBoxH / 2 - Math.round(fs * 0.08));
      ctx.globalAlpha  = 1;
    }
  });
}

/* ─── GET /gif ───────────────────────────────────────────────────────────── */
router.get("/gif", async (req, res) => {
  try {
    const p = parseParams(req.query);
    await serveGif(res, req.url, p);
  } catch (err) {
    console.error("GIF error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/* ─── GET /preview ───────────────────────────────────────────────────────── */
router.get("/preview", (req, res) => {
  try {
    const p      = parseParams(req.query);
    const canvas = createCanvas(p.width, p.height);
    const ctx    = canvas.getContext("2d");
    const time   = calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours);

    drawFrame(ctx, p.width, p.height, time, p);

    res.setHeader("Content-Type",  "image/png");
    res.setHeader("Cache-Control", "no-cache");
    canvas.createPNGStream().pipe(res);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /embed ─────────────────────────────────────────────────────────── */
router.get("/embed", (req, res) => {
  const p      = parseParams(req.query);
  const units  = [
    p.showDays    && "days",
    p.showHours   && "hours",
    p.showMinutes && "minutes",
    p.showSeconds && "seconds",
  ].filter(Boolean);
  const lblMap = { days: "DAYS", hours: "HRS", minutes: "MIN", seconds: "SEC" };

  let resolvedTarget;
  if (p.mode === "evergreen") {
    resolvedTarget = "EVERGREEN";
  } else {
    resolvedTarget = resolveTarget(p.target, p.timezone).toISOString();
  }

  const html = buildEmbedHtml(p, units, lblMap, resolvedTarget);

  res.setHeader("Content-Type", "text/html");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(html);
});

/* ─── Shared embed HTML builder ─────────────────────────────────────────── */
function buildEmbedHtml(p, units, lblMap, resolvedTarget) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;overflow:hidden;}
  body{
    display:flex;align-items:center;justify-content:center;
    background:${p.transparent ? "transparent" : p.bg};
    font-family:monospace;
  }
  .wrap{
    display:inline-flex;flex-direction:column;align-items:center;
    gap:clamp(6px,1.5vw,12px);
    padding:clamp(12px,3vw,24px) clamp(14px,3.5vw,28px);
    background:${p.transparent ? "transparent" : p.bg};
    border-radius:${p.borderRadius}px;
    border:2px solid ${p.accent}44;
    box-shadow:0 4px 24px ${p.accent}22;
    width:100%;max-width:100%;
  }
  .title{
    color:${p.textColor};
    font-size:clamp(9px,1.8vw,13px);
    letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9;
  }
  .units{
    display:flex;gap:clamp(5px,1.2vw,12px);
    align-items:flex-start;justify-content:center;width:100%;
  }
  .unit{display:flex;flex-direction:column;align-items:center;}
  .box{
    background:${p.box};color:${p.textColor};
    font-size:clamp(18px,5vw,${p.fontSize}px);
    font-weight:700;
    padding:clamp(7px,1.8vw,12px) clamp(10px,2.5vw,18px);
    border-radius:7px;line-height:1;
    min-width:clamp(36px,8vw,56px);
    text-align:center;
    border:1px solid ${p.accent}33;
    box-shadow:0 2px 10px rgba(0,0,0,.3);
  }
  .lbl{
    color:${p.textColor};
    font-size:clamp(7px,1.2vw,10px);
    opacity:.55;margin-top:4px;letter-spacing:.14em;
  }
  .sep{
    color:${p.accent};
    font-size:clamp(16px,4vw,${Math.floor(p.fontSize * 0.8)}px);
    font-weight:700;padding-bottom:clamp(8px,2vw,14px);opacity:.65;align-self:center;
  }
  .expired{color:${p.accent};font-size:clamp(16px,4vw,24px);font-weight:700;letter-spacing:.1em;}
</style>
</head>
<body>
<div class="wrap">
  ${p.title ? `<div class="title">${p.title}</div>` : ""}
  <div class="units" id="ct"></div>
</div>
<script>
(function(){
  var T="${resolvedTarget}";
  var MODE="${p.mode}";
  var EG=${p.egHours};
  var UNITS=${JSON.stringify(units)};
  var LBL=${JSON.stringify(lblMap)};
  function pad(n){return("0"+Math.max(0,Math.floor(n))).slice(-2);}
  function calc(){
    if(MODE==="evergreen"){var h=EG;return{days:Math.floor(h/24),hours:h%24,minutes:0,seconds:0,done:false};}
    var diff=new Date(T)-new Date();
    if(MODE==="countup")diff=-diff;
    if(diff<0)diff=0;
    return{days:Math.floor(diff/86400000),hours:Math.floor((diff%86400000)/3600000),minutes:Math.floor((diff%3600000)/60000),seconds:Math.floor((diff%60000)/1000),done:diff===0};
  }
  function render(){
    var t=calc(),el=document.getElementById("ct");
    if(t.done){el.innerHTML='<div class="expired">EXPIRED</div>';return;}
    el.innerHTML=UNITS.map(function(u,i){
      return'<div class="unit"><div class="box">'+pad(t[u])+'</div><div class="lbl">'+LBL[u]+'</div></div>'
        +(i<UNITS.length-1?'<div class="sep">:</div>':"");
    }).join("");
  }
  render();
  setInterval(render,1000);
})();
</script>
</body>
</html>`;
}

/* ─── Short URL routes  /t/:id/gif  and  /t/:id/embed ────────────────────
 *
 * Mount this router at BOTH /api/timer  AND  /t  in server.js:
 *
 *   const timerRouter = require("./routes/timer");
 *   app.use("/api/timer", timerRouter);
 *   app.use("/t",         timerRouter);   // ← add this line
 *
 * ─────────────────────────────────────────────────────────────────────── */

function buildParamsFromRow(row) {
  const cfg = (() => { try { return JSON.parse(row.cfg); } catch { return {}; } })();
  return parseParams({
    target:       row.target,
    timezone:     row.timezone,
    mode:         row.mode,
    egHours:      row.eg_hours,
    bg:           (cfg.bg      || "0f0f1a").replace("#", ""),
    box:          (cfg.box     || "1e1b4b").replace("#", ""),
    text:         (cfg.text    || "e0e7ff").replace("#", ""),
    accent:       (cfg.accent  || "818cf8").replace("#", ""),
    title:        cfg.title        || "",
    fontSize:     cfg.fontSize     || 36,
    borderRadius: cfg.borderRadius || 12,
    transparent:  cfg.transparent  ? "1" : "0",
    days:         cfg.showDays     === false ? "0" : "1",
    hours:        cfg.showHours    === false ? "0" : "1",
    minutes:      cfg.showMinutes  === false ? "0" : "1",
    seconds:      cfg.showSeconds  === false ? "0" : "1",
  });
}

router.get("/:id/gif", async (req, res) => {
  try {
    const db = require("../db");
    const [rows] = await db.query("SELECT * FROM timers WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Timer not found" });
    const p = buildParamsFromRow(rows[0]);
    await serveGif(res, req.params.id, p);
  } catch (err) {
    console.error("Short GIF error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.get("/:id/embed", async (req, res) => {
  try {
    const db = require("../db");
    const [rows] = await db.query("SELECT * FROM timers WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Timer not found" });

    const p = buildParamsFromRow(rows[0]);
    const units  = [
      p.showDays    && "days",
      p.showHours   && "hours",
      p.showMinutes && "minutes",
      p.showSeconds && "seconds",
    ].filter(Boolean);
    const lblMap = { days: "DAYS", hours: "HRS", minutes: "MIN", seconds: "SEC" };
    const resolvedTarget = p.mode === "evergreen"
      ? "EVERGREEN"
      : resolveTarget(p.target, p.timezone).toISOString();

    const html = buildEmbedHtml(p, units, lblMap, resolvedTarget);
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(html);
  } catch (err) {
    console.error("Short embed error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/* ─── Cache warmer ───────────────────────────────────────────────────────── */
async function warmGifCache(db) {
  try {
    const [rows] = await db.query("SELECT * FROM timers");
    let count = 0;
    for (const row of rows) {
      const p   = buildParamsFromRow(row);
      const buf = await renderGifBuffer(p);
      gifCache.set(String(row.id), { buf, ts: Date.now() });
      count++;
    }
    console.log(`✅ GIF cache warmed for ${count} timers`);
  } catch (err) {
    console.error("GIF cache warm failed:", err.message);
  }
}

module.exports              = router;
module.exports.gifCache     = gifCache;
module.exports.warmGifCache = warmGifCache;