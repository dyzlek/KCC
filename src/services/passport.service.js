const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
let db;
try { db = require('../db/db'); } catch (e) { db = null; }

// --- Utils ---
async function findOrCreateUser(req, profile) {
    if (!db) {
        // Return mock user if no db
        return {
            id: 1,
            username: profile.displayName || profile.username || 'OAuthUser',
            email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
            role: 'user',
            steam_id: profile.id
        };
    }

    try {
        // 0. If user is already logged in, link Steam to the existing account
        const currentUser = (req && req.user) ? req.user : (req && req.session ? req.session.user : null);
        
        if (currentUser) {
            // Check if this Steam ID is already linked to ANOTHER account
            const [existingLink] = await db.execute('SELECT id FROM users WHERE steam_id = ? AND id != ?', [profile.id, currentUser.id]);
            if (existingLink.length > 0) {
                throw new Error("Ce compte Steam est déjà associé à un autre utilisateur.");
            }

            await db.execute('UPDATE users SET steam_id = ? WHERE id = ?', [profile.id, currentUser.id]);
            return { ...currentUser, steam_id: profile.id };
        }

        // 1. Check if user already exists with this Steam ID
        const [rows] = await db.execute('SELECT * FROM users WHERE steam_id = ?', [profile.id]);
        if (rows.length > 0) return rows[0];

        // 2. Fallback: If email exists from a previous registration, link the account
        let email = null;
        if (profile.emails && profile.emails.length > 0) email = profile.emails[0].value;

        if (email) {
            const [emailRows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
            if (emailRows.length > 0) {
                // Link account
                await db.execute('UPDATE users SET steam_id = ? WHERE id = ?', [profile.id, emailRows[0].id]);
                return { ...emailRows[0], steam_id: profile.id };
            }
        }

        // 3. Create a new user
        let username = profile.displayName || profile.username || `user_${Date.now()}`;
        // Ensure unique username
        let uniqueUsername = username;
        let counter = 1;
        while (true) {
            const [uRows] = await db.execute('SELECT id FROM users WHERE username = ?', [uniqueUsername]);
            if (uRows.length === 0) break;
            uniqueUsername = `${username}${counter}`;
            counter++;
        }

        let avatar_url = null;
        if (profile.photos && profile.photos.length > 0) avatar_url = profile.photos[0].value;

        const [result] = await db.execute(
            'INSERT INTO users (username, email, password, steam_id, avatar_url) VALUES (?, ?, NULL, ?, ?)',
            [uniqueUsername, email, profile.id, avatar_url]
        );

        return {
            id: result.insertId,
            username: uniqueUsername,
            email,
            role: 'user',
            steam_id: profile.id,
            avatar_url
        };
    } catch (error) {
        console.error("Error in findOrCreateUser (Steam):", error);
        throw error;
    }
}

// --- Serialize / Deserialize ---
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    if (!db) return done(null, { id, username: 'MockUser', role: 'user' });
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length > 0) done(null, rows[0]);
        else done(new Error('User not found'), null);
    } catch (err) {
        done(err, null);
    }
});


// --- Steam ---
if (process.env.STEAM_API_KEY && process.env.STEAM_DOMAIN) {
    passport.use(new SteamStrategy({
        returnURL: `${process.env.STEAM_DOMAIN}/auth/steam/callback`,
        realm: `${process.env.STEAM_DOMAIN}/`,
        apiKey: process.env.STEAM_API_KEY,
        passReqToCallback: true
    }, async (req, identifier, profile, done) => {
        try {
            const user = await findOrCreateUser(req, profile);
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));
}

module.exports = passport;
