/* ============================================================
   Service IGDB — Authentification Twitch + Appels API
   ============================================================ */

const fetch = require("node-fetch");

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

// ── Obtenir un token Twitch (OAuth2 Client Credentials) ─────
async function authenticate() {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    const res = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    });

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
    console.log("🔑 Token IGDB obtenu");
    return accessToken;
}

// ── Appel générique à l'API IGDB ────────────────────────────
async function igdbRequest(endpoint, body) {
    const token = await authenticate();
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
        method: "POST",
        headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
        },
        body: body,
    });
    return res.json();
}

// ── Construire l'URL d'une cover IGDB ───────────────────────
function coverUrl(imageId, size = "cover_big") {
    if (!imageId) return "/css/no-cover.svg";
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
}

// ── Enrichir les jeux avec les URLs de cover ────────────────
function enrichGames(games) {
    if (!Array.isArray(games)) return [];
    return games.map((g) => {
        // Format release date
        let releaseDateFormatted = null;
        let releaseYear = null;
        if (g.first_release_date) {
            const d = new Date(g.first_release_date * 1000);
            releaseDateFormatted = d.toLocaleDateString("en-US", {
                year: "numeric", month: "short", day: "numeric",
            });
            releaseYear = d.getFullYear();
        }
        return {
            ...g,
            coverUrl: g.cover ? coverUrl(g.cover.image_id, "cover_big") : "/css/no-cover.svg",
            coverUrlHD: g.cover ? coverUrl(g.cover.image_id, "720p") : "/css/no-cover.svg",
            releaseDateFormatted,
            releaseYear,
        };
    });
}

// ── Jeux populaires (accueil) — triés par nombre d'évaluations ─
async function getPopularGames(offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, involved_companies.company.name, summary;
     where total_rating_count > 50 & cover != null & first_release_date != null;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Jeux récents / nouveautés ───────────────────────────────
async function getNewGames(offset = 0, limit = 20) {
    const now = Math.floor(Date.now() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date < ${now} & cover != null & total_rating_count > 5;
     sort first_release_date desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Recherche de jeux ───────────────────────────────────────
async function searchGames(query, offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `search "${query}";
     fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where cover != null;
     limit ${limit};
     offset ${offset};`
    );
    // Sort results by total_rating_count so most popular appear first
    if (Array.isArray(data)) {
        data.sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0));
    }
    return enrichGames(data);
}

// ── Website category mapping ────────────────────────────────
const WEBSITE_LABELS = {
    1: { label: "Official Website", icon: "language" },
    13: { label: "Steam", icon: "store" },
    16: { label: "Epic Games", icon: "store" },
    15: { label: "GOG", icon: "store" },
    36: { label: "Xbox Store", icon: "sports_esports" },
    54: { label: "PlayStation Store", icon: "sports_esports" },
    3: { label: "Wikipedia", icon: "menu_book" }, // Added Wikipedia
};
const ALLOWED_WEBSITE_CATS = [1, 13, 16, 36, 54, 3];

