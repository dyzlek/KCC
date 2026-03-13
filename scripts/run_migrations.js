const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./src/db/db');

async function migrate() {
    try {
        console.log("Adding google_id...");
        await db.execute("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL");
    } catch (e) {
        console.log("google_id might already exist:", e.message);
    }
    try {
        console.log("Adding discord_id...");
        await db.execute("ALTER TABLE users ADD COLUMN discord_id VARCHAR(255) NULL");
    } catch (e) {
        console.log("discord_id might already exist:", e.message);
    }
    try {
        console.log("Adding steam_id...");
        await db.execute("ALTER TABLE users ADD COLUMN steam_id VARCHAR(255) NULL");
    } catch (e) {
        console.log("steam_id might already exist:", e.message);
    }
    try {
        console.log("Updating password constraint...");
        await db.execute("ALTER TABLE users MODIFY password VARCHAR(255) NULL");
    } catch (e) {
        console.log("Failed modifying password:", e.message);
    }
    try {
        console.log("Updating email constraint...");
        await db.execute("ALTER TABLE users MODIFY email VARCHAR(255) NULL");
    } catch (e) {
        console.log("Failed modifying email:", e.message);
    }
    console.log("Migration finished.");
    process.exit(0);
}

migrate();
