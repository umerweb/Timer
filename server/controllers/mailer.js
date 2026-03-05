// utils/mailer.js
const nodemailer = require("nodemailer");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const isProduction = !!process.env.BREVO_KEY;

// Gmail transporter (fallback / local dev)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER, // your Gmail address
    pass: process.env.GMAIL_PASS, // Gmail App Password
  },
});

// Brevo API client
let brevoClient;
if (isProduction) {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKey = defaultClient.authentications["api-key"];
  apiKey.apiKey = process.env.BREVO_KEY;
  brevoClient = new SibApiV3Sdk.TransactionalEmailsApi();
}

/**
 * Send an OTP email.
 * @param {string} to      - recipient email
 * @param {string} otp     - the 6-digit code
 * @param {"email_verify"|"password_reset"} type
 */
async function sendOtpEmail(to, otp, type = "email_verify") {
  const isReset = type === "password_reset";

  const subject = isReset
    ? "Your password reset code"
    : "Verify your email";

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

  try {
    if (isProduction) {
      // Send via Brevo API
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
        to: [{ email: to }],
        sender: { name: "Timerly", email: process.env.GMAIL_USER },
        subject,
        htmlContent: html,
      });

      await brevoClient.sendTransacEmail(sendSmtpEmail);
    } else {
      // Send via Gmail (local fallback)
      await transporter.sendMail({
        from: `"Timerly" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
      });
    }

    console.log(`OTP sent to ${to} via ${isProduction ? "Brevo" : "Gmail"}`);
  } catch (err) {
    console.error("Failed to send OTP email:", err);
  }
}

module.exports = { sendOtpEmail };