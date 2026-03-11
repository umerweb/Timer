const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const isProd = process.env.ENV === "prod";

let transporter;

if (isProd) {
  // Production: Hostinger SMTP
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,   // smtp.hostinger.com
    port:   Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== "false", // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else {
  // Development / Local: Gmail SMTP with App Password
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
}

async function sendOtpEmail(to, otp, type = "email_verify") {
  const isReset = type === "password_reset";

  const subject = isReset ? "Your password reset code" : "Verify your email";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <h2 style="margin:0 0 8px;color:#1e1b4b;font-size:22px;">
        ${isReset ? "🔑 Reset your password" : "✉️ Verify your email"}
      </h2>
      <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
        ${isReset
          ? "Use the code below to reset your password. It expires in 5 minutes."
          : "Use the code below to verify your email address. It expires in 5 minutes."}
      </p>
      <div style="background:#1e1b4b;color:#e0e7ff;font-size:36px;font-weight:700;
                  letter-spacing:10px;text-align:center;padding:20px;border-radius:10px;
                  font-family:monospace;">
        ${otp}
      </div>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;text-align:center;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;

  const from = isProd
    ? `"Timerly" <${process.env.SMTP_USER}>`
    : `"Timerly" <${process.env.GMAIL_USER}>`;

  await transporter.sendMail({ from, to, subject, html });
}

module.exports = { sendOtpEmail };