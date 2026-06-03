const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load env variables
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });
dotenv.config();

let DB_URL = process.env.DATABASE_URL;
if (DB_URL) {
  DB_URL = String(DB_URL).trim().replace(/\r/g, "");
}
const JSON_DB_PATH = path.join(__dirname, "..", "..", "db.json");

let pool = null;
let usePostgres = false;

if (DB_URL) {
  try {
    pool = new Pool({
      connectionString: DB_URL,
      max: 20, // Clean Connection Pooling Limit
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: false // Required for Supabase in many environments
      }
    });
    usePostgres = true;
    console.log("Connected to Supabase PostgreSQL.");
  } catch (err) {
    console.error("Failed to connect to Supabase Pooler:", err.message);
    console.log("Falling back to Local JSON database.");
  }
} else {
  console.log("DATABASE_URL is not set. Using Local JSON database.");
}

// -------------------------------------------------------------
// LOCAL JSON DB MOCK IMPLEMENTATION (Zero Native Dependency Fallback)
// -------------------------------------------------------------
class JsonDB {
  constructor() {
    this.init();
  }

  init() {
    if (!fs.existsSync(JSON_DB_PATH)) {
      this.write({ customers: [], alerts: [], chats: [] });
    }
  }

  read() {
    this.init();
    try {
      const data = fs.readFileSync(JSON_DB_PATH, "utf8");
      return JSON.parse(data);
    } catch (e) {
      return { customers: [], alerts: [], chats: [] };
    }
  }

  write(data) {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  query(sql, params = []) {
    const data = this.read();
    sql = sql.trim().toLowerCase();

    // 1. Get stats
    if (sql.includes("select count(*) from customers")) {
      return { rows: [{ count: data.customers.length }] };
    }
    if (sql.includes("select count(*) from alerts")) {
      return { rows: [{ count: data.alerts.length }] };
    }

    // 2. Select Customers
    if (sql.startsWith("select * from customers")) {
      if (sql.includes("where customerid =")) {
        const id = params[0];
        const row = data.customers.find(c => c.customerID === id || c.customerid === id);
        return { rows: row ? [row] : [] };
      }
      // Return sorted by risk descending
      const sorted = [...data.customers].sort((a, b) => (b.risk_pct || 0) - (a.risk_pct || 0));
      return { rows: sorted };
    }

    // 3. Select Alerts
    if (sql.startsWith("select * from alerts")) {
      if (sql.includes("where customerid =")) {
        const id = params[0];
        const rows = data.alerts.filter(a => a.customerID === id || a.customerid === id);
        return { rows };
      }
      const sorted = [...data.alerts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { rows: sorted };
    }

    // 4. Select Chats
    if (sql.startsWith("select * from chats")) {
      const sorted = [...data.chats].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return { rows: sorted };
    }

    // 5. Update Customer Churn risk
    if (sql.startsWith("update customers")) {
      // Expecting: UPDATE customers SET risk_pct = $1, risk_factors = $2, protection_factors = $3 WHERE customerID = $4
      const [risk, risk_factors, prot_factors, id] = params;
      let updated = false;
      data.customers = data.customers.map(c => {
        if (c.customerID === id || c.customerid === id) {
          updated = true;
          return {
            ...c,
            risk_pct: risk,
            risk_factors: Array.isArray(risk_factors) ? risk_factors : JSON.parse(risk_factors),
            protection_factors: Array.isArray(prot_factors) ? prot_factors : JSON.parse(prot_factors)
          };
        }
        return c;
      });
      this.write(data);
      return { rowCount: updated ? 1 : 0 };
    }

    // 6. Insert Alert
    if (sql.startsWith("insert into alerts")) {
      const [cid, name, risk, message] = params;
      const newAlert = {
        id: data.alerts.length + 1,
        customerid: cid,
        customerID: cid,
        customername: name,
        customerName: name,
        risk_pct: risk,
        message: message,
        created_at: new Date().toISOString()
      };
      data.alerts.push(newAlert);
      this.write(data);
      return { rows: [newAlert] };
    }

    // 7. Insert Chat
    if (sql.startsWith("insert into chats")) {
      const [message, sender] = params;
      const newChat = {
        id: data.chats.length + 1,
        message,
        sender,
        created_at: new Date().toISOString()
      };
      data.chats.push(newChat);
      this.write(data);
      return { rows: [newChat] };
    }

    // 8. Insert Customer
    if (sql.startsWith("insert into customers")) {
      // Standard customer insert
      const newCustomer = {};
      const fields = [
        "customerID", "name", "email", "gender", "SeniorCitizen", "Partner", "Dependents", "tenure",
        "PhoneService", "MultipleLines", "InternetService", "OnlineSecurity", "OnlineBackup",
        "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies", "Contract",
        "PaperlessBilling", "PaymentMethod", "MonthlyCharges", "TotalCharges", "NumServices",
        "HasInternet", "HasSupport", "HasStreaming"
      ];
      fields.forEach((f, idx) => {
        newCustomer[f] = params[idx];
      });
      newCustomer.Churn = 0; // Hardcoded in the SQL VALUES statement as 0
      
      const riskVal = params[26];
      const factorsVal = params[27];
      const protVal = params[28];
      
      newCustomer.risk_pct = riskVal !== undefined ? parseFloat(riskVal) : 0.0;
      newCustomer.risk_factors = factorsVal ? (typeof factorsVal === "string" ? JSON.parse(factorsVal) : factorsVal) : [];
      newCustomer.protection_factors = protVal ? (typeof protVal === "string" ? JSON.parse(protVal) : protVal) : [];
      
      data.customers.push(newCustomer);
      this.write(data);
      return { rows: [newCustomer] };
    }

    // 9. Delete Chat History
    if (sql.startsWith("delete from chats")) {
      data.chats = [];
      this.write(data);
      return { rowCount: 0 };
    }

    return { rows: [] };
  }
}

const localJsonDB = new JsonDB();

// -------------------------------------------------------------
// MAIN DB WRAPPER (Polymorphic SQL runner)
// -------------------------------------------------------------
async function executeQuery(sql, params = []) {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      const result = await client.query(sql, params);
      return result;
    } finally {
      client.release();
    }
  } else {
    return localJsonDB.query(sql, params);
  }
}

