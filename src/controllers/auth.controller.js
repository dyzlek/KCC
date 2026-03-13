const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mailService = require("../services/mail.service");
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

exports.forgotPasswordPage = (req, res) => {
    res.render("forgot-password.njk", { title: "Forgot Password — KC Catalogue" });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.render("forgot-password.njk", { error: "Email is required." });
        }

        if (!db) {
            return res.render("forgot-password.njk", { error: "Database not connected." });
        }

        const [rows] = await db.execute("SELECT id FROM users WHERE email = ?", [email]);
        if (rows.length === 0) {
            // Security: don't reveal if user exists, but here for UX we can be helpful or silent
            return res.render("forgot-password.njk", { success: "If that email is in our system, you will receive a reset link shortly." });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour from now

        await db.execute(
            "UPDATE users SET reset_token = ?, reset_expires = ? WHERE email = ?",
            [token, expires, email]
        );

        const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
        await mailService.sendResetEmail(email, resetLink);

        res.render("forgot-password.njk", { success: "If that email is in our system, you will receive a reset link shortly." });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.render("forgot-password.njk", { error: "An error occurred. Please try again later." });
    }
};

exports.resetPasswordPage = async (req, res) => {
    try {
        const { token } = req.params;
        if (!db) return res.redirect("/login");

        const [rows] = await db.execute(
            "SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()",
            [token]
        );

        if (rows.length === 0) {
            return res.render("forgot-password.njk", { error: "Password reset token is invalid or has expired." });
        }

        res.render("reset-password.njk", { title: "Reset Password — KC Catalogue", token });
    } catch (err) {
        console.error("Reset password page error:", err);
        res.redirect("/login");
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.render("reset-password.njk", { token, error: "Passwords do not match." });
        }

        if (!db) return res.redirect("/login");

        const [rows] = await db.execute(
            "SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()",
            [token]
        );

        if (rows.length === 0) {
            return res.render("forgot-password.njk", { error: "Password reset token is invalid or has expired." });
        }

        const hash = await bcrypt.hash(password, 10);
        await db.execute(
            "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?",
            [hash, rows[0].id]
        );

        res.render("auth.njk", { mode: "login", success: "Your password has been reset. You can now log in." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.render("reset-password.njk", { token, error: "An error occurred. Please try again later." });
    }
};
