const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function resetDb() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        multipleStatements: true
    });

    console.log('Connected to database server.');

    try {
        const sqlPath = path.join(__dirname, '../database.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing database.sql...');
        await connection.query(sql);
        console.log('Database reset successfully.');

    } catch (err) {
        console.error('Error resetting database:', err);
    } finally {
        await connection.end();
        console.log('Done.');
    }
}

resetDb();
