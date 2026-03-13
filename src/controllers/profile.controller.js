/* ── Contrôleur Profil ─────────────────────────────────────── */
const bcrypt = require("bcryptjs");
let db;
try { db = require("../db/db"); } catch (e) { db = null; }
const followController = require("./follow.controller");
const steamService = require("../services/steam.service");
const fileService = require("../services/file.service");

// Helper: safely execute DB query, return empty result on error
async function safeQuery(query, params) {
    if (!db) return [[]];
    try {
        return await db.execute(query, params);
    } catch (err) {
        console.warn("DB unavailable:", err.code || err.message);
        return [[]];
    }
}

// Middleware : vérifier que l'utilisateur est connecté
function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}

// Helper: Calculate profile stats
async function calculateStats(userId) {
    const stats = {
        total_games: 0,
        mean_score: 0,
        status_counts: {
            playing: 0,
            completed: 0,
            plan_to_play: 0,
            dropped: 0,
            on_hold: 0
        },
        reviews_count: 0,
        wishlist_count: 0,
        reports_count: 0,
        higher_lower_best: 0
    };

    // Get Collection Stats
    const colResult = await safeQuery(
        `SELECT status, COUNT(*) as count FROM collections WHERE user_id = ? GROUP BY status`,
        [userId]
    );

    if (colResult && colResult[0]) {
        colResult[0].forEach(row => {
            if (stats.status_counts.hasOwnProperty(row.status)) {
                stats.status_counts[row.status] = row.count;
                stats.total_games += row.count;
            }
        });
    }

    // Get Mean Score
    const scoreResult = await safeQuery(
        `SELECT AVG(rating) as mean_score FROM reviews WHERE user_id = ?`,
        [userId]
    );

    if (scoreResult && scoreResult[0] && scoreResult[0].length > 0 && scoreResult[0][0].mean_score) {
        stats.mean_score = parseFloat(scoreResult[0][0].mean_score).toFixed(2);
    }

    // Get Total Reviews Count for Badges
    const revCountResult = await safeQuery(
        `SELECT COUNT(*) as count FROM reviews WHERE user_id = ?`,
        [userId]
    );
    if (revCountResult && revCountResult[0]) {
        stats.reviews_count = revCountResult[0][0].count;
    }

    // Get Total Wishlist Count for Badges
    const wlCountResult = await safeQuery(
        `SELECT COUNT(*) as count FROM wishlists WHERE user_id = ?`,
        [userId]
    );
    if (wlCountResult && wlCountResult[0]) {
        stats.wishlist_count = wlCountResult[0][0].count;
    }

    // Get Total Reports Made for Badges (Justice)
    const reportCountResult = await safeQuery(
        `SELECT COUNT(*) as count FROM reports WHERE reporter_id = ?`,
        [userId]
    );
    if (reportCountResult && reportCountResult[0]) {
        stats.reports_count = reportCountResult[0][0].count;
    }

    // Get Higher Lower Best Score
    const hlScoreResult = await safeQuery(
        `SELECT MAX(score) as best FROM higher_lower_scores WHERE user_id = ?`,
        [userId]
    );
    if (hlScoreResult && hlScoreResult[0] && hlScoreResult[0].length > 0) {
        stats.higher_lower_best = hlScoreResult[0][0].best || 0;
    }

    return stats;
}

