const pool = require("../db/db");

// Ajouter une review
exports.addReview = async (userId, igdbId, gameName, gameCover, score, content) => {
    const [result] = await pool.execute(
        `INSERT INTO reviews (user_id, igdb_id, game_name, game_cover, score, content)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score), content = VALUES(content), created_at = CURRENT_TIMESTAMP`,
        [userId, igdbId, gameName, gameCover, score, content]
    );
    return result;
};

// Récupérer les reviews d'un jeu
exports.getReviewsByGameId = async (igdbId) => {
    const [rows] = await pool.execute(
        `SELECT r.*, u.username, u.avatar_url
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.igdb_id = ?
         ORDER BY r.created_at DESC`,
        [igdbId]
    );
    return rows;
};

// Récupérer la moyenne et le nombre de reviews
exports.getReviewStats = async (igdbId) => {
    const [rows] = await pool.execute(
        `SELECT AVG(score) as avgScore, COUNT(*) as count
         FROM reviews
         WHERE igdb_id = ?`,
        [igdbId]
    );
    return rows[0];
};

// Récupérer les reviews d'un utilisateur
exports.getReviewsByUserId = async (userId) => {
    const [rows] = await pool.execute(
        `SELECT * FROM reviews WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
};
