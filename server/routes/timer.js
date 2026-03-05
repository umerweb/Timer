// timer.js
const express        = require("express");
const { createCanvas } = require("canvas");
const GIFEncoder     = require("gifencoder");
const { fromZonedTime } = require("date-fns-tz");

const router = express.Router();

/* ─── GIF cache ──────────────────────────────────────────────────────────── *
 * Keyed by timer id (short URLs) or param string hash (long /gif?... URL).
 * TTL = 55s so cache turns over just before each new minute.
 * Call gifCache.delete(id) from timers PUT/DELETE routes to bust on save.
 * ─────────────────────────────────────────────────────────────────────────── */
const gifCache  = new Map();   // key → { buf: Buffer, ts: number }
const CACHE_TTL = 55_000;

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
    for (let s = 0; s < 60; s++) {
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
    fontSize:     Math.min(parseInt(q.fontSize) || 36, 48),
    borderRadius: parseInt(q.borderRadius) || 12,
    transparent:  q.transparent === "1",
    showDays:     q.days    !== "0",
    showHours:    q.hours   !== "0",
    showMinutes:  q.minutes !== "0",
    showSeconds:  q.seconds !== "0",
    width:        parseInt(q.width)  || 380,
    height:       parseInt(q.height) || 110,
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

  const fs     = p.fontSize;
  const boxW   = fs * 2.2;
  const boxH   = fs * 1.6;
  const gap    = 10;
  const titleH = p.title ? 22 : 0;
  const totalW = units.length * (boxW + gap) - gap;
  const sx     = (W - totalW) / 2;
  const sy     = (H - boxH - titleH) / 2 + titleH;

  if (p.title) {
    ctx.fillStyle   = p.textColor;
    ctx.globalAlpha = 0.85;
    ctx.font        = "bold 10px monospace";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - 14);
    ctx.globalAlpha = 1;
  }

  if (timeObj.done) {
    ctx.fillStyle    = p.accent;
    ctx.font         = "bold 22px monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXPIRED", W / 2, H / 2);
    return;
  }

  units.forEach(({ lbl, val }, i) => {
    const x  = sx + i * (boxW + gap);
    const y  = sy;
    const br = Math.min(p.borderRadius, 10);

    // Drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(ctx, x + 2, y + 2, boxW, boxH - 16, br);
    ctx.fill();

    // Box background
    ctx.fillStyle = p.box;
    roundRect(ctx, x, y, boxW, boxH - 16, br);
    ctx.fill();

    // Box border
    ctx.strokeStyle = p.accent + "55";
    ctx.lineWidth   = 1;
    roundRect(ctx, x, y, boxW, boxH - 16, br);
    ctx.stroke();

    // Number
    ctx.fillStyle    = p.textColor;
    ctx.font         = `bold ${fs}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(val, x + boxW / 2, y + (boxH - 16) / 2);

    // Label
    ctx.fillStyle    = p.textColor;
    ctx.globalAlpha  = 0.5;
    ctx.font         = "bold 8px monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + boxH - 14);
    ctx.globalAlpha  = 1;

    // Separator colon
    if (i < units.length - 1) {
      ctx.fillStyle    = p.accent;
      ctx.globalAlpha  = 0.7;
      ctx.font         = `bold ${Math.floor(fs * 0.8)}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(":", x + boxW + gap / 2, y + (boxH - 16) / 2 - 3);
      ctx.globalAlpha  = 1;
    }
  });
}

