const express           = require("express");
const { createCanvas, registerFont } = require("canvas");
const GIFEncoder        = require("gifencoder");
const { fromZonedTime } = require("date-fns-tz");
const path              = require("path");
const {
  TIMER_DEFAULTS, TIMER_TEMPLATES, TIMEZONES, TIMER_FONTS,
  STYLE_NAMES, STYLE_DEFS, roundRect,
} = require("../timerTheme");

// ─── Register fonts for canvas ────────────────────────────────────────────────
// Font files must exist at server/fonts/<file>
// Download from Google Fonts and place there:
//   Orbitron-Bold.ttf  → fonts.google.com/specimen/Orbitron
//   SpaceMono-Bold.ttf → fonts.google.com/specimen/Space+Mono
//   Oswald-Bold.ttf    → fonts.google.com/specimen/Oswald
const FONTS_DIR = path.join(__dirname, "../fonts");
TIMER_FONTS.forEach(({ name, file }) => {
  try {
    registerFont(path.join(FONTS_DIR, file), { family: name, weight: "bold" });
  } catch (e) {
    console.warn(`⚠ Could not register font "${name}" (${file}):`, e.message);
  }
});

const router = express.Router();

/* ─── GIF cache ───────────────────────────────────────────────────────────── */
const gifCache  = new Map();
const CACHE_TTL = 58_000;
const STALE_AT  = 20_000;

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
    encoder.setQuality(20);
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");
    const base   = calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours);
    const total  = base.days * 86400 + base.hours * 3600 + base.minutes * 60 + base.seconds;
    for (let s = 0; s < 6; s++) {
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
    if (age > STALE_AT) {
      renderGifBuffer(p).then(buf => gifCache.set(cacheKey, { buf, ts: Date.now() })).catch(console.error);
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
function pad(n) { return String(Math.max(0, Math.floor(n))).padStart(2, "0"); }

function parseColor(raw) {
  if (!raw) return "#000000";
  return raw.startsWith("#") ? raw : "#" + raw;
}

function resolveTarget(target, timezone) {
  if (!target) return new Date(Date.now() + 7 * 86400000);
  if (target.includes("Z") || target.includes("+") || target.includes("-", 10)) return new Date(target);
  try { return fromZonedTime(target, timezone || "UTC"); } catch { return new Date(target); }
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
  const D = TIMER_DEFAULTS;
  return {
    target:       q.target      || new Date(Date.now() + 7 * 86400000).toISOString(),
    timezone:     q.timezone    || "UTC",
    mode:         q.mode        || "countdown",
    countUp:      q.countUp === "1" || q.countUp === "true" || q.mode === "countup",
    egHours:      parseInt(q.egHours)       || 48,
    bg:           parseColor(q.bg           || D.bg.replace("#", "")),
    box:          parseColor(q.box          || D.box.replace("#", "")),
    textColor:    parseColor(q.text         || D.text.replace("#", "")),
    accent:       parseColor(q.accent       || D.accent.replace("#", "")),
    title:        q.title                   ?? D.title,
    font:         q.font                    || D.font,
    fontSize:     Math.min(parseInt(q.fontSize)      || D.fontSize,  72),
    labelSize:    Math.min(parseInt(q.labelSize)     || D.labelSize, 24),
    borderRadius: parseInt(q.borderRadius)  || D.borderRadius,
    showDays:     q.days    !== "0",
    showHours:    q.hours   !== "0",
    showMinutes:  q.minutes !== "0",
    showSeconds:  q.seconds !== "0",
    visualStyle:  q.visualStyle || D.visualStyle,
    width:        Math.min(parseInt(q.width)  || D.width,  600),
    height:       Math.min(parseInt(q.height) || D.height, 200),
  };
}

/* ─── drawFrame ───────────────────────────────────────────────────────────── */
function drawFrame(ctx, W, H, timeObj, p) {
  const style = (STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat).canvas;

  style.drawWrapper(ctx, W, H, p);

  const units = [
    p.showDays    && { lbl: "DAYS", val: pad(timeObj.days)    },
    p.showHours   && { lbl: "HRS",  val: pad(timeObj.hours)   },
    p.showMinutes && { lbl: "MIN",  val: pad(timeObj.minutes) },
    p.showSeconds && { lbl: "SEC",  val: pad(timeObj.seconds) },
  ].filter(Boolean);

  if (!units.length) return;

  const titleH    = p.title ? 28 : 0;
  const padding   = 24;
  const maxInner  = W - padding * 2;
  const gap       = Math.max(6, Math.min(16, Math.floor(maxInner / (units.length * 10))));
  let   boxW      = p.fontSize * 2.4;
  const maxBoxW   = Math.floor((maxInner - gap * (units.length - 1)) / units.length);
  boxW            = Math.min(boxW, maxBoxW);
  const fs        = Math.min(p.fontSize, Math.floor(boxW / 2.4));
  const ls        = p.labelSize;
  const innerBoxH = fs * 1.5;
  const totalW    = units.length * (boxW + gap) - gap;
  const sx        = (W - totalW) / 2;
  const sy        = Math.max(titleH + 8, (H - (titleH + innerBoxH + ls + 6)) / 2 + titleH);

  const br = style.boxRadius !== undefined
    ? style.boxRadius
    : Math.min(p.borderRadius, Math.floor(innerBoxH / 4));

  // Title
  if (p.title) {
    ctx.fillStyle = p.textColor; ctx.globalAlpha = 0.9;
    ctx.font = `bold ${Math.round(fs * 0.3)}px "${p.font}", ${p.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - titleH / 2 - 2);
    ctx.globalAlpha = 1;
  }

  // Expired
  if (timeObj.done) {
    ctx.fillStyle = p.accent;
    ctx.font = `bold ${Math.round(fs * 0.7)}px "${p.font}", ${p.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("EXPIRED", W / 2, H / 2);
    return;
  }

  units.forEach(({ lbl, val }, i) => {
    const x = sx + i * (boxW + gap), y = sy;

    ctx.save(); style.drawBox(ctx, x, y, boxW, innerBoxH, br, p); ctx.restore();

    // Number
    ctx.fillStyle = style.numberColor(p); ctx.globalAlpha = 1;
    ctx.font = `bold ${fs}px "${p.font}", ${p.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(val, x + boxW / 2, y + innerBoxH / 2);

    // Label
    ctx.fillStyle = style.labelColor(p); ctx.globalAlpha = style.labelAlpha;
    ctx.font = `bold ${ls}px "${p.font}", ${p.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + innerBoxH + 4);
    ctx.globalAlpha = 1;

    // Separator
    if (i < units.length - 1) {
      ctx.fillStyle = style.sepColor(p); ctx.globalAlpha = style.sepAlpha;
      ctx.font = `bold ${Math.round(fs * 0.7)}px "${p.font}", ${p.font}`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(":", x + boxW + gap / 2, y + innerBoxH / 2 - Math.round(fs * 0.08));
      ctx.globalAlpha = 1;
    }
  });
}

/* ─── Embed HTML builder ─────────────────────────────────────────────────── */
function buildEmbedHtml(p, units, lblMap, resolvedTarget) {
  const vs = (STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat).embedCss(p);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(p.font)}:wght@700&display=swap" rel="stylesheet"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;overflow:hidden;}
  body{display:flex;align-items:center;justify-content:center;background:${p.bg};font-family:'${p.font}',monospace;}
  .wrap{
    display:inline-flex;flex-direction:column;align-items:center;
    gap:clamp(6px,1.5vw,12px);
    padding:clamp(12px,3vw,24px) clamp(14px,3.5vw,28px);
    background:${p.bg};border-radius:${p.borderRadius}px;
    width:100%;max-width:100%;${vs.wrap}
  }
  .title{color:${p.textColor};font-size:clamp(9px,1.8vw,13px);letter-spacing:.18em;text-transform:uppercase;font-weight:700;opacity:.9;}
  .units{display:flex;gap:clamp(5px,1.2vw,12px);align-items:flex-start;justify-content:center;width:100%;}
  .unit{display:flex;flex-direction:column;align-items:center;}
  .box{
    background:${p.box};color:${p.textColor};
    font-size:clamp(18px,5vw,${p.fontSize}px);font-weight:700;
    padding:clamp(7px,1.8vw,12px) clamp(10px,2.5vw,18px);
    border-radius:${p.borderRadius}px;line-height:1;
    min-width:clamp(36px,8vw,56px);text-align:center;
    ${vs.box}
  }
  .lbl{
    color:${p.textColor};
    font-size:clamp(${Math.max(7, p.labelSize - 4)}px, 1.2vw, ${p.labelSize}px);
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
  var T="${resolvedTarget}",MODE="${p.mode}",EG=${p.egHours};
  var UNITS=${JSON.stringify(units)},LBL=${JSON.stringify(lblMap)};
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
  render();setInterval(render,1000);
})();
</script>
</body>
</html>`;
}

/* ─── Theme endpoint ─────────────────────────────────────────────────────── */
router.get("/theme", (_req, res) => {
  res.json({ TIMER_DEFAULTS, TIMER_TEMPLATES, TIMEZONES, TIMER_FONTS, STYLE_NAMES });
});

/* ─── Routes ─────────────────────────────────────────────────────────────── */
router.get("/gif", async (req, res) => {
  try { await serveGif(res, req.url, parseParams(req.query)); }
  catch (err) { console.error("GIF error:", err); if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

router.get("/preview", (req, res) => {
  try {
    const p = parseParams(req.query);
    const canvas = createCanvas(p.width, p.height);
    const ctx = canvas.getContext("2d");
    drawFrame(ctx, p.width, p.height, calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours), p);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    canvas.createPNGStream().pipe(res);
  } catch (err) { console.error("Preview error:", err); res.status(500).json({ error: err.message }); }
});

router.get("/embed", (req, res) => {
  const p = parseParams(req.query);
  const units = [p.showDays&&"days",p.showHours&&"hours",p.showMinutes&&"minutes",p.showSeconds&&"seconds"].filter(Boolean);
  const lblMap = { days:"DAYS", hours:"HRS", minutes:"MIN", seconds:"SEC" };
  const resolvedTarget = p.mode==="evergreen" ? "EVERGREEN" : resolveTarget(p.target,p.timezone).toISOString();
  res.setHeader("Content-Type","text/html"); res.setHeader("X-Frame-Options","ALLOWALL"); res.setHeader("Access-Control-Allow-Origin","*");
  res.send(buildEmbedHtml(p, units, lblMap, resolvedTarget));
});

/* ─── Short URL routes ───────────────────────────────────────────────────── */
function buildParamsFromRow(row) {
  const cfg = (row.cfg && typeof row.cfg === "object") ? row.cfg : {};
  const D = TIMER_DEFAULTS;
  return parseParams({
    target: row.target, timezone: row.timezone, mode: row.mode, egHours: row.egHours,
    bg:           (cfg.bg      || D.bg).replace("#",""),
    box:          (cfg.box     || D.box).replace("#",""),
    text:         (cfg.text    || D.text).replace("#",""),
    accent:       (cfg.accent  || D.accent).replace("#",""),
    title:        cfg.title        ?? D.title,
    font:         cfg.font         || D.font,
    fontSize:     cfg.fontSize     || D.fontSize,
    labelSize:    cfg.labelSize    || D.labelSize,
    borderRadius: cfg.borderRadius || D.borderRadius,
    days:         cfg.showDays     === false ? "0" : "1",
    hours:        cfg.showHours    === false ? "0" : "1",
    minutes:      cfg.showMinutes  === false ? "0" : "1",
    seconds:      cfg.showSeconds  === false ? "0" : "1",
    visualStyle:  cfg.visualStyle  || D.visualStyle,
    width:        D.width, height: D.height,
  });
}

router.get("/:id/gif", async (req, res) => {
  try {
    const { Timer } = require("../db");
    const row = await Timer.findById(req.params.id);
    if (!row) return res.status(404).json({ error: "Timer not found" });
    await serveGif(res, req.params.id, buildParamsFromRow(row));
  } catch (err) { console.error("Short GIF error:", err); if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

router.get("/:id/embed", async (req, res) => {
  try {
    const { Timer } = require("../db");
    const row = await Timer.findById(req.params.id);
    if (!row) return res.status(404).json({ error: "Timer not found" });
    const p = buildParamsFromRow(row);
    const units = [p.showDays&&"days",p.showHours&&"hours",p.showMinutes&&"minutes",p.showSeconds&&"seconds"].filter(Boolean);
    const lblMap = { days:"DAYS", hours:"HRS", minutes:"MIN", seconds:"SEC" };
    const resolvedTarget = p.mode==="evergreen" ? "EVERGREEN" : resolveTarget(p.target,p.timezone).toISOString();
    res.setHeader("Content-Type","text/html"); res.setHeader("X-Frame-Options","ALLOWALL"); res.setHeader("Access-Control-Allow-Origin","*");
    res.send(buildEmbedHtml(p, units, lblMap, resolvedTarget));
  } catch (err) { console.error("Short embed error:", err); if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

/* ─── Cache warmer ───────────────────────────────────────────────────────── */
async function warmGifCache() {
  try {
    const { Timer } = require("../db");
    const rows = await Timer.find({});
    let count = 0;
    for (const row of rows) {
      const buf = await renderGifBuffer(buildParamsFromRow(row));
      gifCache.set(String(row._id), { buf, ts: Date.now() });
      count++;
    }
    console.log(`✅ GIF cache warmed for ${count} timers`);
  } catch (err) { console.error("GIF cache warm failed:", err.message); }
}

module.exports = router;
module.exports.gifCache     = gifCache;
module.exports.warmGifCache = warmGifCache;