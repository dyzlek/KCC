/* ============================================================
   KC Catalogue — Point d'entrée de l'application
   Architecture MVC : Express + Nunjucks + MySQL
   ============================================================ */

require("dotenv").config();

const express = require("express");
const nunjucks = require("nunjucks");
const session = require("express-session");
const path = require("path");
const igdb = require("./services/igdb.service");
const passport = require("./services/passport.service");

const app = express();

// ── Body parsers ────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ── Fichiers statiques ──────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "public")));
app.use('/uploads', express.static(path.join(__dirname, "..", "public/uploads")));

// ── Sessions ────────────────────────────────────────────────
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev-secret",
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
    })
);

app.use(passport.initialize());
app.use(passport.session());

// ── Nunjucks ────────────────────────────────────────────────
const env = nunjucks.configure(path.join(__dirname, "..", "views"), {
    autoescape: true,
    express: app,
    watch: false,
    noCache: true,
});


// Custom filter: format Unix timestamp to date
env.addFilter("dateFormat", function (timestamp) {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
});

// Custom filter: format date to YYYY-MM-DD for inputs
env.addFilter("isoDate", function (date) {
    if (!date) return "";
    const d = new Date(date);
    return d.toISOString().split('T')[0];
});

// Custom filter: time ago
env.addFilter("timeAgo", function (dateStr) {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 2592000) return Math.floor(diff / 86400) + "d ago";
    return date.toLocaleDateString("fr-FR", { year: "numeric", month: "short" });
});

// Custom filter: to timestamp
env.addFilter("toTimestamp", function (date) {
    if (!date) return 0;
    return new Date(date).getTime();
});

// Custom global: toggle item in array
env.addGlobal("toggleFilter", function (currentList, id) {
    let list = Array.isArray(currentList) ? currentList : [];
    if (list.includes(id)) {
        return list.filter(x => x !== id).join(',');
    } else {
        return [...list, id].join(',');
    }
});

app.set("view engine", "njk");

// ── Middleware global : passer la session + genres aux vues ──
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;

    // Load genres (cached in service)
    try {
        res.locals.genres = await igdb.getGenres();
    } catch (e) {
        res.locals.genres = [];
    }

    // Load platforms (static list)
    res.locals.platforms = igdb.getPlatforms();

    next();
});

// ── Routes ──────────────────────────────────────────────────
const homeRoutes = require("./routes/home.routes");
const gameRoutes = require("./routes/game.routes");
const authRoutes = require("./routes/auth.routes");
const profileRoutes = require("./routes/profile.routes");
const adminRoutes = require("./routes/admin.routes");
const followRoutes = require("./routes/follow.routes");
const higherLowerRoutes = require("./routes/higher-lower.routes");

app.use("/", homeRoutes);
app.use("/game", gameRoutes);
app.use("/", authRoutes);
app.use("/profile", profileRoutes);
app.use("/admin", adminRoutes);
app.use("/follow", followRoutes);
app.use("/", higherLowerRoutes);

// ── 404 ─────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render("404.njk", {
        title: "404 - Level Not Found",
    });
});

// ── Lancement ───────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✨ KC Catalogue en ligne sur http://localhost:${PORT}`);
});