// ── Enrichir un jeu détaillé ────────────────────────────────
function enrichGameDetail(game) {
    if (!game) return null;

    // Cover URLs
    game.coverUrl = game.cover ? coverUrl(game.cover.image_id, "cover_big") : "/css/no-cover.svg";
    game.coverUrlHD = game.cover ? coverUrl(game.cover.image_id, "720p") : "/css/no-cover.svg";

    // Format release date
    if (game.first_release_date) {
        const d = new Date(game.first_release_date * 1000);
        game.releaseDateFormatted = d.toLocaleDateString("en-US", {
            year: "numeric", month: "long", day: "numeric",
        });
        game.releaseYear = d.getFullYear();
    }

    // Screenshots — max 4
    if (game.screenshots) {
        game.screenshots = game.screenshots.slice(0, 4).map((s) => ({
            ...s,
            url: coverUrl(s.image_id, "screenshot_big"),
            urlHD: coverUrl(s.image_id, "1080p"),
        }));
    }

    // Videos — max 1
    if (game.videos) {
        game.videos = game.videos.slice(0, 1);
    }

    // Séparer développeur / éditeur
    if (game.involved_companies) {
        const devs = game.involved_companies.filter((c) => c.developer);
        const pubs = game.involved_companies.filter((c) => c.publisher);
        game.developer = devs.map((c) => c.company.name).join(", ") || null;
        game.publisher = pubs.map((c) => c.company.name).join(", ") || null;
    }

    // Curate website links — only Steam, Epic, PS, Xbox, Official, Wikipedia
    if (game.websites) {
        game.websites = game.websites
            .filter((w) => ALLOWED_WEBSITE_CATS.includes(w.category))
            .map((w) => ({
                ...w,
                ...(WEBSITE_LABELS[w.category] || { label: "Link", icon: "link" }),
            }));
    }

    // Similar games — max 5
    if (game.similar_games) {
        game.similar_games = game.similar_games.slice(0, 5).map((sg) => ({
            ...sg,
            coverUrl: sg.cover ? coverUrl(sg.cover.image_id, "cover_big") : "/css/no-cover.svg",
        }));
    }

    // DLCs (process and enrich)
    if (game.dlcs) {
        game.dlcs = game.dlcs.map((dlc) => {
            let releaseDateFormatted = null;
            if (dlc.first_release_date) {
                const d = new Date(dlc.first_release_date * 1000);
                releaseDateFormatted = d.toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                });
            }
            return {
                ...dlc,
                coverUrl: dlc.cover ? coverUrl(dlc.cover.image_id, "cover_big") : "/css/no-cover.svg",
                releaseDateFormatted,
            };
        });
    }

    // Languages (unique only)
    if (game.language_supports) {
        const uniqueLangs = new Set();
        game.languages = [];
        // Prioritize Audio and Text
        game.language_supports.forEach(l => {
            if (l.language && l.language.name) {
                if (!uniqueLangs.has(l.language.name)) {
                    uniqueLangs.add(l.language.name);
                    game.languages.push(l.language.name);
                }
            }
        });
        // Limit to 5 common ones or display smartly
        game.languages = game.languages.slice(0, 10).join(", ");
    }

    return game;
}

const GAME_DETAIL_FIELDS = `fields name, slug, summary, storyline, cover.image_id,
            rating, aggregated_rating, total_rating_count, first_release_date,
            genres.name, genres.id, platforms.name, themes.name,
            involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
            screenshots.image_id, videos.video_id, videos.name,
            websites.url, websites.category,
            language_supports.language.name, language_supports.language_support_type,
            dlcs.name, dlcs.slug, dlcs.cover.image_id, dlcs.first_release_date,
            similar_games.name, similar_games.slug, similar_games.cover.image_id, similar_games.rating;`;

// ── Détail d'un jeu par ID ──────────────────────────────────
async function getGameById(id) {
    const data = await igdbRequest(
        "games",
        `${GAME_DETAIL_FIELDS}
     where id = ${id};`
    );
    if (!data || data.length === 0) return null;
    return enrichGameDetail(data[0]);
}

// ── Détail d'un jeu par slug ────────────────────────────────
async function getGameBySlug(slug) {
    const data = await igdbRequest(
        "games",
        `${GAME_DETAIL_FIELDS}
     where slug = "${slug}";`
    );
    if (!data || data.length === 0) return null;
    return enrichGameDetail(data[0]);
}

