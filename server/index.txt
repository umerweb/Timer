/**
 * Countdown Timer Server
 *
 * GET /gif?target=2025-12-31T23:59:59&bg=0f0f1a&box=1e1b4b&text=e0e7ff&accent=818cf8
 *       &font=monospace&title=OFFER+ENDS+IN&days=1&hours=1&minutes=1&seconds=1
 *       &fontSize=36&borderRadius=12&mode=countdown&egHours=48&transparent=0
 *
 *   → streams an animated GIF (60 frames, 1fps) with the current time baked in
 *     every request re-calculates from Date.now() so it's always fresh
 *
 * GET /embed?<same params>
 *   → returns a self-contained HTML page with a live JS timer (for iframe use)
 *
 * GET /preview?<same params>
 *   → returns a single PNG frame (for quick previews)
 */

const express    = require("express");
const cors       = require("cors");
const { createCanvas, registerFont } = require("canvas");
const GIFEncoder = require("gifencoder");
const path       = require("path");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* ─── helpers ─────────────────────────────────────────────────────────────── */
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function parseColor(raw) {
  // accept with or without #
  const h = raw.startsWith("#") ? raw : "#" + raw;
  return h;
}

function calcTime(target, mode, countUp, egHours) {
  if (mode === "evergreen") {
    const h = Number(egHours) || 48;
    return { days: Math.floor(h / 24), hours: h % 24, minutes: 0, seconds: 0, done: false };
  }
  let diff = new Date(target) - new Date();
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
    target:      q.target      || new Date(Date.now() + 7 * 86400000).toISOString(),
    mode:        q.mode        || "countdown",
    countUp:     q.countUp === "1" || q.countUp === "true",
    egHours:     parseInt(q.egHours) || 48,
    bg:          parseColor(q.bg          || "0f0f1a"),
    box:         parseColor(q.box         || "1e1b4b"),
    textColor:   parseColor(q.text        || "e0e7ff"),
    accent:      parseColor(q.accent      || "818cf8"),
    title:       q.title       || "",
    fontSize:    Math.min(parseInt(q.fontSize) || 36, 48),
    borderRadius:parseInt(q.borderRadius)  || 12,
    transparent: q.transparent === "1",
    showDays:    q.days    !== "0",
    showHours:   q.hours   !== "0",
    showMinutes: q.minutes !== "0",
    showSeconds: q.seconds !== "0",
    width:       parseInt(q.width)  || 380,
    height:      parseInt(q.height) || 110,
  };
}

