const { Client } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DB_URL = process.env.DATABASE_URL;
console.log("DATABASE_URL:", DB_URL);

async function check() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    await client.connect();
    console.log("Connected successfully to PostgreSQL!");
    
    const countRes = await client.query("SELECT COUNT(*) FROM customers");
    console.log("Customer count:", countRes.rows[0]);
    
    const sampleRes = await client.query("SELECT customerid, name, risk_pct FROM customers LIMIT 5");
    console.log("Sample customers:", sampleRes.rows);
    
  } catch (err) {
    console.error("Error during check:", err.message);
  } finally {
    await client.end();
  }
}

check();
