/* ── Routes Follow ─────────────────────────────────────────── */
const router = require("express").Router();
const follow = require("../controllers/follow.controller");

router.post("/toggle", follow.toggleFollow);

module.exports = router;