/* ─── draw one frame onto a canvas context ───────────────────────────────── */
function drawFrame(ctx, W, H, timeObj, p) {
  // background
  if (p.transparent) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
  }

  const units = [
    p.showDays    && { lbl: "DAYS",    val: pad(timeObj.days)    },
    p.showHours   && { lbl: "HRS",     val: pad(timeObj.hours)   },
    p.showMinutes && { lbl: "MIN",     val: pad(timeObj.minutes) },
    p.showSeconds && { lbl: "SEC",     val: pad(timeObj.seconds) },
  ].filter(Boolean);

  if (!units.length) return;

  const fs      = p.fontSize;
  const boxW    = fs * 2.2;
  const boxH    = fs * 1.6;
  const gap     = 10;
  const titleH  = p.title ? 22 : 0;
  const totalW  = units.length * (boxW + gap) - gap;
  const sx      = (W - totalW) / 2;
  const sy      = (H - boxH - titleH) / 2 + titleH;

  // title
  if (p.title) {
    ctx.fillStyle = p.textColor;
    ctx.globalAlpha = 0.85;
    ctx.font = `bold 10px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - 14);
    ctx.globalAlpha = 1;
  }

  // expired
  if (timeObj.done) {
    ctx.fillStyle = p.accent;
    ctx.font = `bold 22px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EXPIRED", W / 2, H / 2);
    return;
  }

  units.forEach(({ lbl, val }, i) => {
    const x = sx + i * (boxW + gap);
    const y = sy;
    const br = Math.min(p.borderRadius, 10);

    // drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    roundRect(ctx, x + 2, y + 2, boxW, boxH - 16, br);
    ctx.fill();

    // box bg
    ctx.fillStyle = p.box;
    roundRect(ctx, x, y, boxW, boxH - 16, br);
    ctx.fill();

    // box border
    ctx.strokeStyle = p.accent + "55";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, boxW, boxH - 16, br);
    ctx.stroke();

    // digit
    ctx.fillStyle = p.textColor;
    ctx.font = `bold ${fs}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(val, x + boxW / 2, y + (boxH - 16) / 2);

    // label
    ctx.fillStyle = p.textColor;
    ctx.globalAlpha = 0.5;
    ctx.font = `bold 8px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + boxH - 14);
    ctx.globalAlpha = 1;

    // colon separator
    if (i < units.length - 1) {
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.7;
      ctx.font = `bold ${Math.floor(fs * 0.8)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(":", x + boxW + gap / 2, y + (boxH - 16) / 2 - 3);
      ctx.globalAlpha = 1;
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ─── GET /gif ───────────────────────────────────────────────────────────── */
app.get("/gif", (req, res) => {
  try {
    const p   = parseParams(req.query);
    const W   = p.width;
    const H   = p.height;

    const encoder = new GIFEncoder(W, H);
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Access-Control-Allow-Origin", "*");

    encoder.createReadStream().pipe(res);
    encoder.start();
    encoder.setRepeat(0);   // loop forever
    encoder.setDelay(1000); // 1 frame per second
    encoder.setQuality(6);  // 1=best, 20=worst

    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    // Get the current time once, then generate 60 frames (1 per second going forward)
    const baseTime = calcTime(p.target, p.mode, p.countUp, p.egHours);
    const baseTotalSec = baseTime.days * 86400 + baseTime.hours * 3600 + baseTime.minutes * 60 + baseTime.seconds;

    const FRAMES = 60;
    for (let s = 0; s < FRAMES; s++) {
      const remaining = Math.max(0, baseTotalSec - s);
      const frameTime = {
        days:    Math.floor(remaining / 86400),
        hours:   Math.floor((remaining % 86400) / 3600),
        minutes: Math.floor((remaining % 3600)  / 60),
        seconds: remaining % 60,
        done:    remaining === 0,
      };
      drawFrame(ctx, W, H, frameTime, p);
      encoder.addFrame(ctx);
    }

    encoder.finish();
  } catch (err) {
    console.error("GIF error:", err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

/* ─── GET /preview (single PNG frame) ───────────────────────────────────── */
app.get("/preview", (req, res) => {
  try {
    const p      = parseParams(req.query);
    const W      = p.width;
    const H      = p.height;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");
    const time   = calcTime(p.target, p.mode, p.countUp, p.egHours);

    drawFrame(ctx, W, H, time, p);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache");
    canvas.createPNGStream().pipe(res);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ─── GET /embed (self-contained HTML for iframes) ──────────────────────── */
app.get("/embed", (req, res) => {
  const p = parseParams(req.query);
  const units = [
    p.showDays    && "days",
    p.showHours   && "hours",
    p.showMinutes && "minutes",
    p.showSeconds && "seconds",
  ].filter(Boolean);
  const lblMap = { days:"DAYS", hours:"HRS", minutes:"MIN", seconds:"SEC" };

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;}
  body{
    display:flex;align-items:center;justify-content:center;
    background:${p.transparent ? "transparent" : p.bg};
    font-family:monospace;
  }
  .wrap{
    display:inline-flex;flex-direction:column;align-items:center;gap:10px;
    padding:20px 24px;
    background:${p.transparent ? "transparent" : p.bg};
    border-radius:${p.borderRadius}px;
    border:2px solid ${p.accent}44;
    box-shadow:0 4px 20px ${p.accent}20;
  }
  .title{
    color:${p.textColor};font-size:11px;letter-spacing:.18em;
    text-transform:uppercase;font-weight:700;opacity:.9;
  }
  .units{display:flex;gap:10px;align-items:flex-start;}
  .unit{display:flex;flex-direction:column;align-items:center;}
  .box{
    background:${p.box};color:${p.textColor};
    font-size:${p.fontSize}px;font-weight:700;
    padding:10px 16px;border-radius:7px;line-height:1;
    min-width:52px;text-align:center;
    border:1px solid ${p.accent}33;
    box-shadow:0 2px 8px rgba(0,0,0,.3);
    transition:background .3s;
  }
  .lbl{color:${p.textColor};font-size:9px;opacity:.55;margin-top:4px;letter-spacing:.14em;}
  .sep{color:${p.accent};font-size:${Math.floor(p.fontSize*.8)}px;font-weight:700;
       padding-bottom:12px;opacity:.65;align-self:center;}
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
  var T="${p.mode === "evergreen" ? "EVERGREEN" : new Date(p.target).toISOString()}";
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
    return{
      days:Math.floor(diff/86400000),
      hours:Math.floor((diff%86400000)/3600000),
      minutes:Math.floor((diff%3600000)/60000),
      seconds:Math.floor((diff%60000)/1000),
      done:diff===0
    };
  }
  function render(){
    var t=calc(),el=document.getElementById("ct");
    if(t.done){el.innerHTML='<div class="expired">EXPIRED</div>';return;}
    el.innerHTML=UNITS.map(function(u,i){
      return'<div class="unit"><div class="box">'+pad(t[u])+'</div>'
            +'<div class="lbl">'+LBL[u]+'</div></div>'
            +(i<UNITS.length-1?'<div class="sep">:</div>':"");
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

/* ─── GET /health ────────────────────────────────────────────────────────── */
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

/* ─── start ──────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n✅ Countdown Timer Server running at http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  GIF:     http://localhost:${PORT}/gif?target=2025-12-31T23:59:59&bg=0f0f1a&box=1e1b4b&text=e0e7ff&accent=818cf8&title=OFFER+ENDS+IN`);
  console.log(`  Embed:   http://localhost:${PORT}/embed?target=2025-12-31T23:59:59`);
  console.log(`  Preview: http://localhost:${PORT}/preview?target=2025-12-31T23:59:59`);
});