// -------------------------------------------------------------
// AUTO-INITIALIZE TABLES & SEED SYNTHETIC DATA
// -------------------------------------------------------------
async function initDatabase() {
  if (usePostgres) {
    try {
      // 1. Create customers table
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS customers (
          customerid TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          gender TEXT,
          SeniorCitizen INTEGER,
          Partner TEXT,
          Dependents TEXT,
          tenure INTEGER,
          PhoneService TEXT,
          MultipleLines TEXT,
          InternetService TEXT,
          OnlineSecurity TEXT,
          OnlineBackup TEXT,
          DeviceProtection TEXT,
          TechSupport TEXT,
          StreamingTV TEXT,
          StreamingMovies TEXT,
          Contract TEXT,
          PaperlessBilling TEXT,
          PaymentMethod TEXT,
          MonthlyCharges REAL,
          TotalCharges REAL,
          NumServices INTEGER,
          HasInternet INTEGER,
          HasSupport INTEGER,
          HasStreaming INTEGER,
          Churn INTEGER DEFAULT 0,
          risk_pct REAL DEFAULT 0.0,
          risk_factors JSONB DEFAULT '[]'::jsonb,
          protection_factors JSONB DEFAULT '[]'::jsonb
        );
      `);

      // 2. Create alerts table
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS alerts (
          id SERIAL PRIMARY KEY,
          customerid TEXT NOT NULL,
          customername TEXT NOT NULL,
          risk_pct REAL NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Create chats table
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS chats (
          id SERIAL PRIMARY KEY,
          message TEXT NOT NULL,
          sender TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Create indexes for performance
      await executeQuery(`CREATE INDEX IF NOT EXISTS idx_customers_risk_pct ON customers (risk_pct DESC);`);
      await executeQuery(`CREATE INDEX IF NOT EXISTS idx_alerts_customerid ON alerts (customerid);`);
      await executeQuery(`CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts (created_at DESC);`);

      console.log("Supabase database tables and indexes verified/created.");
    } catch (err) {
      console.error("Error creating tables/indexes on Supabase:", err.message);
    }
  }

  // Check if customers table is empty
  const check = await executeQuery("SELECT COUNT(*) FROM customers");
  const count = parseInt(check.rows[0].count || check.rows[0].COUNT || 0);

  if (count === 0) {
    console.log("Seeding database with default 50 customer profiles...");
    const seedData = generateSeeds();
    for (const cust of seedData) {
      await executeQuery(`
        INSERT INTO customers (
          customerID, name, email, gender, SeniorCitizen, Partner, Dependents, tenure,
          PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
          DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
          PaperlessBilling, PaymentMethod, MonthlyCharges, TotalCharges, NumServices,
          HasInternet, HasSupport, HasStreaming, Churn
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
      `, cust);
    }
    console.log("Seeding completed successfully.");
  }
}

// Generate the 50 synthetic records
function generateSeeds() {
  const seedProfiles = [
    ["1000-ABCD", "Alice Souza", "alice.souza@gmail.com", "Female", 1, "No", "No", 3, "Yes", "No", "Fiber optic", "No", "No", "No", "No", "Yes", "No", "Month-to-month", "Yes", "Electronic check", 85.50],
    ["1001-ABCD", "Bruno Silva", "bruno.silva@outlook.com", "Male", 0, "No", "No", 2, "Yes", "No", "Fiber optic", "No", "Yes", "No", "No", "No", "No", "Month-to-month", "Yes", "Electronic check", 75.20],
    ["1002-ABCD", "Carla Dias", "carla.dias@yahoo.com", "Female", 0, "Yes", "No", 6, "Yes", "Yes", "Fiber optic", "No", "No", "Yes", "No", "Yes", "Yes", "Month-to-month", "Yes", "Electronic check", 100.35],
    ["1003-ABCD", "Diego Costa", "diego.costa@hotmail.com", "Male", 1, "No", "No", 1, "Yes", "No", "Fiber optic", "No", "No", "No", "No", "No", "No", "Month-to-month", "Yes", "Mailed check", 70.15],
    ["1004-ABCD", "Eliana Pires", "eliana.pires@gmail.com", "Female", 0, "No", "No", 4, "No", "No phone service", "DSL", "No", "No", "No", "No", "No", "No", "Month-to-month", "No", "Electronic check", 24.80],
    ["1005-ABCD", "Fabio Santos", "fabio.santos@gmail.com", "Male", 0, "Yes", "Yes", 15, "Yes", "No", "DSL", "Yes", "No", "No", "Yes", "No", "No", "Month-to-month", "No", "Credit card (automatic)", 50.10],
    ["1006-ABCD", "Gisele Lima", "gisele.lima@uol.com.br", "Female", 0, "No", "No", 12, "Yes", "Yes", "Fiber optic", "No", "Yes", "No", "Yes", "Yes", "No", "Month-to-month", "Yes", "Electronic check", 90.00],
    ["1007-ABCD", "Hugo Rocha", "hugo.rocha@gmail.com", "Male", 0, "Yes", "No", 8, "Yes", "No", "Fiber optic", "No", "No", "No", "No", "Yes", "Yes", "Month-to-month", "Yes", "Electronic check", 89.90],
    ["1008-ABCD", "Igor Mendes", "igor.mendes@empresa.com.br", "Male", 0, "Yes", "Yes", 72, "Yes", "Yes", "DSL", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Two year", "No", "Bank transfer (automatic)", 90.45],
    ["1009-ABCD", "Julia Rezende", "julia.r@tech.com", "Female", 0, "Yes", "Yes", 64, "Yes", "Yes", "Fiber optic", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Two year", "Yes", "Credit card (automatic)", 115.80],
    ["1010-ABCD", "Kleber Oliveira", "kleber.o@gmail.com", "Male", 0, "No", "No", 48, "Yes", "No", "No", "No internet service", "No internet service", "No internet service", "No internet service", "No internet service", "No internet service", "Two year", "No", "Mailed check", 19.95],
    ["1011-ABCD", "Laura Fonseca", "laura.fonseca@yahoo.com", "Female", 0, "Yes", "Yes", 35, "Yes", "No", "DSL", "Yes", "Yes", "No", "Yes", "No", "No", "One year", "Yes", "Bank transfer (automatic)", 55.30],
    ["1012-ABCD", "Mauricio Ramos", "mauricio.ramos@gmail.com", "Male", 0, "Yes", "No", 24, "Yes", "Yes", "DSL", "Yes", "No", "Yes", "Yes", "No", "Yes", "One year", "No", "Credit card (automatic)", 70.20],
    ["1013-ABCD", "Nadia Antunes", "nadia.a@gmail.com", "Female", 1, "Yes", "No", 55, "Yes", "Yes", "Fiber optic", "Yes", "Yes", "Yes", "No", "Yes", "Yes", "One year", "Yes", "Bank transfer (automatic)", 105.10]
  ];

  const contractTypes = ["Month-to-month", "One year", "Two year"];
  const internetTypes = ["DSL", "Fiber optic", "No"];
  const yesNo = ["Yes", "No"];
  const payMethods = ["Electronic check", "Mailed check", "Credit card (automatic)", "Bank transfer (automatic)"];
  
  const surnames = ["Oliveira", "Santos", "Souza", "Silva", "Costa", "Lima", "Mendes", "Rocha", "Pinto", "Almeida", "Gomes", "Ribeiro", "Carvalho", "Melo"];
  const firstM = ["Gabriel", "Lucas", "Mateus", "Pedro", "João", "Guilherme", "Gustavo", "Felipe", "Rafael", "Daniel"];
  const firstF = ["Maria", "Ana", "Beatriz", "Letícia", "Larissa", "Amanda", "Camila", "Bruna", "Juliana", "Mariana"];

  const seeds = [];
  
  for (const prof of seedProfiles) {
    seeds.push(prof);
  }

  for (let i = seedProfiles.length; i < 50; i++) {
    const isMale = Math.random() > 0.5;
    const name = isMale 
      ? `${firstM[Math.floor(Math.random() * firstM.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`
      : `${firstF[Math.floor(Math.random() * firstF.length)]} ${surnames[Math.floor(Math.random() * surnames.length)]}`;
    const email = `${name.toLowerCase().replace(/ /g, ".")}@example.com`;
    const cid = `${1000 + i}-XYZW`;
    const gender = isMale ? "Male" : "Female";
    const senior = Math.random() > 0.75 ? 1 : 0;
    const partner = Math.random() > 0.5 ? "Yes" : "No";
    const dependents = Math.random() > 0.5 ? "Yes" : "No";
    
    const roll = Math.random();
    let tenure, contract, internet, security, support, charges, churn;
    let backup, device, tv, movies, phone, lines, pay, paperless;

    if (roll < 0.35) { // High Risk Profile
      tenure = Math.floor(Math.random() * 8) + 1;
      contract = "Month-to-month";
      internet = "Fiber optic";
      security = "No";
      support = "No";
      backup = Math.random() > 0.5 ? "Yes" : "No";
      device = Math.random() > 0.5 ? "Yes" : "No";
      tv = Math.random() > 0.5 ? "Yes" : "No";
      movies = Math.random() > 0.5 ? "Yes" : "No";
      phone = "Yes";
      lines = Math.random() > 0.5 ? "Yes" : "No";
      pay = "Electronic check";
      paperless = "Yes";
      charges = parseFloat((Math.random() * 40 + 70).toFixed(2));
      churn = 1;
    } else if (roll < 0.7) { // Low Risk Profile
      tenure = Math.floor(Math.random() * 40) + 30;
      contract = Math.random() > 0.5 ? "One year" : "Two year";
      internet = Math.random() > 0.5 ? "DSL" : "No";
      if (internet === "DSL") {
        security = "Yes";
        support = "Yes";
        backup = Math.random() > 0.5 ? "Yes" : "No";
        device = Math.random() > 0.5 ? "Yes" : "No";
        tv = Math.random() > 0.5 ? "Yes" : "No";
        movies = Math.random() > 0.5 ? "Yes" : "No";
      } else {
        security = support = backup = device = tv = movies = "No internet service";
      }
      phone = Math.random() > 0.1 ? "Yes" : "No";
      lines = phone === "Yes" ? (Math.random() > 0.5 ? "Yes" : "No") : "No phone service";
      pay = Math.random() > 0.5 ? "Credit card (automatic)" : "Bank transfer (automatic)";
      paperless = "No";
      charges = parseFloat((Math.random() * 40 + 20).toFixed(2));
      churn = 0;
    } else { // Moderate Risk
      tenure = Math.floor(Math.random() * 25) + 5;
      contract = Math.random() > 0.6 ? "One year" : "Month-to-month";
      internet = internetTypes[Math.floor(Math.random() * internetTypes.length)];
      if (internet === "No") {
        security = support = backup = device = tv = movies = "No internet service";
      } else {
        security = yesNo[Math.floor(Math.random() * 2)];
        support = yesNo[Math.floor(Math.random() * 2)];
        backup = yesNo[Math.floor(Math.random() * 2)];
        device = yesNo[Math.floor(Math.random() * 2)];
        tv = yesNo[Math.floor(Math.random() * 2)];
        movies = yesNo[Math.floor(Math.random() * 2)];
      }
      phone = "Yes";
      lines = yesNo[Math.floor(Math.random() * 2)];
      pay = payMethods[Math.floor(Math.random() * payMethods.length)];
      paperless = yesNo[Math.floor(Math.random() * 2)];
      charges = parseFloat((Math.random() * 50 + 40).toFixed(2));
      churn = Math.random() > 0.7 ? 1 : 0;
    }

    seeds.push([
      cid, name, email, gender, senior, partner, dependents, tenure,
      phone, lines, internet, security, backup, device, support, tv, movies,
      contract, paperless, pay, charges
    ]);
  }

  return seeds.map(s => {
    const [
      cid, name, email, gender, senior, partner, dependents, tenure,
      phone, lines, internet, security, backup, device, support, tv, movies,
      contract, paperless, pay, charges
    ] = s;

    const services = [phone, lines, internet, security, backup, device, support, tv, movies];
    const numServices = services.filter(v => v !== "No" && v !== "No internet service" && v !== "No phone service").length;

    const hasInternet = internet !== "No" ? 1 : 0;
    const hasSupport = (security === "Yes" || support === "Yes") ? 1 : 0;
    const hasStreaming = (tv === "Yes" || movies === "Yes") ? 1 : 0;
    const totalCharges = parseFloat((charges * tenure).toFixed(2));
    const churn = seeds.indexOf(s) < 14 ? (s[20] > 70 ? 1 : 0) : (seeds.indexOf(s) % 3 === 0 ? 1 : 0);

    return [
      cid, name, email, gender, senior, partner, dependents, tenure,
      phone, lines, internet, security, backup, device, support, tv, movies,
      contract, paperless, pay, charges, totalCharges, numServices,
      hasInternet, hasSupport, hasStreaming, churn
    ];
  });
}

module.exports = {
  executeQuery,
  initDatabase,
  usePostgres
};
