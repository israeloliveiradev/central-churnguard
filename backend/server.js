const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const axios = require("axios");

// Load Environment Variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config();

const { executeQuery, initDatabase, usePostgres } = require("./db");
const agentNotifier = require("./agent_notifier");
const agentInteractivity = require("./agent_interactivity");

const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 8000;
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:5000";

// Rate limiting to protect heavy API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições deste IP. Por favor, tente novamente mais tarde." }
});

app.use(cors());
app.use(express.json());
app.use(compression()); // Enable Gzip payload compression
app.use("/api/chat", limiter);
app.use("/api/alerts/trigger-scan", limiter);

// Express Middleware for API Error Logging
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(`[API ERROR] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });
  next();
});

// Helper: Normalize customer object properties for output
function normalizeCustomer(cust) {
  const risk_factors = cust.risk_factors || cust.risk_factors === "" ? cust.risk_factors : "[]";
  const protection_factors = cust.protection_factors || cust.protection_factors === "" ? cust.protection_factors : "[]";
  
  return {
    customerID: cust.customerid || cust.customerID,
    name: cust.name,
    email: cust.email,
    gender: cust.gender,
    SeniorCitizen: cust.seniorcitizen !== undefined ? cust.seniorcitizen : cust.SeniorCitizen,
    Partner: cust.partner || cust.Partner,
    Dependents: cust.dependents || cust.Dependents,
    tenure: cust.tenure,
    PhoneService: cust.phoneservice || cust.PhoneService,
    MultipleLines: cust.multiplelines || cust.MultipleLines,
    InternetService: cust.internetservice || cust.InternetService,
    OnlineSecurity: cust.onlinesecurity || cust.OnlineSecurity,
    OnlineBackup: cust.onlinebackup || cust.OnlineBackup,
    DeviceProtection: cust.deviceprotection || cust.DeviceProtection,
    TechSupport: cust.techsupport || cust.TechSupport,
    StreamingTV: cust.streamingtv || cust.StreamingTV,
    StreamingMovies: cust.streamingmovies || cust.StreamingMovies,
    Contract: cust.contract || cust.Contract,
    PaperlessBilling: cust.paperlessbilling || cust.PaperlessBilling,
    PaymentMethod: cust.paymentmethod || cust.PaymentMethod,
    MonthlyCharges: parseFloat(cust.monthlycharges || cust.MonthlyCharges || 0),
    TotalCharges: parseFloat(cust.totalcharges || cust.TotalCharges || 0),
    NumServices: parseInt(cust.numservices || cust.NumServices || 0),
    HasInternet: parseInt(cust.hasinternet || cust.HasInternet || 0),
    HasSupport: parseInt(cust.hassupport || cust.HasSupport || 0),
    HasStreaming: parseInt(cust.hasstreaming || cust.HasStreaming || 0),
    Churn: parseInt(cust.churn !== undefined ? cust.churn : cust.Churn || 0),
    risk_pct: parseFloat(cust.risk_pct !== undefined ? cust.risk_pct : 0.0),
    risk_factors: typeof risk_factors === "string" ? JSON.parse(risk_factors) : risk_factors,
    protection_factors: typeof protection_factors === "string" ? JSON.parse(protection_factors) : protection_factors
  };
}

// REST ENDPOINTS
app.get("/api/stats", async (req, res) => {
  try {
    const custRes = await executeQuery("SELECT * FROM customers WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV'");
    const customers = custRes.rows.map(normalizeCustomer);

    const total = customers.length;
    const risks = customers.map(c => c.risk_pct);
    const avgRisk = total > 0 ? risks.reduce((acc, val) => acc + val, 0) / total : 0;
    const highRiskCount = customers.filter(c => c.risk_pct > 65.0).length;

    const alertCountRes = await executeQuery("SELECT COUNT(*) FROM alerts WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV'");
    const totalAlerts = parseInt(alertCountRes.rows[0].count || alertCountRes.rows[0].COUNT || 0);

    res.json({
      total_customers: total,
      average_risk: parseFloat(avgRisk.toFixed(1)),
      high_risk_count: highRiskCount,
      total_alerts: totalAlerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const { search = "", filter = "all", page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offsetNum = (pageNum - 1) * limitNum;

    let queryStr = "SELECT * FROM customers WHERE (customerid LIKE '%-NEW' OR customerid LIKE '%-CSV')";
    let countQueryStr = "SELECT COUNT(*) FROM customers WHERE (customerid LIKE '%-NEW' OR customerid LIKE '%-CSV')";
    const params = [];
    const countParams = [];
    let paramIndex = 1;

    if (search.trim() !== "") {
      const searchPattern = `%${search.trim()}%`;
      queryStr += ` AND (name ILIKE $${paramIndex} OR customerid ILIKE $${paramIndex})`;
      countQueryStr += ` AND (name ILIKE $${paramIndex} OR customerid ILIKE $${paramIndex})`;
      params.push(searchPattern);
      countParams.push(searchPattern);
      paramIndex++;
    }

    if (filter === "high") {
      queryStr += " AND risk_pct > 65.0";
      countQueryStr += " AND risk_pct > 65.0";
    } else if (filter === "medium") {
      queryStr += " AND risk_pct >= 35.0 AND risk_pct <= 65.0";
      countQueryStr += " AND risk_pct >= 35.0 AND risk_pct <= 65.0";
    } else if (filter === "low") {
      queryStr += " AND risk_pct < 35.0";
      countQueryStr += " AND risk_pct < 35.0";
    }

    queryStr += " ORDER BY risk_pct DESC, name ASC";
    queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum);
    params.push(offsetNum);

    const countRes = await executeQuery(countQueryStr, countParams);
    const totalCount = parseInt(countRes.rows[0].count || countRes.rows[0].COUNT || 0);

    const custRes = await executeQuery(queryStr, params);
    const customers = custRes.rows.map(normalizeCustomer);

    res.json({
      customers,
      total: totalCount,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers/:id", async (req, res) => {
  try {
    const custRes = await executeQuery("SELECT * FROM customers WHERE customerid = $1", [req.params.id]);
    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(normalizeCustomer(custRes.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/customers", async (req, res) => {
  const cust = req.body;
  const customer_id = `${Math.floor(Math.random() * 9000) + 1000}-NEW`;

  // Pre-calculate features
  const services = [cust.PhoneService, cust.MultipleLines, cust.InternetService, cust.OnlineSecurity, cust.OnlineBackup, cust.DeviceProtection, cust.TechSupport, cust.StreamingTV, cust.StreamingMovies];
  const numServices = services.filter(v => v !== "No" && v !== "No internet service" && v !== "No phone service").length;
  const hasInternet = cust.InternetService !== "No" ? 1 : 0;
  const hasSupport = (cust.OnlineSecurity === "Yes" || cust.TechSupport === "Yes") ? 1 : 0;
  const hasStreaming = (cust.StreamingTV === "Yes" || cust.StreamingMovies === "Yes") ? 1 : 0;
  const totalCharges = cust.MonthlyCharges * cust.tenure;

  const customerObj = {
    customerid: customer_id,
    customerID: customer_id,
    name: cust.name,
    email: cust.email,
    gender: cust.gender,
    SeniorCitizen: parseInt(cust.SeniorCitizen) || 0,
    Partner: cust.Partner || "No",
    Dependents: cust.Dependents || "No",
    tenure: parseInt(cust.tenure) || 1,
    PhoneService: cust.PhoneService || "Yes",
    MultipleLines: cust.MultipleLines || "No",
    InternetService: cust.InternetService || "DSL",
    OnlineSecurity: cust.OnlineSecurity || "No",
    OnlineBackup: cust.OnlineBackup || "No",
    DeviceProtection: cust.DeviceProtection || "No",
    TechSupport: cust.TechSupport || "No",
    StreamingTV: cust.StreamingTV || "No",
    StreamingMovies: cust.StreamingMovies || "No",
    Contract: cust.Contract || "Month-to-month",
    PaperlessBilling: cust.PaperlessBilling || "Yes",
    PaymentMethod: cust.PaymentMethod || "Electronic check",
    MonthlyCharges: parseFloat(cust.MonthlyCharges) || 0.0,
    TotalCharges: totalCharges,
    NumServices: numServices,
    HasInternet: hasInternet,
    HasSupport: hasSupport,
    HasStreaming: hasStreaming,
    Churn: 0
  };

  try {
    let risk_pct = 0.0;
    let risk_factors = [];
    let protection_factors = [];

    // Query python ML for prediction
    try {
      const predRes = await axios.post(`${ML_ENGINE_URL}/predict-batch`, [customerObj]);
      if (predRes.data && predRes.data.length > 0) {
        risk_pct = parseFloat(predRes.data[0].risk_pct || 0);
        risk_factors = predRes.data[0].risk_factors || [];
        protection_factors = predRes.data[0].protection_factors || [];
      }
    } catch (e) {
      console.error("Single prediction during insert failed, defaulting to 0:", e.message);
    }

    await executeQuery(`
      INSERT INTO customers (
        customerid, name, email, gender, SeniorCitizen, Partner, Dependents, tenure,
        PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
        DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
        PaperlessBilling, PaymentMethod, MonthlyCharges, TotalCharges, NumServices,
        HasInternet, HasSupport, HasStreaming, Churn, risk_pct, risk_factors, protection_factors
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, 0, $27, $28, $29)
    `, [
      customer_id, customerObj.name, customerObj.email, customerObj.gender, customerObj.SeniorCitizen, customerObj.Partner, customerObj.Dependents, customerObj.tenure,
      customerObj.PhoneService, customerObj.MultipleLines, customerObj.InternetService, customerObj.OnlineSecurity, customerObj.OnlineBackup,
      customerObj.DeviceProtection, customerObj.TechSupport, customerObj.StreamingTV, customerObj.StreamingMovies, customerObj.Contract,
      customerObj.PaperlessBilling, customerObj.PaymentMethod, customerObj.MonthlyCharges, totalCharges, numServices,
      hasInternet, hasSupport, hasStreaming, risk_pct, JSON.stringify(risk_factors), JSON.stringify(protection_factors)
    ]);

    // Query python ML in background to retrain the model with the new sample (DISABLED: Only predict on new customers)
    // axios.post(`${ML_ENGINE_URL}/train`).catch(e => console.error("Model train background error:", e.message));

    const checkRes = await executeQuery("SELECT * FROM customers WHERE customerid = $1", [customer_id]);
    res.status(201).json(normalizeCustomer(checkRes.rows[0]));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Helper for parsing CSV
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

app.post("/api/customers/upload", async (req, res) => {
  try {
    const { csvText } = req.body;
    if (!csvText) {
      return res.status(400).json({ error: "O conteúdo do CSV não foi fornecido." });
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return res.status(400).json({ error: "O arquivo CSV enviado está vazio ou não possui cabeçalhos." });
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const fieldMap = {
      customerid: "customerid",
      customerID: "customerID",
      name: "name",
      email: "email",
      gender: "gender",
      seniorcitizen: "SeniorCitizen",
      partner: "Partner",
      dependents: "Dependents",
      tenure: "tenure",
      phoneservice: "PhoneService",
      multiplelines: "MultipleLines",
      internetservice: "InternetService",
      onlinesecurity: "OnlineSecurity",
      onlinebackup: "OnlineBackup",
      deviceprotection: "DeviceProtection",
      techsupport: "TechSupport",
      streamingtv: "StreamingTV",
      streamingmovies: "StreamingMovies",
      contract: "Contract",
      paperlessbilling: "PaperlessBilling",
      paymentmethod: "PaymentMethod",
      monthlycharges: "MonthlyCharges",
      totalcharges: "TotalCharges",
      churn: "Churn"
    };

    const customerList = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 1 && row[0] === "") continue; // Skip empty lines

      const cust = {
        gender: "Male",
        SeniorCitizen: 0,
        Partner: "No",
        Dependents: "No",
        tenure: 1,
        PhoneService: "Yes",
        MultipleLines: "No",
        InternetService: "DSL",
        OnlineSecurity: "No",
        OnlineBackup: "No",
        DeviceProtection: "No",
        TechSupport: "No",
        StreamingTV: "No",
        StreamingMovies: "No",
        Contract: "Month-to-month",
        PaperlessBilling: "Yes",
        PaymentMethod: "Electronic check",
        MonthlyCharges: 50.0,
        TotalCharges: 0.0,
        Churn: 0
      };

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const val = (row[j] || "").trim();
        const fieldName = fieldMap[header];
        if (fieldName) {
          if (fieldName === "SeniorCitizen" || fieldName === "Churn") {
            cust[fieldName] = parseInt(val) || 0;
          } else if (fieldName === "tenure") {
            cust[fieldName] = parseInt(val) || 1;
          } else if (fieldName === "MonthlyCharges" || fieldName === "TotalCharges") {
            cust[fieldName] = parseFloat(val) || 0.0;
          } else {
            cust[fieldName] = val;
          }
        }
      }

      if (!cust.customerID && !cust.customerid) {
        cust.customerid = `${Math.floor(Math.random() * 90000) + 10000}-CSV`;
        cust.customerID = cust.customerid;
      } else {
        cust.customerid = cust.customerid || cust.customerID;
        cust.customerID = cust.customerid;
      }

      if (!cust.name) {
        cust.name = `Cliente ${cust.customerID}`;
      }
      if (!cust.email) {
        cust.email = `${cust.customerID.toLowerCase()}@example.com`;
      }

      const services = [
        cust.PhoneService, cust.MultipleLines, cust.InternetService, 
        cust.OnlineSecurity, cust.OnlineBackup, cust.DeviceProtection, 
        cust.TechSupport, cust.StreamingTV, cust.StreamingMovies
      ];
      cust.NumServices = services.filter(v => v !== "No" && v !== "No internet service" && v !== "No phone service").length;
      cust.HasInternet = cust.InternetService !== "No" ? 1 : 0;
      cust.HasSupport = (cust.OnlineSecurity === "Yes" || cust.TechSupport === "Yes") ? 1 : 0;
      cust.HasStreaming = (cust.StreamingTV === "Yes" || cust.StreamingMovies === "Yes") ? 1 : 0;
      
      if (!cust.TotalCharges || cust.TotalCharges === 0) {
        cust.TotalCharges = cust.MonthlyCharges * cust.tenure;
      }

      customerList.push(cust);
    }

    if (customerList.length === 0) {
      return res.status(400).json({ error: "Nenhum cliente válido pôde ser extraído do CSV." });
    }

    // Call ML Engine for predictions in batch
    let predictions = [];
    try {
      const predRes = await axios.post(`${ML_ENGINE_URL}/predict-batch`, customerList);
      predictions = predRes.data;
    } catch (e) {
      console.error("Batch prediction failed for CSV upload, using defaults:", e.message);
      predictions = customerList.map(c => ({
        customerid: c.customerid,
        risk_pct: 0.0,
        risk_factors: [],
        protection_factors: []
      }));
    }

    // Map predictions back to customerList
    for (let i = 0; i < customerList.length; i++) {
      const pred = predictions[i] || {};
      customerList[i].risk_pct = parseFloat(pred.risk_pct || 0);
      customerList[i].risk_factors = pred.risk_factors || [];
      customerList[i].protection_factors = pred.protection_factors || [];
    }

    // Bulk upsert to DB
    if (usePostgres) {
      const batchSize = 100;
      for (let i = 0; i < customerList.length; i += batchSize) {
        const chunk = customerList.slice(i, i + batchSize);
        const valuePlaceholders = [];
        const values = [];
        let pIndex = 1;

        for (const cust of chunk) {
          valuePlaceholders.push(`(
            $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}::integer, $${pIndex++}, $${pIndex++}, $${pIndex++}::integer,
            $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++},
            $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++},
            $${pIndex++}, $${pIndex++}, $${pIndex++}::real, $${pIndex++}::real, $${pIndex++}::integer,
            $${pIndex++}::integer, $${pIndex++}::integer, $${pIndex++}::integer, $${pIndex++}::integer, $${pIndex++}::real, $${pIndex++}::jsonb, $${pIndex++}::jsonb
          )`);
          values.push(
            cust.customerid, cust.name, cust.email, cust.gender, cust.SeniorCitizen, cust.Partner, cust.Dependents, cust.tenure,
            cust.PhoneService, cust.MultipleLines, cust.InternetService, cust.OnlineSecurity, cust.OnlineBackup,
            cust.DeviceProtection, cust.TechSupport, cust.StreamingTV, cust.StreamingMovies, cust.Contract,
            cust.PaperlessBilling, cust.PaymentMethod, cust.MonthlyCharges, cust.TotalCharges, cust.NumServices,
            cust.HasInternet, cust.HasSupport, cust.HasStreaming, cust.Churn, cust.risk_pct,
            JSON.stringify(cust.risk_factors), JSON.stringify(cust.protection_factors)
          );
        }

        const upsertQuery = `
          INSERT INTO customers (
            customerid, name, email, gender, SeniorCitizen, Partner, Dependents, tenure,
            PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
            DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
            PaperlessBilling, PaymentMethod, MonthlyCharges, TotalCharges, NumServices,
            HasInternet, HasSupport, HasStreaming, Churn, risk_pct, risk_factors, protection_factors
          ) VALUES ${valuePlaceholders.join(", ")}
          ON CONFLICT (customerid) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            gender = EXCLUDED.gender,
            SeniorCitizen = EXCLUDED.SeniorCitizen,
            Partner = EXCLUDED.Partner,
            Dependents = EXCLUDED.Dependents,
            tenure = EXCLUDED.tenure,
            PhoneService = EXCLUDED.PhoneService,
            MultipleLines = EXCLUDED.MultipleLines,
            InternetService = EXCLUDED.InternetService,
            OnlineSecurity = EXCLUDED.OnlineSecurity,
            OnlineBackup = EXCLUDED.OnlineBackup,
            DeviceProtection = EXCLUDED.DeviceProtection,
            TechSupport = EXCLUDED.TechSupport,
            StreamingTV = EXCLUDED.StreamingTV,
            StreamingMovies = EXCLUDED.StreamingMovies,
            Contract = EXCLUDED.Contract,
            PaperlessBilling = EXCLUDED.PaperlessBilling,
            PaymentMethod = EXCLUDED.PaymentMethod,
            MonthlyCharges = EXCLUDED.MonthlyCharges,
            TotalCharges = EXCLUDED.TotalCharges,
            NumServices = EXCLUDED.NumServices,
            HasInternet = EXCLUDED.HasInternet,
            HasSupport = EXCLUDED.HasSupport,
            HasStreaming = EXCLUDED.HasStreaming,
            Churn = EXCLUDED.Churn,
            risk_pct = EXCLUDED.risk_pct,
            risk_factors = EXCLUDED.risk_factors,
            protection_factors = EXCLUDED.protection_factors
        `;
        await executeQuery(upsertQuery, values);
      }
    } else {
      // JSON DB Mock Fallback
      for (const cust of customerList) {
        await executeQuery(`
          INSERT INTO customers (
            customerID, name, email, gender, SeniorCitizen, Partner, Dependents, tenure,
            PhoneService, MultipleLines, InternetService, OnlineSecurity, OnlineBackup,
            DeviceProtection, TechSupport, StreamingTV, StreamingMovies, Contract,
            PaperlessBilling, PaymentMethod, MonthlyCharges, TotalCharges, NumServices,
            HasInternet, HasSupport, HasStreaming, Churn
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        `, [
          cust.customerid, cust.name, cust.email, cust.gender, cust.SeniorCitizen, cust.Partner, cust.Dependents, cust.tenure,
          cust.PhoneService, cust.MultipleLines, cust.InternetService, cust.OnlineSecurity, cust.OnlineBackup,
          cust.DeviceProtection, cust.TechSupport, cust.StreamingTV, cust.StreamingMovies, cust.Contract,
          cust.PaperlessBilling, cust.PaymentMethod, cust.MonthlyCharges, cust.TotalCharges, cust.NumServices,
          cust.HasInternet, cust.HasSupport, cust.HasStreaming, cust.Churn
        ]);
        await executeQuery(`
          UPDATE customers SET risk_pct = $1, risk_factors = $2, protection_factors = $3 WHERE customerID = $4
        `, [cust.risk_pct, JSON.stringify(cust.risk_factors), JSON.stringify(cust.protection_factors), cust.customerid]);
      }
    }

    // Trigger background training (DISABLED: Only predict on bulk CSV upload)
    // axios.post(`${ML_ENGINE_URL}/train`).catch(e => console.error("Model train background error:", e.message));

    res.json({ success: true, count: customerList.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/alerts", async (req, res) => {
  try {
    const alertRes = await executeQuery("SELECT * FROM alerts WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV' ORDER BY created_at DESC");
    res.json(alertRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/alerts/trigger-scan", async (req, res) => {
  try {
    const newAlerts = await agentNotifier.scanBase(ML_ENGINE_URL);
    res.json({
      status: "scan completed",
      new_alerts_count: newAlerts.length,
      new_alerts: newAlerts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/chat/history", async (req, res) => {
  try {
    const chatRes = await executeQuery("SELECT * FROM chats ORDER BY created_at ASC");
    res.json(chatRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  try {
    // Log user chat
    await executeQuery("INSERT INTO chats (message, sender) VALUES ($1, 'user')", [message]);
    
    // Process response
    const reply = await agentInteractivity.handleMessage(message, ML_ENGINE_URL);
    
    // Log agent chat
    await executeQuery("INSERT INTO chats (message, sender) VALUES ($1, 'agent')", [reply]);

    res.json({ response: reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic base scanning (CRON simulator) - every 90 seconds
function runCronScan() {
  console.log("[CRON] Executing scheduled Agent_Notifier database scan...");
  agentNotifier.scanBase(ML_ENGINE_URL).catch(e => {
    console.error("[CRON ERROR] Scheduled scan failed:", e.message);
  });
}

// -------------------------------------------------------------
// SERVER LIFECYCLE INITIALIZATION
// -------------------------------------------------------------
async function bootstrap() {
  console.log("Initializing database connection...");
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Delegated ML Engine endpoint is: ${ML_ENGINE_URL}`);
    
    // Trigger initial scan after 5 seconds delay
    setTimeout(() => {
      runCronScan();
    }, 5000);

    // Schedule subsequent scans
    setInterval(runCronScan, 90000);
  });
}

bootstrap().catch(err => {
  console.error("Critical server bootstrap failure:", err.message);
  process.exit(1);
});

// Trigger Nodemon reload to start server on port 8000
