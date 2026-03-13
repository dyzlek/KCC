/* ── Contrôleur Jeu ────────────────────────────────────────── */
const igdb = require("../services/igdb.service");
const gameDb = require("../services/game-db.service");
let db;
try { db = require("../db/db"); } catch (e) { db = null; }

// ── In-memory review store (fallback when DB is unavailable) ─
const memoryReviews = new Map(); // gameId -> [{ id, userId, username, avatar_url, score, content, created_at }]
let reviewIdCounter = 1;

function getMemoryReviews(gameId) {
    return memoryReviews.get(gameId) || [];
}

function addMemoryReview(gameId, userId, username, avatarUrl, score, content) {
    if (!memoryReviews.has(gameId)) memoryReviews.set(gameId, []);
    const reviews = memoryReviews.get(gameId);

    // Check if user already reviewed this game
    const existingIdx = reviews.findIndex(r => (r.userId || r.user_id) === userId);
    if (existingIdx >= 0) {
        reviews[existingIdx].score = score;
        reviews[existingIdx].content = content;
        reviews[existingIdx].created_at = new Date().toISOString();
    } else {
        reviews.unshift({
            id: reviewIdCounter++,
            user_id: userId,
            username,
            avatar_url: avatarUrl,
            score,
            content,
            created_at: new Date().toISOString(),
        });
    }
}

// Helper: safely execute DB query, return null on error to distinguish from empty result
async function safeQuery(query, params) {
    if (!db) return null;
    try {
        return await db.execute(query, params);
    } catch (err) {
        console.warn("DB unavailable:", err.code || err.message);
        return null;
    }
}

// ── Game detail page ────────────────────────────────────────
exports.detail = async (req, res) => {
    try {
        const param = req.params.id;
        let game;

        // Try slug first, fallback to numeric ID
        const numericId = parseInt(param);
        if (isNaN(numericId)) {
            game = await igdb.getGameBySlug(param);
        } else {
            game = await igdb.getGameById(numericId);
        }

        if (!game) return res.status(404).render("game-detail.njk", { title: "Jeu non trouvé", game: null });

        // Check wishlist status & load reviews
        let inWishlist = false;
        let inCollection = false;
        let collectionStatus = null;
        let reviews = [];

        if (req.session.user) {
            // Updated to check by IGDB ID via join, or simple check if we had local ID (we have IGDB ID from param)
            // Ideally we check if game exists locally first
            const [localGame] = await safeQuery("SELECT id FROM games WHERE igdb_id = ?", [game.id]) || [[]];

            if (localGame && localGame.length > 0) {
                const localId = localGame[0].id;

                const wlResult = await safeQuery(
                    "SELECT id FROM wishlists WHERE user_id = ? AND game_id = ?",
                    [req.session.user.id, localId]
                );
                if (wlResult) {
                    inWishlist = wlResult[0].length > 0;
                }

                const clResult = await safeQuery(
                    "SELECT status FROM collections WHERE user_id = ? AND game_id = ?",
                    [req.session.user.id, localId]
                );
                if (clResult && clResult[0].length > 0) {
                    inCollection = true;
                    collectionStatus = clResult[0][0].status;
                }
            }
        }

        // Try DB for reviews first, fall back to in-memory
        // We need to join with games table to filter by IGDB ID
        const dbResult = await safeQuery(
            `SELECT r.*, u.username, u.avatar_url, r.rating as score
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             JOIN games g ON r.game_id = g.id
             WHERE g.igdb_id = ?
             ORDER BY r.created_at DESC
             LIMIT 20`,
            [game.id]
        );

        if (dbResult && dbResult[0].length > 0) {
            reviews = dbResult[0];
        } else {
            reviews = getMemoryReviews(game.id);
        }

        // Compute average user score from site reviews
        let avgUserScore = null;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + (r.score || r.rating || 0), 0);
            avgUserScore = Math.round((sum / reviews.length) * 10) / 10;
        }

        // Find user's review if logged in
        let userReview = null;
        if (req.session.user) {
            userReview = reviews.find(r => r.userId === req.session.user.id || r.user_id === req.session.user.id);
        }

        res.render("game-detail.njk", {
            title: `${game.name} — KC Catalogue`,
            game,
            inWishlist,
            inCollection,
            collectionStatus,
            reviews,
            userReview,
            avgUserScore,
            reviewCount: reviews.length,
            kcScore: avgUserScore, // Alias for template clarity
            localReviewCount: reviews.length, // Alias for template clarity
        });
    } catch (err) {
        console.error("Erreur détail jeu:", err);
        res.redirect("/");
    }
};

