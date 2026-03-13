require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kc_catalogue'
    });

    console.log('Connected to database.');

    // Create follows table
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS follows (
            id INT NOT NULL AUTO_INCREMENT,
            follower_id INT NOT NULL,
            following_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_follow (follower_id, following_id),
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
    `);
    console.log('✅ follows table created.');

    // Add follows_public column
    try {
        await conn.execute(`ALTER TABLE users ADD COLUMN follows_public BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('✅ follows_public column added to users.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️ follows_public column already exists.');
        } else {
            throw err;
        }
    }

    await conn.end();
    console.log('Migration complete!');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
