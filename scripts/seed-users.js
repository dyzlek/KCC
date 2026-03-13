require('dotenv').config();
const mysql = require('mysql2/promise');

async function seedUsers() {
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

        // Check for Admin
        const [adminRows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['admin@kccatalogue.com']);
        if (adminRows.length === 0) {
            console.log('Creating Admin account...');
            await connection.execute(`
                INSERT INTO users (username, email, password, role)
                VALUES ('Admin', 'admin@kccatalogue.com', '$2b$10$MqEtm2Si7bXTVBKJqHsVh.6oOzvXVUcdG5D290kB812vI5SiAdEja', 'admin')
            `);
            console.log('Admin account created.');
        } else {
            console.log('Admin account already exists.');
        }

        // Check for User
        const [userRows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['user@kccatalogue.com']);
        if (userRows.length === 0) {
            console.log('Creating User account...');
            await connection.execute(`
                INSERT INTO users (username, email, password, role)
                VALUES ('Dylan', 'user@kccatalogue.com', '$2b$10$ZpSp8meaF91tuiAW/GBFqOWnMdC5Idy3bAvfKwZViho9oQqRkP.I2', 'user')
            `);
            console.log('User account created.');
        } else {
            console.log('User account already exists.');
        }

        connection.release();
    } catch (err) {
        console.error('Error seeding users:', err);
    } finally {
        await pool.end();
    }
}

seedUsers();
