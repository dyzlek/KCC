const fetch = require('node-fetch');

/**
 * Service to interact with SteamSpy API
 */
class SteamSpyService {
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
        this.CACHE_TTL = 1000 * 60 * 60; // 1 hour
    }

    /**
     * Fetch top games from SteamSpy
     * @returns {Promise<Array>}
     */
    async getTopGames() {
        if (this.cache && Date.now() < this.cacheTime + this.CACHE_TTL) {
            return this.cache;
        }

        try {
            console.log("🎮 Fetching top games from SteamSpy...");
            // Use top100in2weeks to get currently relevant popular games
            const url = "https://steamspy.com/api.php?request=top100in2weeks";
            const res = await fetch(url);
            const data = await res.json();

            // Transform dictionary to array and filter games with CCU
            const games = Object.values(data)
                .map(g => ({
                    appid: g.appid,
                    name: g.name,
                    ccu: g.ccu || 0,
                    owners: g.owners,
                    // Steam header image
                    image: `https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`
                }))
                .filter(g => g.ccu > 100); // Only games with a minimum of players to make it interesting

            this.cache = games;
            this.cacheTime = Date.now();
            return games;
        } catch (err) {
            console.error("❌ Error fetching SteamSpy games:", err);
            return [];
        }
    }

    /**
     * Get two random games for the game
     */
    async getRandomPair() {
        const games = await this.getTopGames();
        if (games.length < 2) return null;

        const idx1 = Math.floor(Math.random() * games.length);
        let idx2 = Math.floor(Math.random() * games.length);
        while (idx2 === idx1) {
            idx2 = Math.floor(Math.random() * games.length);
        }

        return [games[idx1], games[idx2]];
    }
}

module.exports = new SteamSpyService();
