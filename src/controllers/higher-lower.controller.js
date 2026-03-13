const steamspy = require("../services/steamspy.service");
let db;
try { db = require("../db/db"); } catch (e) { db = null; }

/**
 * Higher or Lower Landing Page
 */
exports.gamePage = async (req, res) => {
    let leaderboard = [];
    let personalBest = 0;

    try {
        if (db) {
            // Fetch Global Top 10
            const [rows] = await db.execute(`
                SELECT s.score, u.username, u.avatar_url
                FROM higher_lower_scores s
                JOIN users u ON s.user_id = u.id
                ORDER BY s.score DESC
                LIMIT 10
            `);
            leaderboard = rows;

            // Fetch Personal Best
            if (req.session.user) {
                const [pbRows] = await db.execute(
                    "SELECT MAX(score) as best FROM higher_lower_scores WHERE user_id = ?",
                    [req.session.user.id]
                );
                personalBest = pbRows[0].best || 0;
            }
        }
    } catch (err) {
        console.error("Error fetching leaderboard:", err);
    }

    res.render("higher-lower-landing.njk", {
        title: "Higher Lower — KC Catalogue",
        leaderboard,
        personalBest
    });
};

/**
 * Actual Game Page
 */
exports.playPage = async (req, res) => {
    res.render("higher-lower.njk", {
        title: "Higher or Lower ? — The Game",
    });
};

/**
 * API: Start a new game or get initial data
 */
exports.getStartData = async (req, res) => {
    try {
        const pair = await steamspy.getRandomPair();
        if (!pair) return res.status(500).json({ error: "Could not fetch games" });

        const [game1, game2] = pair;
        
        // Store in session to verify result later
        req.session.higherLower = {
            currentId: game1.appid,
            nextId: game2.appid,
            currentCcu: game1.ccu,
            nextCcu: game2.ccu, // Hidden from client until guess
            score: 0
        };

        // Send data to client (nextCcu is hidden)
        res.json({
            game1: {
                name: game1.name,
                image: game1.image,
                ccu: game1.ccu
            },
            game2: {
                name: game2.name,
                image: game2.image
                // ccu hidden
            },
            score: 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * API: Submit a guess
 */
exports.submitGuess = async (req, res) => {
    const { guess } = req.body; // 'higher' or 'lower'
    const state = req.session.higherLower;

    if (!state) return res.status(400).json({ error: "Game not started" });

    const correct = (guess === 'higher' && state.nextCcu >= state.currentCcu) ||
                  (guess === 'lower' && state.nextCcu <= state.currentCcu);

    const actualCcu = state.nextCcu;

    if (correct) {
        state.score += 1;
        
        // Prepare next round: current game becomes the one we just guessed
        const games = await steamspy.getTopGames();
        let nextGame;
        do {
            nextGame = games[Math.floor(Math.random() * games.length)];
        } while (nextGame.appid === state.nextId);

        state.currentId = state.nextId;
        state.currentCcu = state.nextCcu;
        state.nextId = nextGame.appid;
        state.nextCcu = nextGame.ccu;

        res.json({
            correct: true,
            actualCcu: actualCcu,
            score: state.score,
            nextGame: {
                name: nextGame.name,
                image: nextGame.image
            }
        });
    } else {
        const finalScore = state.score;
        delete req.session.higherLower;

        // Save score if logged in and score > 0
        if (req.session.user && finalScore > 0 && db) {
            try {
                await db.execute(
                    "INSERT INTO higher_lower_scores (user_id, score) VALUES (?, ?)",
                    [req.session.user.id, finalScore]
                );
            } catch (err) {
                console.error("Error saving score:", err);
            }
        }

        res.json({
            correct: false,
            actualCcu: actualCcu,
            score: finalScore
        });
    }
};