// Helper: Calculate Badges
function calculateBadges(stats) {
    const badges = [];

    // Critic Badges (Reviews)
    if (stats.reviews_count >= 100) {
        badges.push({ name: "Master Critic", icon: "military_tech", color: "text-amber-400", description: "Written 100+ reviews" });
    } else if (stats.reviews_count >= 10) {
        badges.push({ name: "Expert Critic", icon: "stars", color: "text-blue-400", description: "Written 10+ reviews" });
    } else if (stats.reviews_count >= 1) {
        badges.push({ name: "Novice Critic", icon: "rate_review", color: "text-green-400", description: "Written your first review" });
    }

    // Justice Badges (Reports)
    if (stats.reports_count >= 100) {
        badges.push({ name: "Justice Master", icon: "gavel", color: "text-amber-400", description: "Reported 100+ issues" });
    } else if (stats.reports_count >= 10) {
        badges.push({ name: "Sentinel", icon: "security", color: "text-blue-400", description: "Reported 10+ issues" });
    } else if (stats.reports_count >= 1) {
        badges.push({ name: "Watchdog", icon: "visibility", color: "text-green-400", description: "Reported your first issue" });
    }

    // Collector Badges (Wishlist)
    if (stats.wishlist_count >= 50) {
        badges.push({ name: "Wishlist Hoarder", icon: "inventory", color: "text-amber-400", description: "50+ games in wishlist" });
    } else if (stats.wishlist_count >= 10) {
        badges.push({ name: "Wishlist Collector", icon: "collections_bookmark", color: "text-blue-400", description: "10+ games in wishlist" });
    } else if (stats.wishlist_count >= 1) {
        badges.push({ name: "Wishlist Starter", icon: "auto_awesome", color: "text-green-400", description: "Started your wishlist" });
    }

    // Steam Badge
    if (stats.steam_id) {
        badges.push({ name: "Steam Linked", icon: "sports_esports", color: "text-blue-300", description: "Connected with Steam" });
    }

    // Higher Lower Badge
    if (stats.higher_lower_best > 0) {
        badges.push({ name: "Higher Lower Player", icon: "trending_up", color: "text-indigo-400", description: "Played the Higher or Lower game" });
    }

    return badges;
}

// Helper: Get user from DB or return ghost profile
async function getUserOrGhost(rawId) {
    let userId = null;

    // Handle "Joueur#X" format
    if (typeof rawId === 'string' && rawId.startsWith('Joueur#')) {
        userId = parseInt(rawId.replace('Joueur#', ''));
    } else {
        userId = parseInt(rawId);
    }

    if (isNaN(userId)) return null;

    const [rows] = await safeQuery(
        "SELECT id, username, bio, avatar_url, banner_url, location, birthday, gender, created_at, wishlist_public, follows_public, info_public, steam_id FROM users WHERE id = ?",
        [userId]
    );
    if (rows.length > 0) return { user: rows[0], isGhost: false };

    return null;
}

