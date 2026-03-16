/**
 * gifWorker.js  —  runs as a forked child process
 *
 * Communication:
 *   parent → child : process.send({ p, timerFonts })
 *   child  → parent: process.send({ buf: <base64 string> })
 *                 or process.send({ error: <message> })
 *
 * Using child_process.fork instead of worker_threads because `canvas`
 * is a native addon that can fail to load inside worker_threads on some
 * Node / glibc combos.  A forked child process gets its own clean V8 +
 * native module loader, so there is no ABI mismatch.
 */

"use strict";

const { createCanvas, registerFont } = require("canvas");
const GIFEncoder  = require("gifencoder");
const { fromZonedTime } = require("date-fns-tz");
const path        = require("path");
const { STYLE_DEFS } = require("../timerTheme");

const FONTS_DIR = path.join(__dirname, "../fonts");

/* ─── Receive one job from the parent, render, reply, exit ───────────────── */
process.once("message", ({ p, timerFonts }) => {
  (timerFonts || []).forEach(({ name, file }) => {
    try {
      registerFont(path.join(FONTS_DIR, file), { family: name, weight: "bold" });
    } catch (_) { /* non-fatal */ }
  });

  renderGifBuffer(p)
    .then((buf) => {
      process.send({ buf: buf.toString("base64") });
      process.exit(0);
    })
    .catch((err) => {
      process.send({ error: err.message });
      process.exit(1);
    });
});

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

function resolveTarget(target, timezone) {
  if (!target) return new Date(Date.now() + 7 * 86400000);
  if (target.includes("Z") || target.includes("+") || target.includes("-", 10))
    return new Date(target);
  try { return fromZonedTime(target, timezone || "UTC"); }
  catch { return new Date(target); }
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

function computeLayout(W, H, p) {
  const units = [
    p.showDays    && { lbl: "DAYS",  key: "days"    },
    p.showHours   && { lbl: "HRS",   key: "hours"   },
    p.showMinutes && { lbl: "MIN",   key: "minutes" },
    p.showSeconds && { lbl: "SEC",   key: "seconds" },
  ].filter(Boolean);

  if (!units.length) return null;

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
  const style     = STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat;
  const br        = style.canvas.boxRadius !== undefined
    ? style.canvas.boxRadius
    : Math.min(p.borderRadius, Math.floor(innerBoxH / 4));

  const fonts = {
    number:  `bold ${fs}px "${p.font}", ${p.font}`,
    label:   `bold ${ls}px "${p.font}", ${p.font}`,
    sep:     `bold ${Math.round(fs * 0.7)}px "${p.font}", ${p.font}`,
    title:   `bold ${Math.round(fs * 0.3)}px "${p.font}", ${p.font}`,
    expired: `bold ${Math.round(fs * 0.7)}px "${p.font}", ${p.font}`,
  };

  const boxes = units.map((u, i) => ({
    key:    u.key,
    lbl:    u.lbl,
    x:      sx + i * (boxW + gap),
    y:      sy,
    boxW,
    innerBoxH,
    br,
    numCX:  sx + i * (boxW + gap) + boxW / 2,
    numCY:  sy + innerBoxH / 2,
    hasSep: i < units.length - 1,
    sepX:   sx + i * (boxW + gap) + boxW + gap / 2,
    sepY:   sy + innerBoxH / 2 - Math.round(fs * 0.08),
  }));

  return { units, gap, boxW, fs, ls, innerBoxH, sx, sy, titleH, br, boxes, fonts };
}

function drawStaticLayer(ctx, W, H, layout, p) {
  const style = (STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat).canvas;
  style.drawWrapper(ctx, W, H, p);
  const { boxes, fonts, sy, titleH } = layout;

  if (p.title) {
    ctx.fillStyle    = p.textColor;
    ctx.globalAlpha  = 0.9;
    ctx.font         = fonts.title;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.title.toUpperCase(), W / 2, sy - titleH / 2 - 2);
    ctx.globalAlpha  = 1;
  }

  boxes.forEach(({ x, y, boxW, innerBoxH, br, lbl, hasSep, sepX, sepY }) => {
    ctx.save();
    style.drawBox(ctx, x, y, boxW, innerBoxH, br, p);
    ctx.restore();

    ctx.fillStyle    = style.labelColor(p);
    ctx.globalAlpha  = style.labelAlpha;
    ctx.font         = fonts.label;
    ctx.textAlign    = "center";
    ctx.textBaseline = "top";
    ctx.fillText(lbl, x + boxW / 2, y + innerBoxH + 4);
    ctx.globalAlpha  = 1;

    if (hasSep) {
      ctx.fillStyle    = style.sepColor(p);
      ctx.globalAlpha  = style.sepAlpha;
      ctx.font         = fonts.sep;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(":", sepX, sepY);
      ctx.globalAlpha  = 1;
    }
  });
}

