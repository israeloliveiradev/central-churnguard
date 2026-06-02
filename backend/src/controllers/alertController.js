const { executeQuery } = require("../config/db");
const agentNotifier = require("../agents/agentNotifier");
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:5000";

async function getAlerts(req, res, next) {
  try {
    const alertRes = await executeQuery("SELECT * FROM alerts WHERE customerid LIKE '%-NEW' OR customerid LIKE '%-CSV' ORDER BY created_at DESC");
    res.json(alertRes.rows);
  } catch (err) {
    next(err);
  }
}

async function triggerScan(req, res, next) {
  try {
    const newAlerts = await agentNotifier.scanBase(ML_ENGINE_URL);
    res.json({
      status: "scan completed",
      new_alerts_count: newAlerts.length,
      new_alerts: newAlerts
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAlerts,
  triggerScan
};
