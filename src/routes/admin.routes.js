/* ── Routes Admin ──────────────────────────────────────────── */
const router = require("express").Router();
const admin = require("../controllers/admin.controller");

router.get("/", admin.dashboard);

// User Management
router.post("/ban/:id", admin.banUser);
router.post("/unban/:id", admin.unbanUser);
router.post("/delete/:id", admin.deleteUser);
router.post("/promote/:id", admin.promoteUser);
router.post("/demote/:id", admin.demoteUser);

// Moderation

router.post("/review/delete/:id", admin.deleteReview);
router.post("/report/dismiss/:id", admin.dismissReport);

// Game Management
router.post("/game/delete/:id", admin.deleteGameData);

module.exports = router;