function drawNumbersOnly(ctx, timeObj, layout, p) {
  const style = (STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat).canvas;
  const { boxes, fonts } = layout;
  ctx.fillStyle    = style.numberColor(p);
  ctx.globalAlpha  = 1;
  ctx.font         = fonts.number;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  boxes.forEach(({ key, numCX, numCY }) => {
    ctx.fillText(pad(timeObj[key]), numCX, numCY);
  });
}

function renderGifBuffer(p) {
  return new Promise((resolve, reject) => {
    // LW/LH = logical (unscaled) size — used for layout calculations & all draw calls
    // CW/CH = physical canvas size   — used for createCanvas, GIFEncoder, getImageData
    const SCALE = 1.3;
    const LW = p.width;
    const LH = p.height;
    const CW = Math.round(LW * SCALE);
    const CH = Math.round(LH * SCALE);

    const encoder = new GIFEncoder(CW, CH);
    const chunks  = [];

    encoder
      .createReadStream()
      .on("data",  (c)   => chunks.push(c))
      .on("end",   ()    => resolve(Buffer.concat(chunks)))
      .on("error", reject);

    encoder.start();
    encoder.setRepeat(0);
    encoder.setDelay(1000);
    encoder.setQuality(15);

    // Physical canvas is CW×CH, but ctx.scale makes all draw calls use logical coords
    const canvas = createCanvas(CW, CH);
    const ctx    = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);

    const base  = calcTime(p.target, p.timezone, p.mode, p.countUp, p.egHours);
    const total = base.days * 86400 + base.hours * 3600 + base.minutes * 60 + base.seconds;

    // CRITICAL: layout always uses logical dimensions (LW/LH), never scaled
    const layout = computeLayout(LW, LH, p);

    if (!layout) {
      (STYLE_DEFS[p.visualStyle] || STYLE_DEFS.flat).canvas.drawWrapper(ctx, LW, LH, p);
      encoder.addFrame(ctx);
      encoder.finish();
      return;
    }

    // drawStaticLayer uses logical dimensions — ctx.scale handles upscaling
    drawStaticLayer(ctx, LW, LH, layout, p);

    // getImageData/putImageData always work in physical pixels (CW/CH)
    const staticSnapshot = ctx.getImageData(0, 0, CW, CH);

    for (let s = 0; s < 10; s++) {
      const rem     = Math.max(0, total - s);
      const timeObj = {
        days:    Math.floor(rem / 86400),
        hours:   Math.floor((rem % 86400) / 3600),
        minutes: Math.floor((rem % 3600)  / 60),
        seconds: rem % 60,
        done:    rem === 0,
      };

      ctx.putImageData(staticSnapshot, 0, 0);

      if (timeObj.done) {
        ctx.fillStyle    = p.accent;
        ctx.font         = layout.fonts.expired;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("EXPIRED", LW / 2, LH / 2);  // logical coords — ctx is scaled
      } else {
        drawNumbersOnly(ctx, timeObj, layout, p);
      }

      encoder.addFrame(ctx);
    }

    encoder.finish();
  });
}