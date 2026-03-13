const fetch = require('node-fetch');

/**
 * Fetch playtime statistics from Steam API
 * @param {string} steamId 
 * @returns {Promise<{total: number, recent: number}>}
 */
async function getSteamPlaytime(steamId) {
    if (!process.env.STEAM_API_KEY || !steamId) return { total: 0, recent: 0 };

    try {
        // Get Owned Games (Total Playtime)
        const ownedUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${process.env.STEAM_API_KEY}&steamid=${steamId}&format=json`;
        // Get Recently Played Games (2 weeks)
        const recentlyPlayedUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${process.env.STEAM_API_KEY}&steamid=${steamId}&format=json`;

        const [ownedRes, recentRes] = await Promise.all([
            fetch(ownedUrl).then(res => res.json()),
            fetch(recentlyPlayedUrl).then(res => res.json())
        ]);

        let totalMinutes = 0;
        if (ownedRes.response && ownedRes.response.games) {
            totalMinutes = ownedRes.response.games.reduce((acc, game) => acc + (game.playtime_forever || 0), 0);
        }

        let recentMinutes = 0;
        if (recentRes.response && recentRes.response.games) {
            recentMinutes = recentRes.response.games.reduce((acc, game) => acc + (game.playtime_2weeks || 0), 0);
        }

        return {
            total: Math.round(totalMinutes / 60),
            recent: Math.round(recentMinutes / 60)
        };
    } catch (err) {
        console.error("Error fetching Steam playtime:", err);
        return { total: 0, recent: 0 };
    }
}

module.exports = { getSteamPlaytime };
