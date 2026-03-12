const { User, RefreshToken, Otp } = require("../db");
const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendOtpEmail } = require("./mailer");
require("dotenv").config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateAccessToken = (user) =>
  jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });

const generateRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax",
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const existing = await User.findOne({ email });
    if (existing) {
      const isGoogle = existing.providers.some(p => p.provider === "google");
      if (isGoogle) return res.status(400).json({ message: "This email is registered via Google. Use Google login." });
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashed,
      providers: [{ provider: "local" }],
    });

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.create({ userId: user._id, type: "email_verify", otpCode: otp, expiresAt: expires });

    try {
      await sendOtpEmail(email, otp, "email_verify");
      return res.json({ message: "User registered. Verify OTP.", userId: user._id });
    } catch (e) {
      console.error("OTP email failed:", e);
      return res.json({ message: "User registered. Verify OTP. OTP email failed", userId: user._id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpDoc = await Otp.findOne({
      userId:    user._id,
      otpCode:   otp,
      isUsed:    false,
      expiresAt: { $gt: new Date() },
    });
    if (!otpDoc) return res.status(400).json({ message: "Invalid or expired OTP" });

    user.isEmailVerified = true;
    await user.save();
    otpDoc.isUsed = true;
    await otpDoc.save();

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId:    user._id,
      token:     refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── RESEND OTP ───────────────────────────────────────────────────────────────
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Account already verified" });

    const otp     = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    await Otp.create({ userId: user._id, type: "email_verify", otpCode: otp, expiresAt: expires });
    await sendOtpEmail(email, otp, "email_verify");

    res.json({ message: "OTP resent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Account does not exist" });

    const isGoogle = user.providers.some(p => p.provider === "google");
    if (isGoogle) return res.status(400).json({ message: "This account uses Google login." });

    if (!user.isEmailVerified) {
      const otp     = Math.floor(100000 + Math.random() * 900000).toString();
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      await Otp.create({ userId: user._id, type: "email_verify", otpCode: otp, expiresAt: expires });
      await sendOtpEmail(user.email, otp, "email_verify");
      return res.status(400).json({ message: "Account not verified. OTP sent.", email: user.email });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Incorrect password" });

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId:    user._id,
      token:     refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─── GOOGLE LOGIN ─────────────────────────────────────────────────────────────
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket  = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const { email, sub } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        isEmailVerified: true,
        providers: [{ provider: "google", providerUserId: sub }],
      });
    }

    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId:    user._id,
      token:     refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Google login failed" });
  }
};

// ─── REFRESH TOKEN ────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.sendStatus(401);

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user) return res.sendStatus(403);

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.sendStatus(403);
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await RefreshToken.updateOne({ token }, { revoked: true });
    }
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};