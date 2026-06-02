const customerService = require("../services/customerService");

async function getStats(req, res, next) {
  try {
    const stats = await customerService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function getCustomers(req, res, next) {
  try {
    const { search, filter, page, limit } = req.query;
    const result = await customerService.getCustomers({ search, filter, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    res.json(customer);
  } catch (err) {
    if (err.message === "Customer not found") {
      res.status(404);
    }
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const customer = await customerService.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) {
    res.status(400);
    next(err);
  }
}

async function uploadCustomers(req, res, next) {
  try {
    const { csvText } = req.body;
    if (!csvText) {
      return res.status(400).json({ error: "O conteúdo do CSV não foi fornecido." });
    }
    const count = await customerService.uploadCustomers(csvText);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500);
    next(err);
  }
}

module.exports = {
  getStats,
  getCustomers,
  getCustomerById,
  createCustomer,
  uploadCustomers
};
