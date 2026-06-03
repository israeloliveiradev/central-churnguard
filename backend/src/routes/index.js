const express = require("express");
const rateLimit = require("express-rate-limit");

const customerController = require("../controllers/customerController");
const chatController = require("../controllers/chatController");
const alertController = require("../controllers/alertController");

const router = express.Router();

// Rate limiting to protect heavy API endpoints
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições deste IP. Por favor, tente novamente mais tarde." }
});

// Customer Routes
router.get("/stats", customerController.getStats);
router.get("/customers", customerController.getCustomers);
router.get("/customers/:id", customerController.getCustomerById);
router.post("/customers", customerController.createCustomer);
router.post("/customers/upload", customerController.uploadCustomers);

// Alert Routes
router.get("/alerts", alertController.getAlerts);
router.post("/alerts/trigger-scan", limiter, alertController.triggerScan);

// Chat Routes
router.get("/chat/history", chatController.getChatHistory);
router.post("/chat", limiter, chatController.sendMessage);
router.delete("/chat", limiter, chatController.clearChatHistory);

module.exports = router;
