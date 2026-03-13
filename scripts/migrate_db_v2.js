require('dotenv').config();
const db = require('../src/db/db');

async function migrate() {
    try {
        console.log('Starting migration on:', process.env.DB_NAME || 'kc_catalogue');
        await db.execute(`
            ALTER TABLE users 
            ADD COLUMN reset_token VARCHAR(255) NULL, 
            ADD COLUMN reset_expires DATETIME NULL;
        `);
        console.log('Migration successful on database:', process.env.DB_NAME || 'kc_catalogue');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME' || err.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist on:', process.env.DB_NAME || 'kc_catalogue');
            process.exit(0);
        }
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
