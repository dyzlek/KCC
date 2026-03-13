const db = require("../db/db");
const igdb = require("./igdb.service");

/**
 * Ensures a game exists in the local database.
 * If not, fetches it from IGDB and inserts it.
 * @param {number} igdbId - The ID of the game on IGDB
 * @returns {Promise<number>} - The local database ID of the game
 */
async function getOrCreateGame(igdbId) {
    if (!igdbId) throw new Error("igdbId is required");

    // 1. Check if game exists locally
    const [rows] = await db.execute("SELECT id FROM games WHERE igdb_id = ?", [igdbId]);
    if (rows.length > 0) {
        return rows[0].id;
    }

    // 2. Fetch from IGDB if not found
    const gameData = await igdb.getGameById(igdbId);
    if (!gameData) {
        throw new Error(`Game not found on IGDB (ID: ${igdbId})`);
    }

    // 3. Insert into local DB
    // Note: We map IGDB fields to our schema
    const [result] = await db.execute(
        `INSERT INTO games 
        (igdb_id, name, slug, summary, first_release_date, developer, publisher, genres, platforms, cover_url, igdb_rating) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            gameData.id,
            gameData.name,
            gameData.slug,
            gameData.summary || null,
            gameData.first_release_date ? new Date(gameData.first_release_date * 1000) : null,
            gameData.developer || null,
            gameData.publisher || null,
            gameData.genres ? gameData.genres.map(g => g.name).join(", ") : null,
            gameData.platforms ? gameData.platforms.map(p => p.name).join(", ") : null,
            gameData.coverUrl || null,
            gameData.rating || null
        ]
    );

    return result.insertId;
}

module.exports = {
    getOrCreateGame
};
