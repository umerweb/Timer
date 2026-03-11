// const pool = require("../db");
// const bcrypt = require("bcrypt");
// const jwt = require("jsonwebtoken");
// const { OAuth2Client } = require("google-auth-library");
// const { sendOtpEmail } = require("./mailer");

// require("dotenv").config();

// const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// // Helper: format JS date to MySQL datetime string
// //const toMySQLDate = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
// // ✅ New — uses local time, matches MySQL NOW()
// const toMySQLDate = (ms) => {
//   const d = new Date(ms);
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
// };
// // Generate JWT
// const generateAccessToken = (user) =>
//   jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });

// const generateRefreshToken = (user) =>
//   jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });

// // ---------------------- REGISTER ----------------------
// exports.register = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password)
//       return res.status(400).json({ message: "Email and password required" });

//     const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
//     if (existingUsers.length) {
//       const [userProvider] = await pool.query(
//         "SELECT provider FROM user_providers WHERE user_id = ?",
//         [existingUsers[0].id]
//       );
//       if (userProvider.length && userProvider[0].provider !== "local") {
//         return res.status(400).json({ message: "This email is registered via Google. Use Google login." });
//       }
//       return res.status(400).json({ message: "Email already exists" });
//     }

//     const hashed = await bcrypt.hash(password, 10);
//     const [result] = await pool.query(
//       "INSERT INTO users (email, password) VALUES (?, ?)",
//       [email, hashed]
//     );
//     const userId = result.insertId;

//     await pool.query(
//       "INSERT INTO user_providers (user_id, provider) VALUES (?, ?)",
//       [userId, "local"]
//     );

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expires = toMySQLDate(Date.now() + 5 * 60 * 1000);

//     await pool.query(
//       "INSERT INTO otps (user_id, type, otp_code, expires_at) VALUES (?, ?, ?, ?)",
//       [userId, "email_verify", otp, expires]
//     );

//     try {
//       await sendOtpEmail(email, otp, "email_verify");
//       return res.json({ message: "User registered. Verify OTP.", userId });
//     } catch (e) {
//       console.error("Failed to send OTP email:", e);
//       return res.json({ message: "User registered. Verify OTP. OTP email failed", userId });
//     }
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// // ---------------------- VERIFY OTP ----------------------
// exports.verifyOtp = async (req, res) => {
//   try {
//     const { email, otp } = req.body;
//     const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
//     if (!users.length) return res.status(404).json({ message: "User not found" });

//     const user = users[0];
//     const [otpRows] = await pool.query(
//       "SELECT * FROM otps WHERE user_id = ? AND otp_code = ? AND is_used = FALSE AND expires_at > NOW()",
//       [user.id, otp]
//     );
//     if (!otpRows.length) return res.status(400).json({ message: "Invalid or expired OTP" });

//     await pool.query("UPDATE users SET is_email_verified = TRUE WHERE id = ?", [user.id]);
//     await pool.query("UPDATE otps SET is_used = TRUE WHERE id = ?", [otpRows[0].id]);

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     await pool.query(
//       "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
//       [user.id, refreshToken, toMySQLDate(Date.now() + 7 * 24 * 60 * 60 * 1000)]
//     );

//     res.cookie("refreshToken", refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//     });

//     res.json({ accessToken });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // ---------------------- RESEND OTP ----------------------
// exports.resendOtp = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email required" });

//     const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
//     if (!users.length) return res.status(404).json({ message: "User not found" });

//     const user = users[0];
//     if (user.is_email_verified) return res.status(400).json({ message: "Account already verified" });

//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expires = toMySQLDate(Date.now() + 5 * 60 * 1000);

//     await pool.query(
//       "INSERT INTO otps (user_id, type, otp_code, expires_at) VALUES (?, ?, ?, ?)",
//       [user.id, "email_verify", otp, expires]
//     );

//     await sendOtpEmail(user.email, otp, "email_verify");

//     res.json({ message: "OTP resent" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // ---------------------- LOGIN ----------------------
// exports.login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     if (!email || !password) return res.status(400).json({ message: "Email and password required" });

//     const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
//     if (!users.length) return res.status(400).json({ message: "Account does not exist" });

//     const user = users[0];

//     const [providers] = await pool.query("SELECT provider FROM user_providers WHERE user_id = ?", [user.id]);
//     if (providers.length && providers[0].provider !== "local") {
//       return res.status(400).json({ message: "This account is registered via Google. Use Google login." });
//     }

//     // If account not verified, generate new OTP
//     if (!user.is_email_verified) {
//       const otp = Math.floor(100000 + Math.random() * 900000).toString();
//       const expires = toMySQLDate(Date.now() + 5 * 60 * 1000);

//       await pool.query(
//         "INSERT INTO otps (user_id, type, otp_code, expires_at) VALUES (?, ?, ?, ?)",
//         [user.id, "email_verify", otp, expires]
//       );

//       await sendOtpEmail(user.email, otp, "email_verify");

//       return res.status(400).json({
//         message: "Account not verified. OTP sent.",
//         email: user.email,
//       });
//     }

//     // Check password
//     const match = await bcrypt.compare(password, user.password);
//     if (!match) return res.status(400).json({ message: "Incorrect password" });

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     await pool.query(
//       "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
//       [user.id, refreshToken, toMySQLDate(Date.now() + 7 * 24 * 60 * 60 * 1000)]
//     );

//     res.cookie("refreshToken", refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//     });

//     res.json({ accessToken });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// // ---------------------- GOOGLE LOGIN ----------------------
// exports.googleLogin = async (req, res) => {
//   try {
//     const { credential } = req.body;
//     const ticket = await client.verifyIdToken({
//       idToken: credential,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });
//     const payload = ticket.getPayload();
//     const { email, sub } = payload;

//     let [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
//     let user;

//     if (!users.length) {
//       const [result] = await pool.query("INSERT INTO users (email, is_email_verified) VALUES (?, TRUE)", [email]);
//       user = { id: result.insertId, role: "user" };
//       await pool.query(
//         "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, ?, ?)",
//         [user.id, "google", sub]
//       );
//     } else {
//       user = users[0];
//     }

//     const accessToken = generateAccessToken(user);
//     const refreshToken = generateRefreshToken(user);

//     await pool.query(
//       "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
//       [user.id, refreshToken, toMySQLDate(Date.now() + 7 * 24 * 60 * 60 * 1000)]
//     );

//     res.cookie("refreshToken", refreshToken, {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//     });

//     res.json({ accessToken });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Google login failed" });
//   }
// };

// // ---------------------- REFRESH TOKEN ----------------------
// exports.refreshToken = async (req, res) => {
//   try {
//     const token = req.cookies.refreshToken;
//     if (!token) return res.sendStatus(401);

//     const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
//     const [users] = await pool.query("SELECT * FROM users WHERE id = ?", [decoded.id]);
//     if (!users.length) return res.sendStatus(403);

//     const accessToken = generateAccessToken(users[0]);
//     res.json({ accessToken });
//   } catch (err) {
//     console.error(err);
//     res.sendStatus(403);
//   }
// };

// // ---------------------- LOGOUT ----------------------
// exports.logout = async (req, res) => {
//   try {
//     const token = req.cookies.refreshToken;
//     if (token) {
//       await pool.query(
//         "UPDATE refresh_tokens SET revoked = TRUE WHERE token = ?",
//         [token]
//       );
//     }
//     res.clearCookie("refreshToken");
//     res.json({ message: "Logged out" });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

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