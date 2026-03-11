/**
 * migrate.js — MySQL → MongoDB one-time migration script
 * 
 * Usage:
 *   npm install mysql2 mongoose
 *
 *   MYSQL_HOST=127.0.0.1 MYSQL_USER=root MYSQL_PASS=yourMysqlPass MYSQL_DB=u831283736_timer \
 *   MONGO_PASS=yourAtlasPassword \
 *   node migrate.js
 */

const mysql    = require("mysql2/promise");
const mongoose = require("mongoose");

// ─── Config ───────────────────────────────────────────────────────────────────
const MYSQL = {
  host:     'localhost',
  user:     'root',
  password: '0772',
  database: 'timer',
};
// Your Atlas password — pass via env var or paste it directly here
const MONGO_PASS = "umer4428";
const MONGO_URI  = `mongodb+srv://umer:${MONGO_PASS}@timer.dybnfwx.mongodb.net/timerly?appName=timer`;
// ─── Mongoose Schemas ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  _mysqlId:        Number,   // temp field, removed after migration
  email:           { type: String, required: true, unique: true },
  password:        String,
  isEmailVerified: { type: Boolean, default: false },
  role:            { type: String, default: "user" },
  plan:            { type: String, default: "free" },
  status:          { type: String, default: "active" },
  providers: [{
    provider:       String,
    providerUserId: String,
    createdAt:      Date,
  }],
  lastLoginAt: Date,
  createdAt:   Date,
  updatedAt:   Date,
}, { timestamps: false });

const timerSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:     String,
  target:   String,
  mode:     { type: String, default: "countdown" },
  egHours:  { type: Number, default: 48 },
  timezone: { type: String, default: "UTC" },
  language: { type: String, default: "English" },
  cfg:      mongoose.Schema.Types.Mixed,  // stored as real object, no JSON.stringify needed
  createdAt: Date,
  updatedAt: Date,
}, { timestamps: false });

const refreshTokenSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token:      String,
  expiresAt:  Date,
  revoked:    { type: Boolean, default: false },
  deviceInfo: String,
  ipAddress:  String,
  createdAt:  Date,
}, { timestamps: false });

const otpSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      String,
  otpCode:   String,
  expiresAt: Date,
  isUsed:    { type: Boolean, default: false },
  createdAt: Date,
}, { timestamps: false });

// Indexes
userSchema.index({ email: 1 }, { unique: true });
timerSchema.index({ userId: 1, updatedAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });          // auto-delete expired OTPs
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete expired tokens

const User         = mongoose.model("User",         userSchema);
const Timer        = mongoose.model("Timer",        timerSchema);
const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
const Otp          = mongoose.model("Otp",          otpSchema);

// ─── Migration ────────────────────────────────────────────────────────────────
async function migrate() {
  console.log("Connecting...");
  const db = await mysql.createPool(MYSQL);
  await mongoose.connect(MONGO_URI);
  console.log("Connected to both databases.\n");

  // ── 1. Users + embedded providers ──────────────────────────────────────────
  console.log("Migrating users...");
  const [users]     = await db.query("SELECT * FROM users");
  const [providers] = await db.query("SELECT * FROM user_providers");

  const idMap = {}; // mysqlId → mongo ObjectId

  for (const u of users) {
    const userProviders = providers
      .filter(p => p.user_id === u.id)
      .map(p => ({
        provider:       p.provider,
        providerUserId: p.provider_user_id,
        createdAt:      new Date(p.created_at),
      }));

    const doc = await User.create({
      _mysqlId:        u.id,
      email:           u.email,
      password:        u.password,
      isEmailVerified: !!u.is_email_verified,
      role:            u.role    || "user",
      plan:            u.plan    || "free",
      status:          u.status  || "active",
      providers:       userProviders,
      lastLoginAt:     u.last_login_at ? new Date(u.last_login_at) : null,
      createdAt:       new Date(u.created_at),
      updatedAt:       new Date(u.updated_at),
    });

    idMap[u.id] = doc._id;
    console.log(`  ✓ user ${u.email} → ${doc._id}`);
  }

  // ── 2. Timers ───────────────────────────────────────────────────────────────
  console.log("\nMigrating timers...");
  const [timers] = await db.query("SELECT * FROM timers");

  for (const t of timers) {
    let cfg = {};
    try { cfg = JSON.parse(t.cfg); } catch {}

    const userId = idMap[t.user_id];
    if (!userId) { console.warn(`  ✗ timer ${t.id}: no user found for user_id=${t.user_id}`); continue; }

    const doc = await Timer.create({
      userId,
      name:      t.name,
      target:    t.target,
      mode:      t.mode     || "countdown",
      egHours:   t.eg_hours || 48,
      timezone:  t.timezone || "UTC",
      language:  t.language || "English",
      cfg,                                  // stored as real object, never a string again
      createdAt: new Date(t.created_at),
      updatedAt: new Date(t.updated_at),
    });
    console.log(`  ✓ timer "${t.name}" → ${doc._id}`);
  }

  // ── 3. Refresh tokens ───────────────────────────────────────────────────────
  console.log("\nMigrating refresh_tokens...");
  const [tokens] = await db.query("SELECT * FROM refresh_tokens");

  for (const t of tokens) {
    const userId = idMap[t.user_id];
    if (!userId) { console.warn(`  ✗ token ${t.id}: no user found`); continue; }

    await RefreshToken.create({
      userId,
      token:      t.token,
      expiresAt:  new Date(t.expires_at),
      revoked:    !!t.revoked,
      deviceInfo: t.device_info || null,
      ipAddress:  t.ip_address  || null,
      createdAt:  new Date(t.created_at),
    });
  }
  console.log(`  ✓ ${tokens.length} refresh tokens migrated`);

  // ── 4. OTPs ─────────────────────────────────────────────────────────────────
  console.log("\nMigrating otps...");
  const [otps] = await db.query("SELECT * FROM otps");

  for (const o of otps) {
    const userId = idMap[o.user_id];
    if (!userId) { console.warn(`  ✗ otp ${o.id}: no user found`); continue; }

    await Otp.create({
      userId,
      type:      o.type,
      otpCode:   o.otp_code,
      expiresAt: new Date(o.expires_at),
      isUsed:    !!o.is_used,
      createdAt: new Date(o.created_at),
    });
  }
  console.log(`  ✓ ${otps.length} OTPs migrated`);

  // ── 5. Clean up temp field ──────────────────────────────────────────────────
  await User.updateMany({}, { $unset: { _mysqlId: 1 } });
  console.log("\n✅ Migration complete. _mysqlId temp fields removed.");

  await db.end();
  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});