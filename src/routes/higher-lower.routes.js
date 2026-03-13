const express = require("express");
const router = express.Router();
const controller = require("../controllers/higher-lower.controller");

// UI Routes
router.get("/higher-lower", controller.gamePage);
router.get("/higher-lower/play", controller.playPage);

// API Routes
router.get("/api/higher-lower/start", controller.getStartData);
router.post("/api/higher-lower/guess", controller.submitGuess);

module.exports = router;
