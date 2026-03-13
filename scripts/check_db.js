const db = require('../src/db/db');

async function checkSchema() {
    try {
        const [rows] = await db.execute('DESCRIBE users');
        console.log('--- USERS TABLE COLUMNS ---');
        rows.forEach(r => console.log(`'${r.Field}'`));
        process.exit(0);
    } catch (err) {
        console.error('Failed to describe table:', err);
        process.exit(1);
    }
}

checkSchema();
