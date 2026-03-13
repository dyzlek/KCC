/* ── Routes Profil ─────────────────────────────────────────── */
const router = require("express").Router();
const profile = require("../controllers/profile.controller");
const follow = require("../controllers/follow.controller");


// Full Lists (Private) - Redirect to canonical URL /profile/:id/collection
router.get("/collection", (req, res) => {
    if (req.session.user) {
        res.redirect(`/profile/${req.session.user.id}/collection`);
    } else {
        res.redirect("/login");
    }
});

router.get("/wishlist", (req, res) => {
    if (req.session.user) {
        res.redirect(`/profile/${req.session.user.id}/wishlist`);
    } else {
        res.redirect("/login");
    }
});

router.get("/reviews", (req, res) => {
    if (req.session.user) {
        res.redirect(`/profile/${req.session.user.id}/reviews`);
    } else {
        res.redirect("/login");
    }
});

// Wishlist/review management
router.post("/wishlist/remove/:igdbId", profile.removeWishlist);
router.post("/review/delete/:reviewId", profile.deleteReview); // Must be before generic

// Privacy
router.post("/privacy/wishlist-toggle", profile.toggleWishlistPrivacy);
router.post("/privacy/follows-toggle", follow.toggleFollowsPrivacy);
router.post("/privacy/info-toggle", profile.toggleInfoPrivacy);

// Security
router.post("/security/password", profile.updatePassword);
router.post("/security/delete", profile.deleteAccount);

// Profil privé (connecté)
router.get("/", profile.privatePage);
router.post("/update", profile.uploadMiddleware, profile.update);

// Full Lists (Public)
router.get("/:id/collection", profile.userCollection);
router.get("/:id/wishlist", profile.userWishlist);
router.get("/:id/reviews", profile.userReviews);
router.get("/:id/following", follow.followingPage);

// Profil public (catch-all for IDs)
router.get("/:id", profile.publicPage);

module.exports = router;
