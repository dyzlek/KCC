const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../src/db/db');

async function simplifySchema() {
    try {
        console.log("Dropping google_id and discord_id columns...");
        // Check if columns exist before dropping to be safe, though ALTER TABLE DROP COLUMN is usually fine if they exist
        await db.execute("ALTER TABLE users DROP COLUMN IF EXISTS google_id, DROP COLUMN IF EXISTS discord_id");
        console.log("Columns dropped successfully.");

        console.log("Adding UNIQUE constraint to steam_id...");
        // First, check if there are duplicates that would prevent adding the constraint
        const [duplicates] = await db.execute(`
            SELECT steam_id, COUNT(*) 
            FROM users 
            WHERE steam_id IS NOT NULL 
            GROUP BY steam_id 
            HAVING COUNT(*) > 1
        `);

        if (duplicates.length > 0) {
            console.warn("WARNING: Duplicate steam_id found. Cannot add unique constraint without manual cleanup.");
            console.table(duplicates);
        } else {
            // Check if constraint already exists (optional but good)
            try {
                await db.execute("ALTER TABLE users ADD UNIQUE (steam_id)");
                console.log("Unique constraint added to steam_id.");
            } catch (e) {
                if (e.code === 'ER_DUP_KEYNAME') {
                    console.log("Unique constraint already exists on steam_id.");
                } else {
                    throw e;
                }
            }
        }

    } catch (err) {
        console.error("Error during schema simplification:", err);
    } finally {
        console.log("Finished.");
        process.exit(0);
    }
}

simplifySchema();
