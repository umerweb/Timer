/**
 * routes/timers.js — MongoDB version
 *
 * GET    /api/timers        → list all timers for logged-in user
 * POST   /api/timers        → save a new timer
 * GET    /api/timers/:id    → get one timer
 * PUT    /api/timers/:id    → update a timer
 * DELETE /api/timers/:id    → delete a timer
 */

const express      = require("express");
const router       = express.Router();
const { Timer }    = require("../db");
const auth         = require("../middleware/auth");
const { gifCache } = require("./timer");

router.use(auth);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseCfg(raw) {
  const defaults = {
    visualStyle:  "default",
    bg:           "#0f0f1a",
    box:          "#1e1b4b",
    text:         "#e0e7ff",
    accent:       "#818cf8",
    title:        "",
    font:         "Orbitron",
    fontSize:     36,
    borderRadius: 12,
    transparent:  false,
    showDays:     true,
    showHours:    true,
    showMinutes:  true,
    showSeconds:  true,
  };
  if (!raw || typeof raw !== "object") return defaults;
  return { ...defaults, ...raw };
}

function formatTimer(doc) {
  return {
    id:        doc._id,
    name:      doc.name,
    target:    doc.target,
    mode:      doc.mode     || "countdown",
    egHours:   doc.egHours  || 48,
    timezone:  doc.timezone || "UTC",
    language:  doc.language || "English",
    cfg:       normaliseCfg(doc.cfg),
    views:     doc.views    || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ─── GET /api/timers ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const timers = await Timer.find({ userId: req.user.id }).sort({ updatedAt: -1 });
    res.json(timers.map(formatTimer));
  } catch (err) {
    console.error("GET /timers:", err);
    res.status(500).json({ message: "Failed to fetch timers" });
  }
});

// ─── GET /api/timers/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const timer = await Timer.findOne({ _id: req.params.id, userId: req.user.id });
    if (!timer) return res.status(404).json({ message: "Timer not found" });
    res.json(formatTimer(timer));
  } catch (err) {
    console.error("GET /timers/:id:", err);
    res.status(500).json({ message: "Failed to fetch timer" });
  }
});

// ─── POST /api/timers ─────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, target, mode, egHours, timezone, language, cfg } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

  try {
    const timer = await Timer.create({
      userId:   req.user.id,
      name:     name.trim(),
      target,
      mode:     mode     || "countdown",
      egHours:  egHours  || 48,
      timezone: timezone || "UTC",
      language: language || "English",
      cfg:      cfg      || {},   // stored as real object — no JSON.stringify
    });
    res.status(201).json(formatTimer(timer));
  } catch (err) {
    console.error("POST /timers:", err);
    res.status(500).json({ message: "Failed to save timer" });
  }
});

// ─── PUT /api/timers/:id ──────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const { name, target, mode, egHours, timezone, language, cfg } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

  try {
    const timer = await Timer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      {
        name:     name.trim(),
        target,
        mode:     mode     || "countdown",
        egHours:  egHours  || 48,
        timezone: timezone || "UTC",
        language: language || "English",
        cfg:      cfg      || {},
      },
      { new: true }   // return updated doc
    );
    if (!timer) return res.status(404).json({ message: "Timer not found" });

    gifCache.delete(String(req.params.id));   // bust GIF cache
    res.json(formatTimer(timer));
  } catch (err) {
    console.error("PUT /timers/:id:", err);
    res.status(500).json({ message: "Failed to update timer" });
  }
});

// ─── DELETE /api/timers/:id ───────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const timer = await Timer.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!timer) return res.status(404).json({ message: "Timer not found" });

    gifCache.delete(String(req.params.id));   // bust GIF cache
    res.json({ message: "Timer deleted" });
  } catch (err) {
    console.error("DELETE /timers/:id:", err);
    res.status(500).json({ message: "Failed to delete timer" });
  }
});

module.exports = router;