const { executeQuery } = require("../config/db");
const agentInteractivity = require("../agents/agentInteractivity");
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:5000";

async function getChatHistory(req, res, next) {
  try {
    const chatRes = await executeQuery("SELECT * FROM chats ORDER BY created_at ASC");
    res.json(chatRes.rows);
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  const { message } = req.body;
  try {
    if (!message) {
      return res.status(400).json({ error: "A mensagem é obrigatória." });
    }
    // Log user chat
    await executeQuery("INSERT INTO chats (message, sender) VALUES ($1, 'user')", [message]);
    
    // Process response
    const reply = await agentInteractivity.handleMessage(message, ML_ENGINE_URL);
    
    // Log agent chat
    await executeQuery("INSERT INTO chats (message, sender) VALUES ($1, 'agent')", [reply]);

    res.json({ response: reply });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChatHistory,
  sendMessage
};
