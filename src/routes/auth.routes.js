/* ── Routes Auth ───────────────────────────────────────────── */
const router = require("express").Router();
const auth = require("../controllers/auth.controller");

router.get("/login", auth.loginPage);
router.post("/login", auth.login);
router.get("/register", auth.registerPage);
router.post("/register", auth.register);
router.get("/logout", auth.logout);

// --- OAuth ---
const passport = require("passport");

// Steam
router.get("/auth/steam", passport.authenticate("steam"));
router.get("/auth/steam/callback", passport.authenticate("steam", { failureRedirect: "/login" }), auth.oauthCallback);

// --- Forgot Password ---
router.get("/forgot-password", auth.forgotPasswordPage);
router.post("/forgot-password", auth.forgotPassword);
router.get("/reset-password/:token", auth.resetPasswordPage);
router.post("/reset-password/:token", auth.resetPassword);

module.exports = router;
