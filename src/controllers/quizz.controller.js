const igdb = require("../services/igdb.service");
let db;
try { db = require("../db/db"); } catch (e) { db = null; }

// Helper: Shuffle array
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

exports.index = async (req, res) => {
    try {
        const userId = req.session.user ? req.session.user.id : null;
        let stats = { best: 0 };
        let leaderboard = [];

        if (db) {
            // Get personal best for quiz (different from higher lower)
            if (userId) {
                const [bestRows] = await db.execute("SELECT MAX(score) as best FROM quiz_scores WHERE user_id = ?", [userId]);
                stats.best = (bestRows.length > 0) ? bestRows[0].best || 0 : 0;
            }

            // Get Global Leaderboard
            const [leaderRows] = await db.execute(`
                SELECT u.username, u.avatar_url, MAX(qs.score) as score 
                FROM quiz_scores qs
                JOIN users u ON qs.user_id = u.id
                GROUP BY qs.user_id, u.username, u.avatar_url
                ORDER BY score DESC
                LIMIT 5
            `);
            leaderboard = leaderRows;
        }

        res.render("quizz.njk", {
            title: "Guess the Game — KC Catalogue",
            stats,
            leaderboard,
            landing: true,
            user: req.session.user
        });
    } catch (err) {
        console.error("Quizz error:", err);
        res.redirect("/");
    }
};

exports.apiSaveScore = async (req, res) => {
    if (!req.session.user || !db) return res.status(401).json({ error: "Not logged in or DB error" });
    try {
        const { score } = req.body;
        if (typeof score !== 'number') return res.status(400).json({ error: "Invalid score" });
        
        await db.execute("INSERT INTO quiz_scores (user_id, score) VALUES (?, ?)", [req.session.user.id, score]);
        res.json({ success: true });
    } catch (err) {
        console.error("Save score error:", err);
        res.status(500).json({ error: "Failed to save score" });
    }
};

exports.apiNext = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 4;
        const offset = Math.floor(Math.random() * 300);
        const games = await igdb.getFamousGamesForQuizz(limit + 10, offset); // Fetch more for variety
        
        if (!games || games.length < limit) {
             return res.json({ error: "Not enough games" });
        }

        // Shuffle all games to get different ones
        const shuffledPool = shuffle([...games]);
        const correctGame = shuffledPool[0];
        const others = shuffledPool.slice(1, limit);
        
        const choices = shuffle([
            correctGame.name,
            ...others.map(o => o.name)
        ]);

        res.json({
            game: correctGame,
            choices
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch next game" });
    }
};
