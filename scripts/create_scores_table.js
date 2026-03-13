const db = require('./src/db/db');

async function run() {
    try {
        console.log("🚀 Creating higher_lower_scores table...");
        await db.execute(`
            CREATE TABLE IF NOT EXISTS higher_lower_scores (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                score INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                INDEX idx_higher_lower_score (score DESC),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);
        console.log("✅ Table created successfully!");
    } catch (err) {
        console.error("❌ Error creating table:", err.message);
    } finally {
        process.exit();
    }
}

run();
