// Global Error Handler Middleware
function errorHandler(err, req, res, next) {
  console.error(`[SYSTEM ERROR] ${req.method} ${req.url} - Error:`, err.stack || err.message);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    error: err.message || "Ocorreu um erro interno no servidor.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
}

module.exports = errorHandler;
