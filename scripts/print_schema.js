const pool = require("./src/db/db");
require("dotenv").config();

async function printSchema() {
    try {
        const [rows] = await pool.execute("DESCRIBE users");
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error("Error printing schema:", err);
    } finally {
        process.exit();
    }
}

printSchema();
