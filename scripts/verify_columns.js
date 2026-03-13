const pool = require("./src/db/db");
require("dotenv").config();

async function verifyAllColumns() {
    try {
        const [rows] = await pool.execute("DESCRIBE users");
        const columns = rows.map(r => r.Field);
        const required = ['location', 'birthday', 'gender', 'info_public', 'steam_id'];
        
        console.log("Existing columns:", columns.join(", "));
        
        for (const col of required) {
            if (!columns.includes(col)) {
                console.log(`Missing column: ${col}. Adding it...`);
                if (col === 'info_public') {
                    await pool.execute("ALTER TABLE users ADD COLUMN info_public BOOLEAN NOT NULL DEFAULT FALSE");
                } else if (col === 'steam_id') {
                    await pool.execute("ALTER TABLE users ADD COLUMN steam_id VARCHAR(255) NULL");
                } else if (col === 'location') {
                    await pool.execute("ALTER TABLE users ADD COLUMN location VARCHAR(255) NULL");
                } else if (col === 'birthday') {
                    await pool.execute("ALTER TABLE users ADD COLUMN birthday DATE NULL");
                } else if (col === 'gender') {
                    await pool.execute("ALTER TABLE users ADD COLUMN gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL");
                }
                console.log(`Column ${col} added.`);
            } else {
                console.log(`Column ${col} exists.`);
            }
        }
    } catch (err) {
        console.error("Error verifying columns:", err);
    } finally {
        process.exit();
    }
}

verifyAllColumns();