// ── Toggle wishlist ─────────────────────────────────────────
exports.toggleWishlist = async (req, res) => {
    const igdbId = parseInt(req.params.id);
    if (!req.session.user) return res.redirect("/login");

    try {
        const localId = await gameDb.getOrCreateGame(igdbId);

        const existResult = await safeQuery(
            "SELECT id FROM wishlists WHERE user_id = ? AND game_id = ?",
            [req.session.user.id, localId]
        );

        if (existResult && existResult[0].length > 0) {
            await safeQuery("DELETE FROM wishlists WHERE user_id = ? AND game_id = ?",
                [req.session.user.id, localId]);
        } else if (existResult) {
            await safeQuery(
                "INSERT INTO wishlists (user_id, game_id) VALUES (?, ?)",
                [req.session.user.id, localId]
            );
        }
    } catch (err) {
        console.error("Erreur wishlist:", err);
    }

    res.redirect(`/game/${igdbId}`);
};

// ── Update collection status ────────────────────────────────
exports.updateCollectionStatus = async (req, res) => {
    const igdbId = parseInt(req.params.id);
    if (!req.session.user) return res.redirect("/login");

    const status = req.body.status;
    // status can be: 'playing', 'completed', 'plan_to_play', 'dropped', 'on_hold', or 'remove'

    try {
        const localId = await gameDb.getOrCreateGame(igdbId);

        if (status === 'remove') {
            await safeQuery("DELETE FROM collections WHERE user_id = ? AND game_id = ?",
                [req.session.user.id, localId]);
        } else {
            const allowedStatuses = ['playing', 'completed', 'plan_to_play', 'dropped', 'on_hold'];
            if (!allowedStatuses.includes(status)) {
                return res.redirect(`/game/${igdbId}`);
            }

            const existResult = await safeQuery(
                "SELECT id FROM collections WHERE user_id = ? AND game_id = ?",
                [req.session.user.id, localId]
            );

            if (existResult && existResult[0].length > 0) {
                // Update existing
                await safeQuery(
                    "UPDATE collections SET status = ? WHERE user_id = ? AND game_id = ?",
                    [status, req.session.user.id, localId]
                );
            } else {
                // Insert new
                await safeQuery(
                    "INSERT INTO collections (user_id, game_id, status) VALUES (?, ?, ?)",
                    [req.session.user.id, localId, status]
                );
            }
        }
    } catch (err) {
        console.error("Erreur collection:", err);
    }

    res.redirect(`/game/${igdbId}`);
};

// ── Add review ──────────────────────────────────────────────
exports.addReview = async (req, res) => {
    const igdbId = parseInt(req.params.id);
    if (!req.session.user) return res.redirect("/login");

    const { score, content } = req.body;
    const scoreInt = parseInt(score);

    if (!scoreInt || scoreInt < 1 || scoreInt > 10 || !content || !content.trim()) {
        return res.redirect(`/game/${igdbId}`);
    }

    try {
        const localId = await gameDb.getOrCreateGame(igdbId);

        // Try DB first
        const existResult = await safeQuery(
            "SELECT id FROM reviews WHERE user_id = ? AND game_id = ?",
            [req.session.user.id, localId]
        );

        if (existResult) {
            // DB is available
            if (existResult[0].length > 0) {
                await safeQuery(
                    "UPDATE reviews SET rating = ?, content = ? WHERE user_id = ? AND game_id = ?",
                    [scoreInt, content.trim(), req.session.user.id, localId]
                );
            } else {
                await safeQuery(
                    "INSERT INTO reviews (user_id, game_id, rating, content) VALUES (?, ?, ?, ?)",
                    [req.session.user.id, localId, scoreInt, content.trim()]
                );
            }
        } else {
            // Fallback: store in memory
            addMemoryReview(
                igdbId,
                req.session.user.id,
                req.session.user.username,
                req.session.user.avatar_url || "",
                scoreInt,
                content.trim()
            );
        }
    } catch (err) {
        console.error("Erreur review:", err);
    }

    res.redirect(`/game/${igdbId}`);
};

