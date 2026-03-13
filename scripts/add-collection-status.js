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
        console.log('Adding status column to collections table...');
        try {
            await connection.execute(`
                ALTER TABLE collections 
                ADD COLUMN status ENUM('playing', 'completed', 'plan_to_play', 'dropped', 'on_hold') 
                NOT NULL DEFAULT 'plan_to_play'
                AFTER game_cover
            `);
            console.log('Added status column.');
        } catch (e) {
            console.error('Error adding column (might already exist):', e.message);
        }

    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        await connection.end();
        console.log('Done.');
    }
}

updateSchema();
