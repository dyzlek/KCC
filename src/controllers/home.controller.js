/* ── Contrôleur Accueil ─────────────────────────────────────── */
const igdb = require("../services/igdb.service");

const GAME_FIELDS = `name, slug, cover.image_id, rating, aggregated_rating,
    total_rating_count, first_release_date, genres.name, platforms.name, summary`;

exports.index = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const tab = req.query.tab;

        // Parse filters
        const genresFilter = req.query.genres ? req.query.genres.split(',').map(Number) : [];
        const platformsFilter = req.query.platforms ? req.query.platforms.split(',').map(Number) : [];
        const search = req.query.q || "";

        // Fetch auxiliary data for filters
        const [allGenres, allPlatforms] = await Promise.all([
            igdb.getGenres ? igdb.getGenres() : Promise.resolve([]),
            igdb.getPlatforms ? igdb.getPlatforms() : Promise.resolve([])
        ]);

        let games = [];
        let pageTitle = "Catalogue";
        let pageSubtitle = "Explore our game library";

        // Check if we need to show the filtered grid view
        // Conditions: explicit tab selected (except 'home'), OR filters active, OR search active
        const hasFilters = genresFilter.length > 0 || platformsFilter.length > 0 || search;
        const showGrid = hasFilters || (tab && tab !== 'home');

        if (showGrid) {

            // Map tab to sort
            let sort = "popular";
            if (tab === "new") sort = "new";
            else if (tab === "date-old") sort = "old";
            else if (tab === "rating") sort = "rating";
            else if (tab === "critics-score") sort = "critics";
            else if (tab === "name-asc") sort = "name";

            if (!hasFilters) {
                // Specialized matching for tabs (legacy/optimized paths)
                switch (tab) {
                    case "new": games = await igdb.getNewGames(offset, limit); pageTitle = "New Releases"; break;
                    case "popular-2025": games = await igdb.getPopularIn2025(offset, limit); pageTitle = "Popular in 2025"; break;
                    case "best-of-year": games = await igdb.getBestOfYear(offset, limit); pageTitle = "Best of 2026"; break;
                    case "last-month": games = await igdb.getLastMonthGames(offset, limit); pageTitle = "Last 30 Days"; break;
                    case "this-year": games = await igdb.getThisYearGames(offset, limit); pageTitle = "Released this Year"; break;
                    case "top-250": games = await igdb.getAllTimeTop(offset, limit); pageTitle = "Top 250 All Time"; break;
                    case "date-old": games = await igdb.getGamesByDate(offset, limit, 'asc'); pageTitle = "Oldest First"; break;
                    case "name-asc": games = await igdb.getGamesByName(offset, limit); pageTitle = "A-Z"; break;
                    case "rating": games = await igdb.getGamesByRating(offset, limit); pageTitle = "Top User Rated"; break;
                    case "critics-score": games = await igdb.getGamesByCriticsScore(offset, limit); pageTitle = "Top Critics Rated"; break;
                    default: games = await igdb.getPopularGames(offset, limit); pageTitle = "Most Popular"; break;
                }
            } else {
                // Generic filter function
                games = await igdb.getGames({
                    page,
                    limit,
                    search,
                    genres: genresFilter,
                    platforms: platformsFilter,
                    sort
                });
                pageTitle = search ? `Search: "${search}"` : "Filtered Results";
            }

            return res.render("home.njk", {
                title: `${pageTitle} — KC Catalogue`,
                games,
                page,
                tab,
                pageTitle,
                pageSubtitle,
                hasMore: games.length === limit,
                isHome: false,
                allGenres,
                allPlatforms,
                activeGenres: genresFilter,
                activePlatforms: platformsFilter,
                searchQuery: search
            });
        }

        // Default Home Landing (no params or tab='home')
        const [popular2025, popular2026, topRated] = await Promise.all([
            igdb.getPopularIn2025(0, 8),
            igdb.getNewGames(0, 8),
            igdb.getGamesByCriticsScore(0, 5)
        ]);

        // Pick a random hero game from top rated or popular to keep it fresh
        const heroGame = topRated && topRated.length > 0 ? topRated[0] : null;

        res.render("home.njk", {
            title: "Home — KC Catalogue",
            isHome: true,
            heroGame,
            games2025: popular2025,
            games2026: popular2026,
            pageTitle: "Welcome",
            tab: "home",
            // Pass filter data even on home page so toolbar works
            allGenres,
            allPlatforms,
            activeGenres: [],
            activePlatforms: []
        });

    } catch (err) {
        console.error("Erreur accueil:", err);
        res.render("home.njk", { title: "Error", games: [], page: 1, tab: "popular", error: "Impossible de charger les jeux." });
    }
};

exports.search = async (req, res) => {
    try {
        const query = req.query.q || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;

        let games = [];
        if (query.trim()) {
            games = await igdb.searchGames(query, offset, limit);
        }

        res.render("home.njk", {
            title: `Recherche : ${query} — KC Catalogue`,
            games,
            page,
            tab: "search",
            searchQuery: query,
            pageTitle: "Search results",
            pageSubtitle: `Results for "${query}"`,
            hasMore: games.length === limit,
        });
    } catch (err) {
        console.error("Erreur recherche:", err);
        res.render("home.njk", { title: "Recherche", games: [], page: 1, tab: "search", searchQuery: req.query.q || "", pageTitle: "Search", pageSubtitle: "", hasMore: false, error: "Erreur lors de la recherche." });
    }
};

// ── Genre page ──────────────────────────────────────────────
exports.genre = async (req, res) => {
    const genreId = req.params.id;
    res.redirect(`/?genres=${genreId}`);
};

// ── Platform page ───────────────────────────────────────────
exports.platform = async (req, res) => {
    const platformId = req.params.id;
    res.redirect(`/?platforms=${platformId}`);
};
