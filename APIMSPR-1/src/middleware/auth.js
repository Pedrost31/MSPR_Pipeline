import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import process from "process";

export async function authenticate(req, res, next) {
  const token =
    req.cookies?.token ||
    (req.headers["authorization"]?.startsWith("Bearer ")
      ? req.headers["authorization"].slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await pool.query(
      "SELECT id FROM healthai.sessions WHERE token = $1 AND expires_at > NOW()",
      [token]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: "Session expired or revoked." });
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch {
    return res.status(403).json({ error: "Invalid or expired token." });
  }
}

// Blocks write operations (POST, PUT, PATCH, DELETE) for non-admin users
export function authorizeWrite(req, res, next) {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(req.method) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required for write operations." });
  }
  next();
}

// Generic role guard — usage: authorizeRole('admin')
export function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Access restricted to ${role} only.` });
    }
    next();
  };
}