// Helper: Calculate Age from Birthday
function calculateAge(birthday) {
    if (!birthday) return null;
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

exports.privatePage = [requireAuth, async (req, res) => {
    try {
        // Fetch fresh user data
        const [userRows] = await safeQuery("SELECT * FROM users WHERE id = ?", [req.session.user.id]);
        if (userRows.length > 0) {
            req.session.user = { ...req.session.user, ...userRows[0] };
        }

        const stats = await calculateStats(req.session.user.id);

        const [wlRows] = await safeQuery(
            `SELECT w.*, g.name as game_name, g.cover_url as game_cover, g.igdb_id
             FROM wishlists w
             JOIN games g ON w.game_id = g.id
             WHERE w.user_id = ? 
             ORDER BY w.added_at DESC
             LIMIT 5`, // Limit for overview
            [req.session.user.id]
        );

        const [colRows] = await safeQuery(
            `SELECT c.*, g.name as game_name, g.cover_url as game_cover, g.igdb_id
             FROM collections c
             JOIN games g ON c.game_id = g.id
             WHERE c.user_id = ? 
             ORDER BY c.updated_at DESC
             LIMIT 5`, // Limit for overview
            [req.session.user.id]
        );

        const [revRows] = await safeQuery(
            `SELECT r.*, g.name as game_name, g.cover_url as game_cover, g.igdb_id, r.rating as score
             FROM reviews r
             JOIN games g ON r.game_id = g.id
             WHERE r.user_id = ? 
             ORDER BY r.created_at DESC
             LIMIT 5`, // Limit for overview
            [req.session.user.id]
        );

        const followCounts = await followController.getFollowCounts(req.session.user.id);
        
        // Steam data
        let steamStats = null;
        if (req.session.user.steam_id) {
            steamStats = await steamService.getSteamPlaytime(req.session.user.steam_id);
            stats.steam_id = req.session.user.steam_id; // For badge logic
        }

        const badges = calculateBadges(stats);

        res.render("profile-private.njk", {
            title: "Mon Profil — KC Catalogue",
            profileUser: req.session.user,
            stats,
            badges,
            wishlist: wlRows,
            collection: colRows,
            reviews: revRows,
            user: req.session.user,
            followCounts,
            steamStats, // Pass steam stats to view
            success: req.session.success,
            error: req.session.error
        });
        // Clear flash messages
        req.session.success = null;
        req.session.error = null;
    } catch (err) {
        console.error("Erreur profil privé:", err);
        res.redirect("/");
    }
}];

const multer = require("multer");
const path = require("path");

// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage: storage });

exports.uploadMiddleware = upload.fields([{ name: "avatar", maxCount: 1 }, { name: "banner", maxCount: 1 }]);


exports.update = [requireAuth, async (req, res) => {
    try {
        const { username, bio, location, birthday, gender } = req.body;
        const userId = req.session.user.id;
        let avatarUrl = req.session.user.avatar_url;
        let bannerUrl = req.session.user.banner_url;

        if (req.files) {
            if (req.files.avatar) {
                if (avatarUrl && avatarUrl !== "/uploads/" + req.files.avatar[0].filename) {
                    fileService.deleteLocalFile(avatarUrl);
                }
                avatarUrl = "/uploads/" + req.files.avatar[0].filename;
            }
            if (req.files.banner) {
                if (bannerUrl && bannerUrl !== "/uploads/" + req.files.banner[0].filename) {
                    fileService.deleteLocalFile(bannerUrl);
                }
                bannerUrl = "/uploads/" + req.files.banner[0].filename;
            }
        }

        await safeQuery(
            "UPDATE users SET username = ?, bio = ?, avatar_url = ?, banner_url = ?, location = ?, birthday = ?, gender = ? WHERE id = ?",
            [username, bio, avatarUrl, bannerUrl, location, birthday || null, gender || null, userId]
        );

        req.session.user.username = username || req.session.user.username;
        req.session.user.bio = bio || "";
        req.session.user.avatar_url = avatarUrl;
        req.session.user.banner_url = bannerUrl;
        req.session.user.location = location;
        req.session.user.birthday = birthday;
        req.session.user.gender = gender;

        res.redirect("/profile");
    } catch (err) {
        console.error("Erreur update profil:", err);
        res.redirect("/profile");
    }
}];

// Profil public (catch-all for IDs)
exports.publicPage = async (req, res) => {
    try {
        const result = await getUserOrGhost(req.params.id);
        if (!result) return res.status(404).render("404.njk", { 
            title: "Profile Not Found", 
            customMessage: "This profile does not exist." 
        });

        const profileUser = result.user;
        const userId = profileUser.id;

        // Calculate age if allowed or own profile
        let isOwnProfile = false;
        if (req.session.user && req.session.user.id === userId) {
            isOwnProfile = true;
        }

        const showInfo = profileUser.info_public || isOwnProfile;
        if (showInfo) {
            profileUser.age = calculateAge(profileUser.birthday);
        } else {
            // Mask info if private
            profileUser.location = null;
            profileUser.birthday = null;
            profileUser.gender = null;
        }

        // Steam profile URL
        if (profileUser.steam_id) {
            profileUser.steam_url = `https://steamcommunity.com/profiles/${profileUser.steam_id}`;
        }

        const stats = await calculateStats(userId);
        const followCounts = await followController.getFollowCounts(userId);
        
        // Steam data
        let steamStats = null;
        if (profileUser.steam_id) {
            steamStats = await steamService.getSteamPlaytime(profileUser.steam_id);
            stats.steam_id = profileUser.steam_id; // For badge logic
        }

        const badges = calculateBadges(stats);

        let isFollowing = false;
        if (req.session.user && !isOwnProfile) {
            isFollowing = await followController.getFollowStatus(req.session.user.id, userId);
        }

        const [revRows] = await safeQuery(
            `SELECT r.*, g.name as game_name, g.cover_url as game_cover, g.igdb_id, r.rating as score
             FROM reviews r
             JOIN games g ON r.game_id = g.id
             WHERE r.user_id = ? 
             ORDER BY r.created_at DESC
             LIMIT 5`,
            [userId]
        );

        res.render("profile-public.njk", {
            title: `${profileUser.username} — KC Catalogue`,
            profileUser,
            stats,
            badges,
            reviews: revRows,
            isOwnProfile,
            wishlistPublic: profileUser.wishlist_public,
            followsPublic: profileUser.follows_public,
            isFollowing,
            followCounts,
            steamStats // Pass steam stats to view
        });
    } catch (err) {
        console.error("Public profile error:", err);
        res.redirect("/");
    }
};

exports.removeWishlist = [requireAuth, async (req, res) => {
    try {
        const igdbId = parseInt(req.params.igdbId);
        // We need to join games to find by igdb_id key
        await safeQuery(`
            DELETE w FROM wishlists w
            JOIN games g ON w.game_id = g.id
            WHERE w.user_id = ? AND g.igdb_id = ?`,
            [req.session.user.id, igdbId]);
    } catch (err) {
        console.error("Erreur suppression wishlist:", err);
    }
    res.redirect("/profile");
}];

exports.deleteReview = [requireAuth, async (req, res) => {
    try {
        const reviewId = parseInt(req.params.reviewId);
        await safeQuery("DELETE FROM reviews WHERE id = ? AND user_id = ?",
            [reviewId, req.session.user.id]);
    } catch (err) {
        console.error("Erreur suppression review:", err);
    }
    res.redirect("/profile");
}];

exports.updatePassword = [requireAuth, async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;
        const userId = req.session.user.id;

        if (!current_password || !new_password || !confirm_password) {
            req.session.error = "All fields are required.";
            return res.redirect("/profile#security");
        }

        if (new_password !== confirm_password) {
            req.session.error = "New passwords do not match.";
            return res.redirect("/profile#security");
        }

        // Get current user password
        const [rows] = await safeQuery("SELECT password FROM users WHERE id = ?", [userId]);
        if (rows.length === 0) return res.redirect("/");

        const user = rows[0];
        const valid = await bcrypt.compare(current_password, user.password);

        if (!valid) {
            req.session.error = "Incorrect current password.";
            return res.redirect("/profile#security");
        }

        const hash = await bcrypt.hash(new_password, 10);
        await safeQuery("UPDATE users SET password = ? WHERE id = ?", [hash, userId]);

        req.session.success = "Password updated successfully.";
        res.redirect("/profile#security");
    } catch (err) {
        console.error("Error updating password:", err);
        res.redirect("/profile");
    }
}];

