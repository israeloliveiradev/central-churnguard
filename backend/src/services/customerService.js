const axios = require("axios");
const { executeQuery, usePostgres } = require("../config/db");
let ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:5000";
if (ML_ENGINE_URL === "undefined" || !ML_ENGINE_URL) {
  ML_ENGINE_URL = "http://127.0.0.1:5000";
}
ML_ENGINE_URL = String(ML_ENGINE_URL).trim().replace(/\r/g, "");

// Helper: Normalize customer object properties for output (DTO)
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

// Service Methods
async function getStats() {
  const custRes = await executeQuery("SELECT * FROM customers WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV'");
  const customers = custRes.rows.map(normalizeCustomer);

  const total = customers.length;
  const risks = customers.map(c => c.risk_pct);
  const avgRisk = total > 0 ? risks.reduce((acc, val) => acc + val, 0) / total : 0;
  const highRiskCount = customers.filter(c => c.risk_pct > 65.0).length;

  const alertCountRes = await executeQuery("SELECT COUNT(*) FROM alerts WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV'");
  const totalAlerts = parseInt(alertCountRes.rows[0].count || alertCountRes.rows[0].COUNT || 0);

  return {
    total_customers: total,
    average_risk: parseFloat(avgRisk.toFixed(1)),
    high_risk_count: highRiskCount,
    total_alerts: totalAlerts
  };
}

async function getCustomers({ search = "", filter = "all", page = 1, limit = 50 }) {
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

  return {
    customers,
    total: totalCount,
    page: pageNum,
    limit: limitNum
  };
}

async function getCustomerById(id) {
  const custRes = await executeQuery("SELECT * FROM customers WHERE customerid = $1", [id]);
  if (custRes.rows.length === 0) {
    throw new Error("Customer not found");
  }
  return normalizeCustomer(custRes.rows[0]);
}

async function createCustomer(cust) {
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

  const checkRes = await executeQuery("SELECT * FROM customers WHERE customerid = $1", [customer_id]);
  return normalizeCustomer(checkRes.rows[0]);
}

async function uploadCustomers(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    throw new Error("O arquivo CSV enviado está vazio ou não possui cabeçalhos.");
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
      let id = (cust.customerid || cust.customerID).toString().trim();
      if (!id.endsWith("-CSV")) {
        id = `${id}-CSV`;
      }
      cust.customerid = id;
      cust.customerID = id;
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
    throw new Error("Nenhum cliente válido pôde ser extraído do CSV.");
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

  return customerList.length;
}

module.exports = {
  getStats,
  getCustomers,
  getCustomerById,
  createCustomer,
  uploadCustomers
};
