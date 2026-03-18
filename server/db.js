
const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => { console.error("MongoDB connection error:", err); process.exit(1); });

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  email:           { type: String, required: true, unique: true },
  password:        String,
  isEmailVerified: { type: Boolean, default: false },
  role:            { type: String, default: "user" },
  plan:            { type: String, default: null },
  stripeCustomerId:     { type: String, default: null },     // ← ADD this
  stripeSubscriptionId: { type: String, default: null },     // ← ADD this
  status:          { type: String, default: "active" },
  providers: [{
    provider:       String,
    providerUserId: String,
    createdAt:      { type: Date, default: Date.now },
  }],
  lastLoginAt: Date,
}, { timestamps: true });

const timerSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:     { type: String, required: true },
  target:   String,
  mode:     { type: String, default: "countdown" },
  egHours:  { type: Number, default: 48 },
  timezone: { type: String, default: "UTC" },
  language: { type: String, default: "English" },
  cfg:      { type: mongoose.Schema.Types.Mixed, default: {} },
  views:    { type: Number, default: 0 },
}, { timestamps: true });

const refreshTokenSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  token:      { type: String, required: true },
  expiresAt:  { type: Date, required: true },
  revoked:    { type: Boolean, default: false },
  deviceInfo: String,
  ipAddress:  String,
}, { timestamps: true });

const otpSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:      String,
  otpCode:   String,
  expiresAt: { type: Date, required: true },
  isUsed:    { type: Boolean, default: false },
}, { timestamps: true });

// ─── Indexes ──────────────────────────────────────────────────────────────────
//userSchema.index({ email: 1 }, { unique: true });
timerSchema.index({ userId: 1, updatedAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });           // auto-delete expired OTPs
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-delete expired tokens

// ─── Models ───────────────────────────────────────────────────────────────────
const User         = mongoose.model("User",         userSchema);
const Timer        = mongoose.model("Timer",        timerSchema);
const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
const Otp          = mongoose.model("Otp",          otpSchema);

module.exports = { User, Timer, RefreshToken, Otp };