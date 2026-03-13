/* ── Contrôleur Follow ─────────────────────────────────────── */
let db;
try { db = require("../db/db"); } catch (e) { db = null; }

// Helper: safely execute DB query
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
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    next();
}

// ── Toggle Follow ───────────────────────────────────────────
exports.toggleFollow = [requireAuth, async (req, res) => {
    try {
        const targetUserId = parseInt(req.body.targetUserId);
        const currentUserId = req.session.user.id;

        if (!targetUserId || targetUserId === currentUserId) {
            return res.status(400).json({ error: "Invalid user ID" });
        }

        // Check if already following
        const [existing] = await safeQuery(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [currentUserId, targetUserId]
        );

        if (existing.length > 0) {
            // Unfollow
            const [result] = await db.execute("DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
                [currentUserId, targetUserId]);
            console.log(`User ${currentUserId} unfollowed ${targetUserId}`);
            return res.json({ success: true, action: "unfollowed" });
        } else {
            // Follow
            await db.execute("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)",
                [currentUserId, targetUserId]);
            console.log(`User ${currentUserId} followed ${targetUserId}`);
            return res.json({ success: true, action: "followed" });
        }
    } catch (err) {
        console.error("Error toggling follow:", err);
        res.status(500).json({ error: "Failed to perform follow action", details: err.message });
    }
}];

// ── Helper: Check if user A follows user B ──────────────────
exports.getFollowStatus = async (currentUserId, targetUserId) => {
    try {
        const [rows] = await safeQuery(
            "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
            [currentUserId, targetUserId]
        );
        return rows.length > 0;
    } catch (err) {
        return false;
    }
};

// ── Helper: Get follower/following counts ───────────────────
exports.getFollowCounts = async (userId) => {
    try {
        const [followersRows] = await safeQuery(
            "SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [userId]
        );
        const [followingRows] = await safeQuery(
            "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [userId]
        );
        return {
            followers: followersRows[0]?.count || 0,
            following: followingRows[0]?.count || 0
        };
    } catch (err) {
        return { followers: 0, following: 0 };
    }
};

// ── Following List Page ─────────────────────────────────────
exports.followingPage = async (req, res) => {
    try {
        // Need to require profile controller helper if not in same file, but usually we can just query here
        // or actually since I modified profile.controller.js, I should check if I can share it.
        // For now, I'll just implement the same logic or use the DB.
        const paramId = req.params.id;
        let userId = parseInt(paramId.replace('Joueur#', ''));
        if (isNaN(userId)) userId = parseInt(paramId);

        const [userRows] = await safeQuery("SELECT id, username, avatar_url, banner_url, bio, location, created_at, follows_public FROM users WHERE id = ?", [userId]);
        
        let profileUser;
        if (userRows.length === 0) {
            profileUser = { id: userId, username: "Joueur#" + userId, bio: "Fan de jeux vidéo 🎮", avatar_url: null, created_at: new Date(), follows_public: false };
        } else {
            profileUser = userRows[0];
        }
        const isOwnProfile = req.session.user && req.session.user.id === userId;

        // Privacy: if not own profile and follows are private, show nothing
        const followsPrivate = !isOwnProfile && !profileUser.follows_public;

        let followingList = [];
        if (!followsPrivate) {
            const [rows] = await safeQuery(`
                SELECT u.id, u.username, u.avatar_url, u.bio, f.created_at as followed_at
                FROM follows f
                JOIN users u ON f.following_id = u.id
                WHERE f.follower_id = ?
                ORDER BY f.created_at DESC
            `, [userId]);
            followingList = rows;
        }

        const followCounts = await exports.getFollowCounts(userId);

        res.render("following.njk", {
            title: `${profileUser.username}'s Following — KC Catalogue`,
            profileUser,
            isOwnProfile,
            followingList,
            followsPrivate,
            followCounts
        });
    } catch (err) {
        console.error("Error rendering following page:", err);
        res.redirect("/");
    }
};

// ── Toggle follows privacy ──────────────────────────────────
exports.toggleFollowsPrivacy = [requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [rows] = await safeQuery("SELECT follows_public FROM users WHERE id = ?", [userId]);
        const currentValue = rows.length > 0 ? rows[0].follows_public : false;
        const newValue = !currentValue;
        await safeQuery("UPDATE users SET follows_public = ? WHERE id = ?", [newValue, userId]);
        req.session.user.follows_public = newValue;
        res.json({ success: true, follows_public: newValue });
    } catch (err) {
        console.error("Error toggling follows privacy:", err);
        res.status(500).json({ success: false });
    }
}];
