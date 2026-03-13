const db = require('../src/db/db');

async function checkDetails() {
    try {
        const [rows] = await db.execute('SELECT DATABASE() as db_name');
        console.log('Current Database:', rows[0].db_name);

        const [tableRows] = await db.execute('SHOW TABLES');
        console.log('Tables in this DB:', tableRows.map(r => Object.values(r)[0]).join(', '));

        process.exit(0);
    } catch (err) {
        console.error('Failed to check details:', err);
        process.exit(1);
    }
}

checkDetails();
