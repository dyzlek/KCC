/* ── Contrôleur Auth ───────────────────────────────────────── */
const bcrypt = require("bcryptjs");
let db;
try { db = require("../db/db"); } catch (e) { db = null; }

exports.loginPage = (req, res) => {
    res.render("auth.njk", { title: "Connexion — KC Catalogue", mode: "login" });
};

exports.registerPage = (req, res) => {
    res.render("auth.njk", { title: "Inscription — KC Catalogue", mode: "register" });
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.render("auth.njk", { title: "Connexion", mode: "login", error: "Tous les champs sont requis." });
        }

        if (!db) {
            // Mode démo sans DB
            req.session.user = { id: 1, username: email.split("@")[0], email, role: "admin", avatar_url: null, bio: null };
            return res.redirect("/");
        }

        const [rows] = await db.execute("SELECT id, username, email, password, role, is_banned, avatar_url, bio FROM users WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.render("auth.njk", { title: "Connexion", mode: "login", error: "Email ou mot de passe incorrect." });
        }

        const user = rows[0];
        if (user.is_banned) {
            return res.render("auth.njk", { title: "Connexion", mode: "login", error: "Votre compte a été banni." });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.render("auth.njk", { title: "Connexion", mode: "login", error: "Email ou mot de passe incorrect." });
        }

        req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role, avatar_url: user.avatar_url, bio: user.bio };
        res.redirect("/");
    } catch (err) {
        console.error("Erreur login:", err);
        res.render("auth.njk", { title: "Connexion", mode: "login", error: "Erreur serveur." });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.render("auth.njk", { title: "Inscription", mode: "register", error: "Tous les champs sont requis." });
        }

        if (!db) {
            req.session.user = { id: 1, username, email, role: "user", avatar_url: null, bio: null };
            return res.redirect("/");
        }

        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.execute(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hash]
        );

        req.session.user = { id: result.insertId, username, email, role: "user", avatar_url: null, bio: null };
        res.redirect("/");
    } catch (err) {
        console.error("Erreur register:", err);
        const msg = err.code === "ER_DUP_ENTRY" ? "Cet email ou pseudo est déjà utilisé." : "Erreur serveur.";
        res.render("auth.njk", { title: "Inscription", mode: "register", error: msg });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => res.redirect("/"));
};

exports.oauthCallback = (req, res) => {
    // passport adds the user object to req.user after successful authentication
    if (req.user) {
        req.session.user = req.user;
        // Explicitly save session before redirecting to prevent race conditions/missing sessions
        return req.session.save((err) => {
            if (err) console.error("Error saving session during OAuth:", err);
            res.redirect("/");
        });
    }
    res.redirect("/");
};