exports.deleteAccount = [requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Fetch user files before deletion
        const [userRows] = await safeQuery("SELECT avatar_url, banner_url FROM users WHERE id = ?", [userId]);
        if (userRows.length > 0) {
            const { avatar_url, banner_url } = userRows[0];
            fileService.deleteLocalFile(avatar_url);
            fileService.deleteLocalFile(banner_url);
        }

        // Cascading delete should handle related data (reviews, collections, etc.)
        await safeQuery("DELETE FROM users WHERE id = ?", [userId]);

        req.session.destroy(() => {
            res.redirect("/");
        });
    } catch (err) {
        console.error("Error deleting account:", err);
        res.redirect("/profile");
    }
}];

// ── Full List Views ─────────────────────────────────────────

// Helper to render collection list
async function renderCollection(req, res, userId, isOwnProfile) {
    try {
        const result = await getUserOrGhost(userId);
        if (!result) return res.status(404).render("404.njk", { 
            title: "Profile Not Found", 
            customMessage: "This profile does not exist." 
        });
        const profileUser = result.user;

        const [rows] = await safeQuery(
            `SELECT c.*, g.name, g.cover_url, g.igdb_id, g.first_release_date, g.genres
             FROM collections c
             JOIN games g ON c.game_id = g.id
             WHERE c.user_id = ? 
             ORDER BY c.updated_at DESC`,
            [userId]
        );

        const stats = await calculateStats(userId);

        res.render("profile-list.njk", {
            title: `${profileUser.username}'s Collection — KC Catalogue`,
            profileUser,
            isOwnProfile,
            listType: 'collection',
            items: rows,
            stats,
            user: req.session.user
        });
    } catch (err) {
        console.error("Error rendering collection:", err);
        res.redirect("/");
    }
}