/* ─── GET /gif ───────────────────────────────────────────────────────────── */
router.get("/gif", async (req, res) => {
  try {
    const cacheKey = req.url;
    const cached   = gifCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) return sendGif(res, cached.buf);
    const p   = parseParams(req.query);
    const buf = await renderGifBuffer(p);
    gifCache.set(cacheKey, { buf, ts: Date.now() });
    sendGif(res, buf);
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

  // For the embed we need to pass a fully resolved UTC ISO string to the
  // browser's JS so its own Date() math is correct regardless of the
  // viewer's local timezone.
  let resolvedTarget;
  if (p.mode === "evergreen") {
    resolvedTarget = "EVERGREEN";
  } else {
    resolvedTarget = resolveTarget(p.target, p.timezone).toISOString();
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;background:${p.transparent ? "transparent" : p.bg};font-family:monospace;}
  .wrap{display:inline-flex;flex-direction:column;align-items:center;gap:10px;padding:20px 24px;background:${p.transparent ? "transparent" : p.bg};border-radius:${p.borderRadius}px;border:2px solid ${p.accent}44;box-shadow:0 4px 20px ${p.accent}20;}
  .title{color:${p.textColor};font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9;}
  .units{display:flex;gap:10px;align-items:flex-start;}
  .unit{display:flex;flex-direction:column;align-items:center;}
  .box{background:${p.box};color:${p.textColor};font-size:${p.fontSize}px;font-weight:700;padding:10px 16px;border-radius:7px;line-height:1;min-width:52px;text-align:center;border:1px solid ${p.accent}33;box-shadow:0 2px 8px rgba(0,0,0,.3);}
  .lbl{color:${p.textColor};font-size:9px;opacity:.55;margin-top:4px;letter-spacing:.14em;}
  .sep{color:${p.accent};font-size:${Math.floor(p.fontSize * 0.8)}px;font-weight:700;padding-bottom:12px;opacity:.65;align-self:center;}
  .expired{color:${p.accent};font-size:22px;font-weight:700;letter-spacing:.1em;}
</style>
</head>
<body>
<div class="wrap">
  ${p.title ? `<div class="title">${p.title}</div>` : ""}
  <div class="units" id="ct"></div>
</div>
<script>
(function(){
  // resolvedTarget is already a UTC ISO string — no timezone math needed in the browser
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
      return'<div class="unit"><div class="box">'+pad(t[u])+'</div><div class="lbl">'+LBL[u]+'</div></div>'+(i<UNITS.length-1?'<div class="sep">:</div>':"");
    }).join("");
  }
  render();
  setInterval(render,1000);
})();
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.send(html);
});

/* ─── Short URL routes  /t/:id/gif  and  /t/:id/embed ────────────────────
 *
 * Mount this router at BOTH /api/timer  AND  /t  in server.js:
 *
 *   const timerRouter = require("./routes/timer");
 *   app.use("/api/timer", timerRouter);
 *   app.use("/t",         timerRouter);   // ← add this line
 *
 * The short-URL routes need the DB, so we require it lazily here to avoid
 * a circular-dependency issue if timer.js is loaded before db.js is ready.
 * ─────────────────────────────────────────────────────────────────────── */

router.get("/:id/gif", async (req, res) => {
  try {
    const db = require("../db");
    const [rows] = await db.query("SELECT * FROM timers WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Timer not found" });

    const row = rows[0];
    const cfg = (() => { try { return JSON.parse(row.cfg); } catch { return {}; } })();
    const p   = parseParams({
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

    const cached = gifCache.get(req.params.id);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) return sendGif(res, cached.buf);
    const buf = await renderGifBuffer(p);
    gifCache.set(req.params.id, { buf, ts: Date.now() });
    sendGif(res, buf);
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

    const row = rows[0];
    const cfg = (() => { try { return JSON.parse(row.cfg); } catch { return {}; } })();
    const p   = parseParams({
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

    // same embed HTML logic as /embed, reusing p directly
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

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;}
  body{display:flex;align-items:center;justify-content:center;background:${p.transparent ? "transparent" : p.bg};font-family:monospace;}
  .wrap{display:inline-flex;flex-direction:column;align-items:center;gap:10px;padding:20px 24px;background:${p.transparent ? "transparent" : p.bg};border-radius:${p.borderRadius}px;border:2px solid ${p.accent}44;box-shadow:0 4px 20px ${p.accent}20;}
  .title{color:${p.textColor};font-size:11px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9;}
  .units{display:flex;gap:10px;align-items:flex-start;}
  .unit{display:flex;flex-direction:column;align-items:center;}
  .box{background:${p.box};color:${p.textColor};font-size:${p.fontSize}px;font-weight:700;padding:10px 16px;border-radius:7px;line-height:1;min-width:52px;text-align:center;border:1px solid ${p.accent}33;box-shadow:0 2px 8px rgba(0,0,0,.3);}
  .lbl{color:${p.textColor};font-size:9px;opacity:.55;margin-top:4px;letter-spacing:.14em;}
  .sep{color:${p.accent};font-size:${Math.floor(p.fontSize * 0.8)}px;font-weight:700;padding-bottom:12px;opacity:.65;align-self:center;}
  .expired{color:${p.accent};font-size:22px;font-weight:700;letter-spacing:.1em;}
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
      return'<div class="unit"><div class="box">'+pad(t[u])+'</div><div class="lbl">'+LBL[u]+'</div></div>'+(i<UNITS.length-1?'<div class="sep">:</div>':"");
    }).join("");
  }
  render();
  setInterval(render,1000);
})();
</script>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.send(html);
  } catch (err) {
    console.error("Short embed error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

module.exports = router;