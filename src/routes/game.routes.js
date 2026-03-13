/* ── Routes Jeu ────────────────────────────────────────────── */
const router = require("express").Router();
const game = require("../controllers/game.controller");


router.get("/:id", game.detail);
router.post("/:id/wishlist", game.toggleWishlist);
router.post("/:id/collection", game.updateCollectionStatus);
router.post("/:id/review", game.addReview);
router.post("/:id/review/delete", game.deleteReview);
router.post("/:id/review/:reviewId/report", game.reportReview);

module.exports = router;
