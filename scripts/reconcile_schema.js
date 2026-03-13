require('dotenv').config();
const mysql = require('mysql2/promise');

async function reconcile() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kc_catalogue'
    });

    console.log('Connected to database.');

    // 1. Create friends table if missing
    console.log('Checking friends table...');
    await conn.execute(`
        CREATE TABLE IF NOT EXISTS friends (
            id INT NOT NULL AUTO_INCREMENT,
            user_id_1 INT NOT NULL,
            user_id_2 INT NOT NULL,
            status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
            action_user_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_friendship (user_id_1, user_id_2),
            FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4
    `);
    console.log('✅ friends table ensured.');

    // 2. Create follows table if missing
    console.log('Checking follows table...');
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
    console.log('✅ follows table ensured.');

    // 3. Ensure follows_public column exists in users
    console.log('Checking follows_public column...');
    try {
        await conn.execute(`ALTER TABLE users ADD COLUMN follows_public BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('✅ follows_public column added to users.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log('ℹ️ follows_public column already exists.');
        } else {
            console.error('❌ Error adding follows_public:', err);
        }
    }

    await conn.end();
    console.log('Recconciliation complete!');
}

reconcile().catch(err => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
});
