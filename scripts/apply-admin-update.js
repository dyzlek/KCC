require("dotenv").config();
const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true,
    });

    try {
        const sqlPath = path.join(__dirname, "update-admin-features.sql");
        const sql = fs.readFileSync(sqlPath, "utf8");

        console.log("Executing SQL...");
        // Split by semicolon to execute one by one to avoid some syntax errors with simple drivers
        // But mysql2 supports multipleStatements if enabled.
        await connection.query(sql);
        console.log("Schema updated successfully!");

    } catch (err) {
        // Ignore "Duplicate column name" errors
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("Columns already exist, proceeding...");
        } else {
            console.error("Error updating schema:", err);
        }
    } finally {
        await connection.end();
    }
}

run();