// ── Jeux par genre ──────────────────────────────────────────
async function getGamesByGenre(genreId, offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where genres = [${genreId}] & cover != null & total_rating_count > 5;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Best of the year (current year, sorted by rating) ───────
async function getBestOfYear(offset = 0, limit = 20) {
    const year = new Date().getFullYear();
    const start = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const end = Math.floor(new Date(`${year}-12-31`).getTime() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date >= ${start} & first_release_date <= ${end}
           & cover != null & total_rating_count > 5;
     sort rating desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Popular in 2025 ─────────────────────────────────────────
async function getPopularIn2025(offset = 0, limit = 20) {
    const start = Math.floor(new Date("2025-01-01").getTime() / 1000);
    const end = Math.floor(new Date("2025-12-31").getTime() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date >= ${start} & first_release_date <= ${end}
           & cover != null & total_rating_count > 10;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── All time top 250 ────────────────────────────────────────
async function getAllTimeTop(offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where total_rating_count > 100 & rating > 75 & cover != null;
     sort rating desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Last month releases ─────────────────────────────────────
async function getLastMonthGames(offset = 0, limit = 20) {
    const now = new Date();
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const start = Math.floor(monthAgo.getTime() / 1000);
    const end = Math.floor(now.getTime() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date >= ${start} & first_release_date <= ${end}
           & cover != null;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── This year releases ──────────────────────────────────────
async function getThisYearGames(offset = 0, limit = 20) {
    const year = new Date().getFullYear();
    const start = Math.floor(new Date(`${year}-01-01`).getTime() / 1000);
    const end = Math.floor(Date.now() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date >= ${start} & first_release_date <= ${end}
           & cover != null;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Games by platform ───────────────────────────────────────
async function getGamesByPlatform(platformId, offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where platforms = [${platformId}] & cover != null & total_rating_count > 10;
     sort total_rating_count desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Games sorted by user rating ─────────────────────────────
async function getGamesByRating(offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where total_rating_count > 50 & cover != null & rating != null;
     sort rating desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Games sorted by critics score ───────────────────────────
async function getGamesByCriticsScore(offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where total_rating_count > 20 & cover != null & aggregated_rating != null;
     sort aggregated_rating desc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Games sorted by Name (A-Z) ──────────────────────────────
async function getGamesByName(offset = 0, limit = 20) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where cover != null & total_rating_count > 10;
     sort name asc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Advanced Search / Filtered Games ────────────────────────
async function getGames({
    page = 1,
    limit = 20,
    search = "",
    genres = [],
    platforms = [],
    sort = "popularity",
    ratingMin = null
} = {}) {
    const offset = (page - 1) * limit;

    let whereClauses = ["cover != null"];

    // Search
    let searchBody = "";
    if (search && search.trim()) {
        searchBody = `search "${search.trim()}";`;
    }

    // Genre Filter (array of IDs)
    if (genres && genres.length > 0) {
        whereClauses.push(`genres = [${genres.join(',')}]`);
    }

    // Platform Filter (array of IDs)
    if (platforms && platforms.length > 0) {
        whereClauses.push(`platforms = (${platforms.join(',')})`);
    }

    // Rating Min
    if (ratingMin) {
        whereClauses.push(`total_rating >= ${ratingMin}`);
        whereClauses.push(`rating >= 60`); // Quality filter
    } else {
        whereClauses.push(`total_rating_count > 5`);
    }

    // Sorting
    let sortClause = "sort total_rating_count desc;";
    switch (sort) {
        case "new": sortClause = "sort first_release_date desc;"; break;
        case "old": sortClause = "sort first_release_date asc;"; break;
        case "rating": sortClause = "sort rating desc;"; whereClauses.push("rating != null"); break;
        case "critics": sortClause = "sort aggregated_rating desc;"; whereClauses.push("aggregated_rating != null"); break;
        case "name": sortClause = "sort name asc;"; break;
        case "popular": default: sortClause = "sort total_rating_count desc;"; break;
    }

    const whereBody = `where ${whereClauses.join(' & ')};`;

    const query = `
        ${searchBody}
        fields name, slug, cover.image_id, rating, aggregated_rating,
               total_rating_count, first_release_date,
               genres.id, genres.name, platforms.name, summary;
        ${whereBody}
        ${sortClause}
        limit ${limit};
        offset ${offset};
    `;

    const data = await igdbRequest("games", query);
    return enrichGames(data);
}



// ── Games sorted by Date (Newest/Oldest) ────────────────────
async function getGamesByDate(offset = 0, limit = 20, order = 'desc') {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where cover != null & first_release_date != null;
     sort first_release_date ${order};
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}

// ── Upcoming releases ───────────────────────────────────────
async function getUpcomingGames(offset = 0, limit = 50) {
    const now = Math.floor(Date.now() / 1000);
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
            total_rating_count, first_release_date,
            genres.id, genres.name, platforms.name, summary;
     where first_release_date > ${now} & cover != null;
     sort first_release_date asc;
     limit ${limit};
     offset ${offset};`
    );
    return enrichGames(data);
}


// ── Games by Date Range ─────────────────────────────────────
async function getGamesByDateRange(startDate, endDate, limit = 50) {
    const data = await igdbRequest(
        "games",
        `fields name, slug, cover.image_id, rating, aggregated_rating,
                total_rating_count, first_release_date,
                genres.id, genres.name, platforms.name, summary;
         where first_release_date >= ${startDate} & first_release_date < ${endDate} & cover != null;
         sort first_release_date asc;
         limit ${limit};`
    );
    return enrichGames(data);
}

// ── Liste des genres (cached) ───────────────────────────────
let cachedGenres = null;
let genresCacheTime = 0;
const GENRE_CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getGenres() {
    if (cachedGenres && Date.now() < genresCacheTime + GENRE_CACHE_TTL) {
        return cachedGenres;
    }
    const data = await igdbRequest("genres", `fields name, slug; sort name asc; limit 50;`);
    if (Array.isArray(data)) {
        cachedGenres = data;
        genresCacheTime = Date.now();
    }
    return cachedGenres || [];
}

// ── Platform constants (well-known IGDB platform IDs) ───────
const PLATFORMS = [
    { id: 6, name: "PC", slug: "pc", icon: "desktop_windows" },
    { id: 167, name: "PlayStation 5", slug: "ps5", icon: "gamepad" },
    { id: 169, name: "Xbox Series X", slug: "xbox-series", icon: "videogame_asset" },
    { id: 130, name: "Nintendo Switch", slug: "switch", icon: "sports_esports" },
    { id: 48, name: "PlayStation 4", slug: "ps4", icon: "gamepad" },
    { id: 49, name: "Xbox One", slug: "xbox-one", icon: "videogame_asset" },
    { id: 34, name: "Android", slug: "android", icon: "phone_android" },
    { id: 39, name: "iOS", slug: "ios", icon: "phone_iphone" },
];

function getPlatforms() {
    return PLATFORMS;
}

// ── Get famous games for Quizz (with screenshots) ───────────
async function getFamousGamesForQuizz(limit = 20, offset = 0) {
    const data = await igdbRequest(
        "games",
        `fields name, screenshots.image_id;
         where total_rating_count > 200 & screenshots != null;
         sort total_rating_count desc;
         limit ${limit};
         offset ${offset};`
    );
    if (!data || !Array.isArray(data)) return [];
    return data.map(g => ({
        id: g.id,
        name: g.name,
        screenshot: (g.screenshots && g.screenshots.length > 0) ? coverUrl(g.screenshots[Math.floor(Math.random() * g.screenshots.length)].image_id, "screenshot_big") : null
    })).filter(g => g.screenshot);
}

module.exports = {
    getPopularGames,
    getFamousGamesForQuizz,
    getGames,
    getNewGames,
    searchGames,
    getGameById,
    getGameBySlug,
    getGamesByGenre,
    getBestOfYear,
    getPopularIn2025,
    getAllTimeTop,
    getLastMonthGames,
    getThisYearGames,
    getGamesByPlatform,
    getGamesByRating,
    getGamesByCriticsScore,
    getGamesByName,
    getGamesByDate,
    getUpcomingGames,
    getGamesByDateRange,
    getGenres,
    getPlatforms,
    coverUrl,
};
