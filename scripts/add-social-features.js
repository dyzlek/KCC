const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateSchema() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Connected to database.');

    try {
        // 1. Add User Fields
        console.log('Updating users table with new profile fields...');
        const columnsToAdd = [
            "ADD COLUMN location VARCHAR(255) NULL AFTER bio",
            "ADD COLUMN birthday DATE NULL AFTER location",
            "ADD COLUMN gender ENUM('male', 'female', 'other', 'prefer_not_to_say') NULL AFTER birthday"
        ];

        for (const col of columnsToAdd) {
            try {
                await connection.execute(`ALTER TABLE users ${col}`);
                console.log(`Executed: ${col}`);
            } catch (e) {
                if (e.code !== 'ER_DUP_FIELDNAME') console.error(`Error adding column: ${e.message}`);
                else console.log('Column already exists.');
            }
        }

        // 2. Create Friends Table
        console.log('Creating friends table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS friends (
                id INT NOT NULL AUTO_INCREMENT,
                user_id_1 INT NOT NULL,
                user_id_2 INT NOT NULL,
                status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
                action_user_id INT NOT NULL, -- Who performed the last action (content of request)
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_friendship (user_id_1, user_id_2),
                FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);
        console.log('Friends table ready.');

    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await connection.end();
        console.log('Done.');
    }
}

updateSchema();