exports.deleteReview = async (req, res) => {
    const igdbId = parseInt(req.params.id);
    if (!req.session.user) return res.redirect("/login");

    try {
        const localId = await gameDb.getOrCreateGame(igdbId);

        await safeQuery("DELETE FROM reviews WHERE user_id = ? AND game_id = ?",
            [req.session.user.id, localId]);

        // Also remove from memory if needed
        if (memoryReviews.has(igdbId)) {
            const reviews = memoryReviews.get(igdbId);
            const idx = reviews.findIndex(r => r.userId === req.session.user.id);
            if (idx !== -1) reviews.splice(idx, 1);
        }
    } catch (err) {
        console.error("Erreur suppression review:", err);
    }

    res.redirect(`/game/${igdbId}`);
};

exports.reportReview = async (req, res) => {
    const igdbId = parseInt(req.params.id);
    const reviewId = parseInt(req.params.reviewId);
    if (!req.session.user) return res.redirect("/login");

    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.redirect(`/game/${igdbId}`);

    try {
        // Check if this review exists in DB
        const [existing] = await safeQuery("SELECT id FROM reviews WHERE id = ?", [reviewId]) || [[]];
        if (!existing || existing.length === 0) return res.redirect(`/game/${igdbId}`);

        // Avoid duplicate reports from same user on same review
        const [dup] = await safeQuery(
            "SELECT id FROM reports WHERE reporter_id = ? AND review_id = ?",
            [req.session.user.id, reviewId]
        ) || [[]];

        if (!dup || dup.length === 0) {
            await safeQuery(
                "INSERT INTO reports (reporter_id, review_id, reason) VALUES (?, ?, ?)",
                [req.session.user.id, reviewId, reason.trim()]
            );
        }
    } catch (err) {
        console.error("Erreur report review:", err);
    }

    res.redirect(`/game/${igdbId}`);
};


// ── Calendar Page ───────────────────────────────────────────
exports.calendar = async (req, res) => {
    try {
        let games = [];
        let currentDate = new Date();
        let monthParam = req.query.month; // Expected format: "YYYY-MM"

        let prevMonth = "";
        let nextMonth = "";
        let isMonthlyView = false;

        if (monthParam) {
            // View specific month
            isMonthlyView = true;
            const [year, month] = monthParam.split("-").map(Number);
            currentDate = new Date(year, month - 1, 1);

            // Calculate start and end for this month
            const start = Math.floor(currentDate.getTime() / 1000);
            const end = Math.floor(new Date(year, month, 1).getTime() / 1000);

            games = await igdb.getGamesByDateRange(start, end, 100); // Fetch up to 100 games for the month

            // Prev/Next month links
            const prev = new Date(year, month - 2, 1);
            const next = new Date(year, month, 1);
            prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
            nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
        } else {
            // Default: Upcoming games (could span multiple months)
            games = await igdb.getUpcomingGames(0, 50);

            // For navigation from default view, we start from current month
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const next = new Date(year, month + 1, 1);
            const prev = new Date(year, month - 1, 1); // Allow going back to previous month even from "upcoming"

            // If they click "Next", go to next month view specifically
            nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
            prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
        }

        // Sync games with local DB
        for (const g of games) {
            try {
                await gameDb.getOrCreateGame(g.id);
            } catch (syncErr) {
                console.warn(`Could not sync game ${g.id} to DB:`, syncErr.message);
            }
        }

        // Group by Month/Year (Map preserves insertion order)
        const groupedMap = new Map();

        games.forEach(game => {
            if (!game.first_release_date) return;
            const date = new Date(game.first_release_date * 1000);
            // Key for grouping: YYYY-MM to sort properly if needed, but Map insertion order follows query order
            const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!groupedMap.has(sortKey)) {
                groupedMap.set(sortKey, []);
            }
            groupedMap.get(sortKey).push(game);
        });

        // Convert map to array with prev/next navigation
        const calendarData = Array.from(groupedMap, ([key, games]) => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 1);

            const prev = new Date(year, month - 2, 1);
            const next = new Date(year, month, 1);

            const prevMonthParam = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
            const nextMonthParam = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

            return {
                month: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
                monthParam: key,
                prevMonthParam,
                nextMonthParam,
                games
            };
        });

        res.render("calendar.njk", {
            title: "Calendrier des Sorties — KC Catalogue",
            calendarData,
            selectedYear: currentDate.getFullYear(),
            selectedMonth: currentDate.getMonth() + 1,
            currentYear: new Date().getFullYear()
        });
    } catch (err) {
        console.error("Error calendar:", err);
        res.redirect("/");
    }
};
