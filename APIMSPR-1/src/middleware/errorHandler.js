import process from "process";

export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[${req.method}] ${req.path} → ${status}`, err.stack || err.message);
  }

  res.status(status).json({ error: message });
}