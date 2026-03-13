require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('--- Testing Database Connection ---');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}`);
    
    const startTime = Date.now();
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            connectTimeout: 10000 // 10 seconds timeout for testing
        });
        
        const [rows] = await connection.execute('SELECT 1 + 1 AS solution');
        console.log(`✅ Success! Connection established in ${Date.now() - startTime}ms.`);
        console.log(`Query result: ${rows[0].solution}`);
        await connection.end();
    } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`❌ Connection failed after ${duration}ms.`);
        console.error(`Error Code: ${err.code}`);
        console.error(`Error Message: ${err.message}`);
        
        if (err.code === 'ETIMEDOUT') {
            console.error('\nSUGGESTION: The connection timed out. This usually means:');
            console.error('1. The IP address is wrong.');
            console.error('2. You are not on the correct network (check VPN).');
            console.error('3. A firewall is blocking port 3306.');
        } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('\nSUGGESTION: Access was denied. Check your credentials (user/password).');
        }
    }
}

testConnection();
