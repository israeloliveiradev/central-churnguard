const agentNotifier = require("../agents/agentNotifier");

function runCronScan(mlEngineUrl) {
  console.log("[CRON] Executing scheduled Agent_Notifier database scan...");
  agentNotifier.scanBase(mlEngineUrl).catch(e => {
    console.error("[CRON ERROR] Scheduled scan failed:", e.message);
  });
}

function initCron(mlEngineUrl) {
  // Trigger initial scan after 5 seconds delay
  setTimeout(() => {
    runCronScan(mlEngineUrl);
  }, 5000);

  // Schedule subsequent scans every 90 seconds
  return setInterval(() => runCronScan(mlEngineUrl), 90000);
}

module.exports = {
  runCronScan,
  initCron
};
