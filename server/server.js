const express      = require("express");
const cors         = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const authRoutes  = require("./routes/auth");
const timerRoutes = require("./routes/timer");
const timersRoutes = require("./routes/timers"); 
const billingRoutes = require("./routes/billing"); 

const app  = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  "https://timer-front-xiwi.onrender.com",
  "http://localhost:5173",
  "https://timer.nordpak.org"
];

app.use(cors({
  origin: function(origin, callback){
    if(!origin || allowedOrigins.includes(origin)){
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true
}));

app.use("/api/billing/webhook", express.raw({ type: "application/json" }), billingRoutes);

app.use(express.json());
app.use(cookieParser());

/* ─── routes ─────────────────────────────────────────────────────────────── */
app.use("/api/auth",  authRoutes);
app.use("/api/timer", timerRoutes);
app.use("/t", timerRoutes); 
app.use("/api/timers", timersRoutes);
app.use("/api/billing", billingRoutes);

/* ─── health ─────────────────────────────────────────────────────────────── */
app.get("/health", (_, res) => res.json({ ok: true, time: new Date().toISOString() }));


/* ─── start ──────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`  Auth:    /api/auth`);
  console.log(`  GIF:     /api/timer/gif?target=2025-12-31T23:59:59`);
  console.log(`  Embed:   /api/timer/embed?target=2025-12-31T23:59:59`);
  console.log(`  Preview: /api/timer/preview?target=2025-12-31T23:59:59`);
});