// Helper to render wishlist
async function renderWishlist(req, res, userId, isOwnProfile) {
    try {
        const result = await getUserOrGhost(userId);
        if (!result) return res.status(404).render("404.njk", { 
            title: "Profile Not Found", 
            customMessage: "This profile does not exist." 
        });
        const profileUser = result.user;

        // If not own profile and wishlist is private, show privacy message
        const wishlistPrivate = !isOwnProfile && !profileUser.wishlist_public;

        let rows = [];
        if (!wishlistPrivate) {
            const [wRows] = await safeQuery(
                `SELECT w.*, g.name, g.cover_url, g.igdb_id, g.first_release_date, g.genres
                 FROM wishlists w
                 JOIN games g ON w.game_id = g.id
                 WHERE w.user_id = ? 
                 ORDER BY w.added_at DESC`,
                [userId]
            );
            rows = wRows;
        }

        const stats = await calculateStats(userId);

        res.render("profile-list.njk", {
            title: `${profileUser.username}'s Wishlist — KC Catalogue`,
            profileUser,
            isOwnProfile,
            listType: 'wishlist',
            items: rows,
            stats,
            wishlistPrivate,
            user: req.session.user
        });
    } catch (err) {
        console.error("Error rendering wishlist:", err);
        res.redirect("/");
    }
}

exports.toggleWishlistPrivacy = [requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [rows] = await safeQuery("SELECT wishlist_public FROM users WHERE id = ?", [userId]);
        const currentValue = rows.length > 0 ? rows[0].wishlist_public : false;
        const newValue = !currentValue;
        await safeQuery("UPDATE users SET wishlist_public = ? WHERE id = ?", [newValue, userId]);
        req.session.user.wishlist_public = newValue;
        res.json({ success: true, wishlist_public: newValue });
    } catch (err) {
        console.error("Error toggling wishlist privacy:", err);
        res.status(500).json({ success: false });
    }
}];

exports.toggleInfoPrivacy = [requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [rows] = await safeQuery("SELECT info_public FROM users WHERE id = ?", [userId]);
        const currentValue = rows.length > 0 ? rows[0].info_public : false;
        const newValue = !currentValue;
        await safeQuery("UPDATE users SET info_public = ? WHERE id = ?", [newValue, userId]);
        req.session.user.info_public = newValue;
        res.json({ success: true, info_public: newValue });
    } catch (err) {
        console.error("Error toggling info privacy:", err);
        res.status(500).json({ success: false });
    }
}];

exports.myCollection = [requireAuth, (req, res) => renderCollection(req, res, req.session.user.id, true)];
exports.myWishlist = [requireAuth, (req, res) => renderWishlist(req, res, req.session.user.id, true)];


// Helper to render reviews list
async function renderReviews(req, res, userId, isOwnProfile) {
    try {
        const result = await getUserOrGhost(userId);
        if (!result) return res.status(404).render("404.njk", { 
            title: "Profile Not Found", 
            customMessage: "This profile does not exist." 
        });
        const profileUser = result.user;

        const [rows] = await safeQuery(
            `SELECT r.*, g.name as game_name, g.cover_url as game_cover, g.igdb_id, r.rating as score
             FROM reviews r
             JOIN games g ON r.game_id = g.id
             WHERE r.user_id = ? 
             ORDER BY r.created_at DESC`,
            [userId]
        );

        const stats = await calculateStats(userId);

        res.render("profile-reviews.njk", {
            title: `${profileUser.username}'s Reviews — KC Catalogue`,
            profileUser,
            isOwnProfile,
            reviews: rows,
            stats,
            user: req.session.user
        });
    } catch (err) {
        console.error("Error rendering reviews:", err);
        res.redirect("/");
    }
}

exports.userCollection = async (req, res) => {
    const userId = parseInt(req.params.id);
    const isOwnProfile = req.session.user && req.session.user.id === userId;
    await renderCollection(req, res, userId, isOwnProfile);
};

exports.userWishlist = async (req, res) => {
    const userId = parseInt(req.params.id);
    const isOwnProfile = req.session.user && req.session.user.id === userId;
    await renderWishlist(req, res, userId, isOwnProfile);
};

exports.userReviews = async (req, res) => {
    const userId = parseInt(req.params.id);
    const isOwnProfile = req.session.user && req.session.user.id === userId;
    await renderReviews(req, res, userId, isOwnProfile);
};

exports.myReviews = [requireAuth, (req, res) => renderReviews(req, res, req.session.user.id, true)];
