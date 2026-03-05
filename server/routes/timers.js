/**
 * routes/timers.js
 * 
 * Mounted at /api/timers in server.js
 * All routes require a valid JWT (Bearer token)
 *
 * GET    /api/timers        → list all timers for logged-in user
 * POST   /api/timers        → save a new timer
 * GET    /api/timers/:id    → get one timer
 * PUT    /api/timers/:id    → update a timer
 * DELETE /api/timers/:id    → delete a timer
 */

const express = require("express");
const router  = express.Router();
const db      = require("../db");          
const auth    = require("../middleware/auth");

// All timer routes are protected
router.use(auth);

/* ── helpers ─────────────────────────────────────────────────────────────── */
// Safely parse cfg JSON — returns {} on failure
function parseCfg(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function formatTimer(row) {
  return {
    id:         row.id,
    name:       row.name,
    target:     row.target,
    mode:       row.mode,
    egHours:    row.eg_hours,
    timezone:   row.timezone,
    language:   row.language,
    cfg:        parseCfg(row.cfg),
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  };
}

/* ── GET /api/timers ─────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM timers WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(formatTimer));
  } catch (err) {
    console.error("GET /timers:", err);
    res.status(500).json({ message: "Failed to fetch timers" });
  }
});

/* ── GET /api/timers/:id ─────────────────────────────────────────────────── */
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM timers WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Timer not found" });
    res.json(formatTimer(rows[0]));
  } catch (err) {
    console.error("GET /timers/:id:", err);
    res.status(500).json({ message: "Failed to fetch timer" });
  }
});

/* ── POST /api/timers ────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  const { name, target, mode, egHours, timezone, language, cfg } = req.body;

  if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

  try {
    const [result] = await db.query(
      `INSERT INTO timers (user_id, name, target, mode, eg_hours, timezone, language, cfg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        name.trim(),
        target,
        mode      || "countdown",
        egHours   || 48,
        timezone  || "UTC",
        language  || "English",
        JSON.stringify(cfg || {}),
      ]
    );

    const [rows] = await db.query(`SELECT * FROM timers WHERE id = ?`, [result.insertId]);
    res.status(201).json(formatTimer(rows[0]));
  } catch (err) {
    console.error("POST /timers:", err);
    res.status(500).json({ message: "Failed to save timer" });
  }
});

/* ── PUT /api/timers/:id ─────────────────────────────────────────────────── */
router.put("/:id", async (req, res) => {
  const { name, target, mode, egHours, timezone, language, cfg } = req.body;

  if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

  try {
    const [check] = await db.query(
      `SELECT id FROM timers WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ message: "Timer not found" });

    await db.query(
      `UPDATE timers
       SET name=?, target=?, mode=?, eg_hours=?, timezone=?, language=?, cfg=?, updated_at=NOW()
       WHERE id = ? AND user_id = ?`,
      [
        name.trim(),
        target,
        mode     || "countdown",
        egHours  || 48,
        timezone || "UTC",
        language || "English",
        JSON.stringify(cfg || {}),
        req.params.id,
        req.user.id,
      ]
    );

    const [rows] = await db.query(`SELECT * FROM timers WHERE id = ?`, [req.params.id]);
    res.json(formatTimer(rows[0]));
  } catch (err) {
    console.error("PUT /timers/:id:", err);
    res.status(500).json({ message: "Failed to update timer" });
  }
});

/* ── DELETE /api/timers/:id ──────────────────────────────────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const [check] = await db.query(
      `SELECT id FROM timers WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ message: "Timer not found" });

    await db.query(`DELETE FROM timers WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    res.json({ message: "Timer deleted" });
  } catch (err) {
    console.error("DELETE /timers/:id:", err);
    res.status(500).json({ message: "Failed to delete timer" });
  }
});





module.exports = router;