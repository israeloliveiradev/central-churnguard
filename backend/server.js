const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");

// Load Environment Variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config();

const { initDatabase } = require("./src/config/db");
const routes = require("./src/routes");
const errorHandler = require("./src/middlewares/error");
const { initCron } = require("./src/jobs/cron");

const app = express();
app.set("trust proxy", 1); // Trust reverse proxy headers in hosting environments like Napoleon
const PORT = process.env.PORT || 8000;
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://127.0.0.1:5000";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://central.rankia.cloud",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];

const corsAllowedOriginsFromEnv = process.env.CORS_ALLOWED_ORIGINS;
const configuredAllowedOrigins =
  corsAllowedOriginsFromEnv && corsAllowedOriginsFromEnv.trim().length > 0
    ? corsAllowedOriginsFromEnv.trim()
    : DEFAULT_ALLOWED_ORIGINS.join(",");

const allowedOrigins = configuredAllowedOrigins
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOriginsSet = new Set(allowedOrigins);
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin header (health checks, curl, server-to-server)
    if (!origin || allowedOriginsSet.has(origin)) {
      return callback(null, true);
    }
    console.warn("[CORS] Rejected request from non-allowlisted origin");
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204
};

// Security & Optimizations Middlewares
app.use(helmet()); // Protect HTTP headers
app.use(cors(corsOptions));
app.use(express.json());
app.use(compression()); // Gzip payload compression

// Express Middleware for API Error Logging
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(`[API ERROR] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    }
  });
  next();
});

// Mounting API Routes
app.use("/api", routes);

// Global Error Handler Middleware
app.use(errorHandler);

// -------------------------------------------------------------
// SERVER LIFECYCLE INITIALIZATION
// -------------------------------------------------------------
async function bootstrap() {
  console.log("Initializing database connection...");
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Delegated ML Engine endpoint is: ${ML_ENGINE_URL}`);
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);
    
    // Start Cron scheduler
    initCron(ML_ENGINE_URL);
  });
}

bootstrap().catch(err => {
  console.error("Critical server bootstrap failure:", err.message);
  process.exit(1);
});
