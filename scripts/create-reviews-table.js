require('dotenv').config();
const mysql = require('mysql2/promise');

async function createReviewsTable() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('Connecting to database...');
        const connection = await pool.getConnection();
        console.log('Connected!');

        console.log('Creating reviews table if not exists...');
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT NOT NULL AUTO_INCREMENT,
                user_id INT NOT NULL,
                igdb_id INT NOT NULL,
                game_name VARCHAR(255) NOT NULL,
                game_cover VARCHAR(500) NULL,
                score TINYINT NOT NULL CHECK (score BETWEEN 1 AND 10),
                content TEXT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_review (user_id, igdb_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
        `);
        console.log('Reviews table created/verified.');

        connection.release();
    } catch (err) {
        console.error('Error creating table:', err);
    } finally {
        await pool.end();
    }
}

createReviewsTable();
