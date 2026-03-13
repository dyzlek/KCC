/* ── Contrôleur Admin ──────────────────────────────────────── */
let db;
try { db = require("../db/db"); } catch (e) { db = null; }
const fileService = require("../services/file.service");

// Middleware : vérifier admin
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== "admin") return res.redirect("/");
    next();
}

// Helper for safe query
async function safeQuery(query, params) {
    if (!db) return [[]];
    try {
        return await db.execute(query, params);
    } catch (err) {
        console.warn("DB Error:", err);
        return [[]]; // Return empty result set structure
    }
}

// Log admin action
async function logAction(adminId, actionType, targetUserId = null, targetReviewId = null, details = null) {
    await safeQuery(
        "INSERT INTO admin_actions (admin_id, action_type, target_user_id, target_review_id, details) VALUES (?, ?, ?, ?, ?)",
        [adminId, actionType, targetUserId, targetReviewId, details]
    );
}

exports.dashboard = [requireAdmin, async (req, res) => {
    try {
        const tab = req.query.tab || 'users';
        const searchQuery = req.query.search || '';

        // STATS
        const [userStats] = await safeQuery("SELECT COUNT(*) as total, SUM(is_banned) as banned FROM users");
        const [reviewStats] = await safeQuery("SELECT COUNT(*) as total FROM reviews");
        const [reportStats] = await safeQuery("SELECT COUNT(*) as pending FROM reports WHERE status = 'pending'");

        let users = [], reports = [], logs = [], localGames = [];

        // LOAD DATA BASED ON TAB
        if (tab === 'users') {
            let query = "SELECT id, username, email, role, is_banned, created_at FROM users";
            let params = [];
            if (searchQuery) {
                query += " WHERE username LIKE ? OR email LIKE ?";
                params = [`%${searchQuery}%`, `%${searchQuery}%`];
            }
            query += " ORDER BY created_at DESC LIMIT 50";
            const [rows] = await safeQuery(query, params);
            users = rows;
        }
        else if (tab === 'moderation') {
            const statusFilter = req.query.status || 'all';
            let moderationQuery = `
                SELECT r.id, r.reason, r.status, r.created_at,
                       u.username as reporter_name,
                       rev.content as review_content, rev.id as review_id, rev.is_hidden,
                       ru.username as reported_user_name, ru.id as reported_user_id
                FROM reports r
                JOIN users u ON r.reporter_id = u.id
                JOIN reviews rev ON r.review_id = rev.id
                JOIN users ru ON rev.user_id = ru.id
            `;
            const params = [];
            if (statusFilter !== 'all') {
                moderationQuery += ' WHERE r.status = ?';
                params.push(statusFilter);
            }
            moderationQuery += ' ORDER BY r.created_at DESC';
            const [rows] = await safeQuery(moderationQuery, params);
            reports = rows;
        }
        else if (tab === 'logs') {
            const logSearch = req.query.logSearch || '';
            let logsQuery = `
                SELECT a.*, u.username as admin_name
                FROM admin_actions a
                JOIN users u ON a.admin_id = u.id
            `;
            const logParams = [];
            if (logSearch) {
                logsQuery += ` WHERE u.username LIKE ? OR a.action_type LIKE ? OR a.details LIKE ?`;
                logParams.push(`%${logSearch}%`, `%${logSearch}%`, `%${logSearch}%`);
            }
            logsQuery += ' ORDER BY a.created_at DESC LIMIT 100';
            const [rows] = await safeQuery(logsQuery, logParams);
            logs = rows;
        }
        else if (tab === 'games') {
            // List games that have local data (reviews or wishlist presence)
            // This is a simplified approach to show "managed" games
            const [rows] = await safeQuery(`
                SELECT DISTINCT r.igdb_id, r.game_name, r.game_cover, 
                (SELECT COUNT(*) FROM reviews WHERE igdb_id = r.igdb_id) as review_count
                FROM reviews r
                UNION
                SELECT DISTINCT w.igdb_id, w.game_name, w.game_cover,
                (SELECT COUNT(*) FROM reviews WHERE igdb_id = w.igdb_id) as review_count
                FROM wishlists w
                LIMIT 50
             `);
            localGames = rows;
        }

        res.render("admin.njk", {
            title: "Administration — KC Catalogue",
            tab,
            searchQuery,
            statusFilter: req.query.status || 'all',
            logSearch: req.query.logSearch || '',
            users,
            reports,
            logs,
            localGames,
            stats: {
                totalUsers: userStats[0]?.total || 0,
                bannedUsers: userStats[0]?.banned || 0,
                totalReviews: reviewStats[0]?.total || 0,
                pendingReports: reportStats[0]?.pending || 0
            }
        });
    } catch (err) {
        console.error("Admin Dashboard Error:", err);
        res.redirect("/");
    }
}];

