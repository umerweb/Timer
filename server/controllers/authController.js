const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { sendOtpEmail } = require("./mailer");

require("dotenv").config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};

// REGISTER
exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const hashed = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hashed]
    );

    const userId = result.insertId;

    await pool.query(
      "INSERT INTO user_providers (user_id, provider) VALUES (?, ?)",
      [userId, "local"]
    );

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60000);

    await pool.query(
      "INSERT INTO otps (user_id, type, otp_code, expires_at) VALUES (?, ?, ?, ?)",
      [userId, "email_verify", otp, expires]
    );

    try {
        try {
        await sendOtpEmail(email, otp, "email_verify");
        } catch (e) {
          console.error("Failed to send OTP email:", e);
        }

        // Send OTP back to frontend (for demo/testing)
        res.json({
          message: "User registered. Verify OTP.",
          otp,        // <-- sending OTP to frontend
          userId,
        });
    } catch (e) {
      console.error("Failed to send OTP email:", e);
    }

    res.json({ message: "User registered. Verify OTP." });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Email already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (!users.length) return res.status(404).json({ message: "User not found" });

    const user = users[0];

    const [otpRows] = await pool.query(
      "SELECT * FROM otps WHERE user_id = ? AND otp_code = ? AND is_used = FALSE",
      [user.id, otp]
    );
    if (!otpRows.length) return res.status(400).json({ message: "Invalid OTP" });

    await pool.query("UPDATE users SET is_email_verified = TRUE WHERE id = ?", [
      user.id,
    ]);
    await pool.query("UPDATE otps SET is_used = TRUE WHERE id = ?", [otpRows[0].id]);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (!users.length)
      return res.status(400).json({ message: "Invalid credentials" });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GOOGLE LOGIN
exports.googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, sub } = payload;

    let [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    let user;

    if (!users.length) {
      const [result] = await pool.query(
        "INSERT INTO users (email, is_email_verified) VALUES (?, TRUE)",
        [email]
      );
      user = { id: result.insertId, role: "user" };
      await pool.query(
        "INSERT INTO user_providers (user_id, provider, provider_user_id) VALUES (?, ?, ?)",
        [user.id, "google", sub]
      );
    } else {
      user = users[0];
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await pool.query(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// REFRESH
exports.refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.sendStatus(401);

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const [users] = await pool.query("SELECT * FROM users WHERE id = ?", [
      decoded.id,
    ]);
    if (!users.length) return res.sendStatus(403);

    const accessToken = generateAccessToken(users[0]);
    res.json({ accessToken });
  } catch (err) {
    console.error(err);
    res.sendStatus(403);
  }
};

// LOGOUT
exports.logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await pool.query(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE token = ?",
        [token]
      );
    }
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};