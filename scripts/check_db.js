const pool = require("./src/db/db");
require("dotenv").config();

async function checkSchema() {
    try {
        const [rows] = await pool.execute("DESCRIBE users");
        console.log("Columns in users table:");
        rows.forEach(row => console.log(`- ${row.Field} (${row.Type})`));
        
        const hasInfoPublic = rows.some(row => row.Field === "info_public");
        if (!hasInfoPublic) {
            console.log("Adding info_public column...");
            await pool.execute("ALTER TABLE users ADD COLUMN info_public BOOLEAN NOT NULL DEFAULT FALSE");
            console.log("Column added successfully.");
        } else {
            console.log("info_public column already exists.");
        }
    } catch (err) {
        console.error("Error checking schema:", err);
    } finally {
        process.exit();
    }
}

checkSchema();