// ── USER MANAGEMENT ──
exports.banUser = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery("SELECT username FROM users WHERE id = ?", [req.params.id]);
    const username = rows[0]?.username || `User #${req.params.id}`;
    await safeQuery("UPDATE users SET is_banned = 1 WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'ban_user', req.params.id, null, `Banned user: ${username}`);
    res.redirect("/admin?tab=users");
}];

exports.unbanUser = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery("SELECT username FROM users WHERE id = ?", [req.params.id]);
    const username = rows[0]?.username || `User #${req.params.id}`;
    await safeQuery("UPDATE users SET is_banned = 0 WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'unban_user', req.params.id, null, `Unbanned user: ${username}`);
    res.redirect("/admin?tab=users");
}];

exports.deleteUser = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery("SELECT username, email FROM users WHERE id = ?", [req.params.id]);
    const username = rows[0]?.username || `User #${req.params.id}`;
    const email = rows[0]?.email || '';
    
    // Fetch user files before deletion
    const [userRows] = await safeQuery("SELECT avatar_url, banner_url FROM users WHERE id = ?", [req.params.id]);
    if (userRows.length > 0) {
        const { avatar_url, banner_url } = userRows[0];
        fileService.deleteLocalFile(avatar_url);
        fileService.deleteLocalFile(banner_url);
    }

    await safeQuery("DELETE FROM users WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'delete_user', null, null, `Deleted account: ${username} (${email})`);
    res.redirect("/admin?tab=users");
}];

exports.promoteUser = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery("SELECT username FROM users WHERE id = ?", [req.params.id]);
    const username = rows[0]?.username || `User #${req.params.id}`;
    await safeQuery("UPDATE users SET role = 'admin' WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'promote_admin', req.params.id, null, `Promoted to Admin: ${username}`);
    res.redirect("/admin?tab=users");
}];

exports.demoteUser = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery("SELECT username FROM users WHERE id = ?", [req.params.id]);
    const username = rows[0]?.username || `User #${req.params.id}`;
    await safeQuery("UPDATE users SET role = 'user' WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'demote_admin', req.params.id, null, `Demoted to User: ${username}`);
    res.redirect("/admin?tab=users");
}];

// ── MODERATION ──


exports.deleteReview = [requireAdmin, async (req, res) => {
    await safeQuery("DELETE FROM reviews WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'delete_review', null, null, `Deleted review ID ${req.params.id}`);
    
    if (req.body.redirectUrl) {
        res.redirect(req.body.redirectUrl);
    } else {
        res.redirect("/admin?tab=moderation");
    }
}];

exports.dismissReport = [requireAdmin, async (req, res) => {
    const [rows] = await safeQuery(
        "SELECT rp.reason, u.username as reporter FROM reports rp JOIN users u ON rp.reporter_id = u.id WHERE rp.id = ?",
        [req.params.id]
    );
    const reporter = rows[0]?.reporter || 'unknown';
    const reason = rows[0]?.reason || '(no reason)';

    await safeQuery("UPDATE reports SET status = 'dismissed' WHERE id = ?", [req.params.id]);
    await logAction(req.session.user.id, 'resolve_report', null, null, `Dismissed report from ${reporter}: "${reason}"`);
    res.redirect("/admin?tab=moderation");
}];

// ── GAME MANAGEMENT ──
exports.deleteGameData = [requireAdmin, async (req, res) => {
    const igdbId = req.params.id;
    const [rows] = await safeQuery(
        "SELECT game_name FROM reviews WHERE igdb_id = ? LIMIT 1",
        [igdbId]
    );
    const gameName = rows[0]?.game_name || `IGDB #${igdbId}`;

    await safeQuery("DELETE FROM reviews WHERE igdb_id = ?", [igdbId]);
    await safeQuery("DELETE FROM wishlists WHERE igdb_id = ?", [igdbId]);
    await safeQuery("DELETE FROM collections WHERE igdb_id = ?", [igdbId]);

    await logAction(req.session.user.id, 'delete_game', null, null, `Deleted all local data for "${gameName}" (IGDB #${igdbId})`);
    res.redirect("/admin?tab=games");
}];
