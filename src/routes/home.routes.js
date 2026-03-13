/* ── Routes Accueil ─────────────────────────────────────────── */
const router = require("express").Router();
const home = require("../controllers/home.controller");

const game = require("../controllers/game.controller");

router.get("/", home.index);
router.get("/search", home.search);
router.get("/calendar", game.calendar); // Moved to root level
router.get("/genre/:id", home.genre);
router.get("/platform/:id", home.platform);
router.get("/terms", home.terms);
router.get("/privacy", home.privacy);

module.exports = router;
