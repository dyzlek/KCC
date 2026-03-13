require("dotenv").config();
const db = require("../src/db/db");

async function migrate() {
    try {
        console.log("🚀 Starting migration: quiz_scores table...");

        await db.execute(`
            CREATE TABLE IF NOT EXISTS quiz_scores (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                score INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_quiz_score (score DESC),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);

        console.log("✅ Migration successful: quiz_scores table created.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
}

migrate();
