/*
Run this script to update the database schema.
1. Adds profile_image_url and banner_image_url to 'users'.
2. Creates the 'collections' table.
*/

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
        // 1. Add columns to users if they don't exist
        console.log('Updating users table...');
        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL AFTER bio`);
            console.log('Added profile_image_url.');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error(e.message);
        }

        try {
            await connection.execute(`ALTER TABLE users ADD COLUMN banner_image_url VARCHAR(500) NULL AFTER profile_image_url`);
            console.log('Added banner_image_url.');
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.error(e.message);
        }

        // 2. Create collections table
        console.log('Creating collections table...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS collections (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                igdb_id INT NOT NULL,
                game_name VARCHAR(255) NOT NULL,
                game_cover VARCHAR(500) NULL,
                added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_collection (user_id, igdb_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);
        console.log('Collections table ready.');

    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await connection.end();
        console.log('Done.');
    }
}

updateSchema();
