const express          = require("express");
const { createCanvas } = require("canvas");
const GIFEncoder       = require("gifencoder");
const { fromZonedTime } = require("date-fns-tz");

const router = express.Router();

/* ─── GIF cache ───────────────────────────────────────────────────────────── */
const gifCache  = new Map();
const CACHE_TTL = 58_000;
const STALE_AT  = 20_000; // was 45_000 — refresh earlier so cache is always hot

function renderGifBuffer(p) {
  return new Promise((resolve, reject) => {
    // Use smaller canvas if caller didn't explicitly set size
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
    encoder.setQuality(20);   // was 10 — higher = faster encode, negligible visual diff
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");
    const base   = calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours);
    const total  = base.days * 86400 + base.hours * 3600 + base.minutes * 60 + base.seconds;
    for (let s = 0; s < 6; s++) {  // was 10 — 6 frames is plenty for a 1s-tick countdown
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

async function serveGif(res, cacheKey, p) {
  const cached = gifCache.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.ts;
    // Background re-render when stale so next request is instant
    if (age > STALE_AT) {
      renderGifBuffer(p)
        .then(buf => gifCache.set(cacheKey, { buf, ts: Date.now() }))
        .catch(console.error);
    }
    if (age < CACHE_TTL) return sendGif(res, cached.buf);
  }
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

module.exports.gifCache = gifCache;

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function parseColor(raw) {
  return raw.startsWith("#") ? raw : "#" + raw;
}

function resolveTarget(target, timezone) {
  if (!target) return new Date(Date.now() + 7 * 86400000);
  if (target.includes("Z") || target.includes("+") || target.includes("-", 10)) {
    return new Date(target);
  }
  try {
    return fromZonedTime(target, timezone || "UTC");
  } catch {
    return new Date(target);
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
    countUp:      q.countUp === "1" || q.countUp === "true" || q.mode === "countup",
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
    visualStyle:  q.visualStyle || "default",
    width:        Math.min(parseInt(q.width)  || 400, 600),  // default 400 (was 600) — smaller = faster
    height:       Math.min(parseInt(q.height) || 120, 200),  // default 120 (was 160) — smaller = faster
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

/* ─── Visual Style definitions ────────────────────────────────────────────── */
const CANVAS_STYLES = {

  // 1. Default — flat dark boxes, subtle glow
  default: {
    drawWrapper(ctx, W, H, p) {
      if (!p.transparent) {
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    },
    drawBox(ctx, x, y, bW, bH, br, p) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      roundRect(ctx, x + 3, y + 3, bW, bH, br); ctx.fill();
      ctx.fillStyle = p.box;
      roundRect(ctx, x, y, bW, bH, br); ctx.fill();
      ctx.strokeStyle = p.accent + "66"; ctx.lineWidth = 2;
      roundRect(ctx, x, y, bW, bH, br); ctx.stroke();
    },
    labelColor: (p) => p.textColor,
    labelAlpha: 0.55,
    sepAlpha:   0.65,
    sepColor:   (p) => p.accent,
  },

  // 2. Neon — glowing outlines, no fill, electric
  neon: {
    drawWrapper(ctx, W, H, p) {
      ctx.clearRect(0, 0, W, H);
      if (!p.transparent) {
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.shadowColor = p.accent; ctx.shadowBlur  = 18;
      roundRect(ctx, 2, 2, W - 4, H - 4, p.borderRadius);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
    drawBox(ctx, x, y, bW, bH, br, p) {
      ctx.fillStyle = p.accent + "18";
      roundRect(ctx, x, y, bW, bH, br); ctx.fill();
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.shadowColor = p.accent; ctx.shadowBlur  = 10;
      roundRect(ctx, x, y, bW, bH, br); ctx.stroke();
      ctx.shadowBlur  = 0;
    },
    labelColor:   (p) => p.accent,
    labelAlpha:   0.85,
    sepAlpha:     1,
    sepColor:     (p) => p.accent,
    numberColor:  (p) => p.accent,
    numberShadow: (ctx, p) => { ctx.shadowColor = p.accent; ctx.shadowBlur = 8; },
  },

  // 3. Minimal — no box, bottom border only
  minimal: {
    drawWrapper(ctx, W, H, p) {
      ctx.clearRect(0, 0, W, H);
      if (!p.transparent) {
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.strokeStyle = p.accent + "55"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, H - 2); ctx.lineTo(W - 20, H - 2);
      ctx.stroke();
    },
    drawBox(ctx, x, y, bW, bH, br, p) {
      ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + bH); ctx.lineTo(x + bW, y + bH);
      ctx.stroke();
    },
    labelColor: (p) => p.textColor,
    labelAlpha: 0.4,
    sepAlpha:   0.3,
    sepColor:   (p) => p.accent,
  },

  // 4. Glass — frosted translucent boxes
  glass: {
    drawWrapper(ctx, W, H, p) {
      ctx.clearRect(0, 0, W, H);
      if (!p.transparent) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle   = p.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = p.textColor + "18"; ctx.lineWidth = 1;
      roundRect(ctx, 1, 1, W - 2, H - 2, p.borderRadius);
      ctx.stroke();
    },
    drawBox(ctx, x, y, bW, bH, br, p) {
      ctx.fillStyle   = p.textColor + "0d";
      roundRect(ctx, x, y, bW, bH, br); ctx.fill();
      ctx.strokeStyle = p.textColor + "22"; ctx.lineWidth = 1;
      roundRect(ctx, x, y, bW, bH, br); ctx.stroke();
      ctx.fillStyle   = "rgba(0,0,0,0.15)";
      roundRect(ctx, x + 2, y + 3, bW, bH, br); ctx.fill();
      ctx.fillStyle   = p.textColor + "0d";
      roundRect(ctx, x, y, bW, bH, br); ctx.fill();
    },
    labelColor: (p) => p.textColor,
    labelAlpha: 0.45,
    sepAlpha:   0.25,
    sepColor:   (p) => p.textColor,
  },

  // 5. Retro — thick borders, hard shadow, no radius
  retro: {
    drawWrapper(ctx, W, H, p) {
      ctx.clearRect(0, 0, W, H);
      if (!p.transparent) {
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.strokeStyle = p.accent; ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.strokeStyle = p.accent + "88"; ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, W - 8, H - 8);
    },
    drawBox(ctx, x, y, bW, bH, _br, p) {
      ctx.fillStyle = p.accent + "88";
      ctx.fillRect(x + 3, y + 3, bW, bH);
      ctx.fillStyle = p.box;
      ctx.fillRect(x, y, bW, bH);
      ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
      ctx.strokeRect(x, y, bW, bH);
    },
    labelColor: (p) => p.accent,
    labelAlpha: 1,
    sepAlpha:   1,
    sepColor:   (p) => p.accent,
    boxRadius:  0,
  },

  // 6. Soft — pill boxes, gradient fill, large radius
  soft: {
    drawWrapper(ctx, W, H, p) {
      ctx.clearRect(0, 0, W, H);
      if (!p.transparent) {
        ctx.fillStyle = p.bg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.strokeStyle = p.accent + "33"; ctx.lineWidth = 1;
      ctx.shadowColor = p.accent + "22"; ctx.shadowBlur  = 24;
      roundRect(ctx, 1, 1, W - 2, H - 2, 28);
      ctx.stroke();
      ctx.shadowBlur = 0;
    },
    drawBox(ctx, x, y, bW, bH, _br, p) {
      const br = bH / 2;
      const grad = ctx.createLinearGradient(x, y, x + bW, y + bH);
      grad.addColorStop(0, p.box);
      grad.addColorStop(1, p.accent + "66");
      ctx.fillStyle = p.accent + "33";
      roundRect(ctx, x + 2, y + 4, bW, bH, br); ctx.fill();
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, bW, bH, br); ctx.fill();
    },
    labelColor: (p) => p.accent,
    labelAlpha: 0.8,
    sepAlpha:   0.5,
    sepColor:   (p) => p.accent,
    boxRadius:  999,
  },
};

/* ─── drawFrame ───────────────────────────────────────────────────────────── */
function drawFrame(ctx, W, H, timeObj, p) {
  const style = CANVAS_STYLES[p.visualStyle] || CANVAS_STYLES.default;

  style.drawWrapper(ctx, W, H, p);

  const units = [
    p.showDays    && { lbl: "DAYS", val: pad(timeObj.days)    },
    p.showHours   && { lbl: "HRS",  val: pad(timeObj.hours)   },
    p.showMinutes && { lbl: "MIN",  val: pad(timeObj.minutes) },
    p.showSeconds && { lbl: "SEC",  val: pad(timeObj.seconds) },
  ].filter(Boolean);

  if (!units.length) return;

  const titleH   = p.title ? 28 : 0;
  const padding  = 24;
  const maxInner = W - padding * 2;
  const gap      = Math.max(6, Math.min(16, Math.floor(maxInner / (units.length * 10))));
  let   boxW     = p.fontSize * 2.4;
  const maxBoxW  = Math.floor((maxInner - gap * (units.length - 1)) / units.length);
  boxW           = Math.min(boxW, maxBoxW);
  const fs       = Math.min(p.fontSize, Math.floor(boxW / 2.4));
  const innerBoxH = fs * 1.5;
  const labelH   = 18;
  const totalH   = titleH + innerBoxH + labelH;
  const totalW   = units.length * (boxW + gap) - gap;
  const sx       = (W - totalW) / 2;
  const sy       = Math.max(titleH + 8, (H - totalH) / 2 + titleH);

  const br = style.boxRadius !== undefined
    ? style.boxRadius
    : Math.min(p.borderRadius, Math.floor(innerBoxH / 4));

  // Title
  if (p.title) {
    ctx.fillStyle    = style.titleColor ? style.titleColor(p) : p.textColor;
    ctx.globalAlpha  = style.titleAlpha !== undefined ? style.titleAlpha : 0.9;
    ctx.font         = `bold ${Math.round(fs * 0.3)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    if (style.titleShadow) style.titleShadow(ctx, p);
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - titleH / 2 - 2);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  // Expired
  if (timeObj.done) {
    ctx.fillStyle    = p.accent;
    ctx.font         = `bold ${Math.round(fs * 0.7)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXPIRED", W / 2, H / 2);
    return;
  }

  // Boxes, numbers, labels, separators
  units.forEach(({ lbl, val }, i) => {
    const x = sx + i * (boxW + gap);
    const y = sy;

    ctx.save();
    style.drawBox(ctx, x, y, boxW, innerBoxH, br, p);
    ctx.restore();

    const numColor = style.numberColor ? style.numberColor(p) : p.textColor;
    ctx.fillStyle    = numColor;
    ctx.globalAlpha  = 1;
    ctx.font         = `bold ${fs}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    if (style.numberShadow) style.numberShadow(ctx, p);
    ctx.fillText(val, x + boxW / 2, y + innerBoxH / 2);
    ctx.shadowBlur  = 0;

    ctx.fillStyle    = style.labelColor(p);
    ctx.globalAlpha  = style.labelAlpha !== undefined ? style.labelAlpha : 0.55;
    ctx.font         = `bold ${Math.round(fs * 0.25)}px monospace`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + innerBoxH + 5);
    ctx.globalAlpha  = 1;

    if (i < units.length - 1) {
      ctx.fillStyle    = style.sepColor(p);
      ctx.globalAlpha  = style.sepAlpha !== undefined ? style.sepAlpha : 0.65;
      ctx.font         = `bold ${Math.round(fs * 0.7)}px monospace`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      if (style.sepShadow) style.sepShadow(ctx, p);
      ctx.fillText(":", x + boxW + gap / 2, y + innerBoxH / 2 - Math.round(fs * 0.08));
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }
  });
}

/* ─── Routes ─────────────────────────────────────────────────────────────── */
router.get("/gif", async (req, res) => {
  try {
    const p = parseParams(req.query);
    await serveGif(res, req.url, p);
  } catch (err) {
    console.error("GIF error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

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

/* ─── Embed HTML builder ─────────────────────────────────────────────────── */
function buildEmbedHtml(p, units, lblMap, resolvedTarget) {
  const embedStyleMap = {
    default: {
      wrap:  `border:2px solid ${p.accent}44; box-shadow:0 4px 20px ${p.accent}18;`,
      box:   `border-radius:7px; border:1px solid ${p.accent}30; box-shadow:0 2px 8px rgba(0,0,0,.25);`,
      sep:   `opacity:.65;`,
      label: `opacity:.55;`,
    },
    neon: {
      wrap:  `border:2px solid ${p.accent}; box-shadow:0 0 18px ${p.accent}99,0 0 36px ${p.accent}44,inset 0 0 12px ${p.accent}11;`,
      box:   `border-radius:4px; border:2px solid ${p.accent}; box-shadow:0 0 10px ${p.accent}88,inset 0 0 8px ${p.accent}22; background:${p.accent}11; color:${p.accent};`,
      sep:   `color:${p.accent}; text-shadow:0 0 8px ${p.accent}; opacity:1;`,
      label: `color:${p.accent}; opacity:.85; text-shadow:0 0 6px ${p.accent}88; letter-spacing:.2em;`,
    },
    minimal: {
      wrap:  `border:none; box-shadow:none; border-radius:0; border-bottom:2px solid ${p.accent}55;`,
      box:   `background:transparent; border:none; box-shadow:none; border-radius:0; border-bottom:2px solid ${p.accent};`,
      sep:   `opacity:.3; font-weight:300;`,
      label: `opacity:.4; font-weight:400; letter-spacing:.22em;`,
    },
    glass: {
      wrap:  `border:1px solid ${p.textColor}18; box-shadow:0 8px 32px rgba(0,0,0,.35),inset 0 1px 0 ${p.textColor}22; background:${p.bg}cc;`,
      box:   `border-radius:10px; border:1px solid ${p.textColor}22; box-shadow:inset 0 1px 0 ${p.textColor}15,0 4px 12px rgba(0,0,0,.2); background:${p.textColor}0d;`,
      sep:   `opacity:.25; font-weight:300; color:${p.textColor};`,
      label: `opacity:.45; font-weight:500;`,
    },
    retro: {
      wrap:  `border:4px solid ${p.accent}; box-shadow:6px 6px 0 ${p.accent}; border-radius:0;`,
      box:   `border-radius:0; border:3px solid ${p.accent}; box-shadow:3px 3px 0 ${p.accent}88; font-weight:900;`,
      sep:   `opacity:1; font-weight:900;`,
      label: `opacity:1; font-weight:700; letter-spacing:.12em; color:${p.accent};`,
    },
    soft: {
      wrap:  `border:1px solid ${p.accent}33; box-shadow:0 2px 24px ${p.accent}22; border-radius:28px;`,
      box:   `border-radius:999px; border:none; box-shadow:0 4px 16px ${p.accent}33; background:linear-gradient(135deg,${p.box},${p.accent}44); font-weight:800;`,
      sep:   `opacity:.5; font-weight:300;`,
      label: `opacity:.8; font-weight:600; letter-spacing:.15em; color:${p.accent};`,
    },
  };

  const vs = embedStyleMap[p.visualStyle] || embedStyleMap.default;

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
    ${vs.wrap}
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
    ${vs.box}
  }
  .lbl{
    color:${p.textColor};
    font-size:clamp(7px,1.2vw,10px);
    opacity:.55;margin-top:4px;letter-spacing:.14em;
    ${vs.label}
  }
  .sep{
    color:${p.accent};
    font-size:clamp(16px,4vw,${Math.floor(p.fontSize * 0.8)}px);
    font-weight:700;padding-bottom:clamp(8px,2vw,14px);opacity:.65;align-self:center;
    ${vs.sep}
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

/* ─── Short URL routes ───────────────────────────────────────────────────── */
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
    visualStyle:  cfg.visualStyle  || "default",
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