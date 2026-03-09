const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/verify-otp", authController.verifyOtp);
router.post("/login", authController.login);
router.post("/google", authController.googleLogin);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/resend-otp", authController.resendOtp);

module.exports = router;