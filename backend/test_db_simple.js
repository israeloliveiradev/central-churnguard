const { Pool } = require("pg");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const DB_URL = process.env.DATABASE_URL;
console.log("DB_URL is:", DB_URL);

if (!DB_URL) {
  console.log("No DATABASE_URL found.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DB_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(client => {
    console.log("SUCCESS: Connected to PostgreSQL database successfully!");
    client.release();
    process.exit(0);
  })
  .catch(err => {
    console.error("FAILURE: Failed to connect to database:");
    console.error(err);
    process.exit(1);
  });
