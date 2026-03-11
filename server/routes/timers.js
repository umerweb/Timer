// /**
//  * routes/timers.js
//  *
//  * Mounted at /api/timers in server.js
//  * All routes require a valid JWT (Bearer token)
//  *
//  * GET    /api/timers        → list all timers for logged-in user
//  * POST   /api/timers        → save a new timer
//  * GET    /api/timers/:id    → get one timer
//  * PUT    /api/timers/:id    → update a timer
//  * DELETE /api/timers/:id    → delete a timer
//  */

// const express        = require("express");
// const router         = express.Router();
// const db             = require("../db");
// const auth           = require("../middleware/auth");
// const { gifCache }   = require("./timer");

// // All timer routes are protected
// router.use(auth);

// /* ── helpers ─────────────────────────────────────────────────────────────── */
// function parseCfg(raw) {
//   if (!raw) return {};
//   if (typeof raw === "object") return raw;
//   try { return JSON.parse(raw); } catch { return {}; }
// }

// /**
//  * Normalise the target value coming out of MySQL.
//  *
//  * MySQL DATETIME columns come back as JS Date objects or ISO strings like
//  * "2026-03-20T18:00:00.000Z". The React datetime-local input requires the
//  * format "YYYY-MM-DDTHH:mm" (exactly 16 chars, no seconds, no timezone).
//  *
//  * If we return the raw MySQL value the input silently becomes uncontrolled,
//  * the user's edited value is ignored, and the PUT sends the original date —
//  * making it look like changes aren't saving.
//  */
// function normaliseTarget(raw) {
//   if (!raw) return null;
//   // Already a plain datetime-local string — return as-is
//   if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return raw;
//   // Convert Date object or any ISO string → "YYYY-MM-DDTHH:mm"
//   const d = new Date(raw);
//   if (isNaN(d.getTime())) return raw; // unparseable — pass through unchanged
//   // Use local parts so the displayed time matches what was originally entered
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// }

// /**
//  * Merge stored cfg with safe defaults so every field is always present.
//  * This prevents undefined values causing React controlled/uncontrolled
//  * input warnings and silent data loss on save.
//  */
// function normaliseCfg(raw) {
//   const defaults = {
//     visualStyle:  "default",
//     bg:           "#0f0f1a",
//     box:          "#1e1b4b",
//     text:         "#e0e7ff",
//     accent:       "#818cf8",
//     title:        "",
//     font:         "Orbitron",
//     fontSize:     36,
//     borderRadius: 12,
//     transparent:  false,
//     showDays:     true,
//     showHours:    true,
//     showMinutes:  true,
//     showSeconds:  true,
//   };
//   const parsed = parseCfg(raw);
//   return { ...defaults, ...parsed };
// }

// function formatTimer(row) {
//   return {
//     id:        row.id,
//     name:      row.name,
//     target:    normaliseTarget(row.target),   // ← always "YYYY-MM-DDTHH:mm"
//     mode:      row.mode     || "countdown",
//     egHours:   row.eg_hours || 48,
//     timezone:  row.timezone || "UTC",
//     language:  row.language || "English",
//     cfg:       normaliseCfg(row.cfg),         // ← always has every field
//     createdAt: row.created_at,
//     updatedAt: row.updated_at,
//   };
// }

// /* ── GET /api/timers ─────────────────────────────────────────────────────── */
// router.get("/", async (req, res) => {
//   try {
//     const [rows] = await db.query(
//       `SELECT * FROM timers WHERE user_id = ? ORDER BY updated_at DESC`,
//       [req.user.id]
//     );
//     res.json(rows.map(formatTimer));
//   } catch (err) {
//     console.error("GET /timers:", err);
//     res.status(500).json({ message: "Failed to fetch timers" });
//   }
// });

// /* ── GET /api/timers/:id ─────────────────────────────────────────────────── */
// router.get("/:id", async (req, res) => {
//   try {
//     const [rows] = await db.query(
//       `SELECT * FROM timers WHERE id = ? AND user_id = ?`,
//       [req.params.id, req.user.id]
//     );
//     if (!rows.length) return res.status(404).json({ message: "Timer not found" });
//     res.json(formatTimer(rows[0]));
//   } catch (err) {
//     console.error("GET /timers/:id:", err);
//     res.status(500).json({ message: "Failed to fetch timer" });
//   }
// });

// /* ── POST /api/timers ────────────────────────────────────────────────────── */
// router.post("/", async (req, res) => {
//   const { name, target, mode, egHours, timezone, language, cfg } = req.body;

//   if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

//   try {
//     const [result] = await db.query(
//       `INSERT INTO timers (user_id, name, target, mode, eg_hours, timezone, language, cfg)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         req.user.id,
//         name.trim(),
//         target,
//         mode     || "countdown",
//         egHours  || 48,
//         timezone || "UTC",
//         language || "English",
//         JSON.stringify(cfg || {}),
//       ]
//     );

//     const [rows] = await db.query(`SELECT * FROM timers WHERE id = ?`, [result.insertId]);
//     res.status(201).json(formatTimer(rows[0]));
//   } catch (err) {
//     console.error("POST /timers:", err);
//     res.status(500).json({ message: "Failed to save timer" });
//   }
// });

// /* ── PUT /api/timers/:id ─────────────────────────────────────────────────── */
// router.put("/:id", async (req, res) => {
//   const { name, target, mode, egHours, timezone, language, cfg } = req.body;

//   if (!name?.trim()) return res.status(400).json({ message: "Timer name is required" });

//   try {
//     const [check] = await db.query(
//       `SELECT id FROM timers WHERE id = ? AND user_id = ?`,
//       [req.params.id, req.user.id]
//     );
//     if (!check.length) return res.status(404).json({ message: "Timer not found" });

//     await db.query(
//       `UPDATE timers
//        SET name=?, target=?, mode=?, eg_hours=?, timezone=?, language=?, cfg=?, updated_at=NOW()
//        WHERE id = ? AND user_id = ?`,
//       [
//         name.trim(),
//         target,
//         mode     || "countdown",
//         egHours  || 48,
//         timezone || "UTC",
//         language || "English",
//         JSON.stringify(cfg || {}),
//         req.params.id,
//         req.user.id,
//       ]
//     );

//     // Bust GIF cache so next request re-renders with new config
//     gifCache.delete(String(req.params.id));

//     const [rows] = await db.query(`SELECT * FROM timers WHERE id = ?`, [req.params.id]);
//     res.json(formatTimer(rows[0]));
//   } catch (err) {
//     console.error("PUT /timers/:id:", err);
//     res.status(500).json({ message: "Failed to update timer" });
//   }
// });

// /* ── DELETE /api/timers/:id ──────────────────────────────────────────────── */
// router.delete("/:id", async (req, res) => {
//   try {
//     const [check] = await db.query(
//       `SELECT id FROM timers WHERE id = ? AND user_id = ?`,
//       [req.params.id, req.user.id]
//     );
//     if (!check.length) return res.status(404).json({ message: "Timer not found" });

//     await db.query(
//       `DELETE FROM timers WHERE id = ? AND user_id = ?`,
//       [req.params.id, req.user.id]
//     );

//     // Bust GIF cache so deleted timer doesn't keep serving
//     gifCache.delete(String(req.params.id));

//     res.json({ message: "Timer deleted" });
//   } catch (err) {
//     console.error("DELETE /timers/:id:", err);
//     res.status(500).json({ message: "Failed to delete timer" });
//   }
// });

// module.exports = router;

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