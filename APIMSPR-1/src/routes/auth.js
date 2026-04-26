/* global console */
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { authenticate, authorizeRole } from "../middleware/auth.js";
import process from "process";

const router = express.Router();
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 24 * 60 * 60 * 1000, // 24h
};
// POST /auth/register — public, creates a 'user' account
router.post("/register", async (req, res) => {
  console.log("\n🟡 [REGISTER] Request received");
  console.log("Body:", req.body);

  try {
    const { email, password } = req.body;

    console.log("📩 Extracted email:", email);
    console.log("🔑 Password exists:", !!password);

    if (!email || !password) {
      console.log("❌ Missing email or password");
      return res.status(400).json({ error: "Email and password are required." });
    }

    console.log("🔍 Checking if user already exists...");

    const existing = await pool.query(
      "SELECT id FROM api_users WHERE email = $1",
      [email]
    );

    console.log("👤 Existing users found:", existing.rows.length);

    if (existing.rows.length > 0) {
      console.log("⚠️ Email already exists");
      return res.status(409).json({ error: "Email already registered." });
    }

    console.log("🔐 Hashing password...");
    const hash = await bcrypt.hash(password, 10);
    console.log("✅ Password hashed");

    console.log("💾 Inserting user into DB...");

    const result = await pool.query(
      `INSERT INTO api_users (email, password_hash, role)
       VALUES ($1, $2, 'user')
       RETURNING id, email, role`,
      [email, hash]
    );

    console.log("🎉 User inserted:", result.rows[0]);

    return res.status(201).json({
      message: "User registered.",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("\n❌ [REGISTER ERROR]");
    console.error("Message:", err.message);
    console.error("Code:", err.code);
    console.error("Detail:", err.detail);
    console.error(err); // full stack

    return res.status(500).json({
      error: err.message
    });
  }
});
// POST /auth/login — sets httpOnly cookie, stores session in DB
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const result = await pool.query(
      "SELECT * FROM healthai.api_users WHERE email = $1", [email]
    );
    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials." });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid)
      return res.status(401).json({ error: "Invalid credentials." });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      "INSERT INTO healthai.sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expiresAt]
    );

    res.cookie("token", token, COOKIE_OPTS);
    res.json({ role: user.role, email: user.email, id: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/logout — deletes session, clears cookie
router.post("/logout", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM healthai.sessions WHERE token = $1", [req.token]);
    res.clearCookie("token");
    res.json({ message: "Logged out." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/me — returns current user info + linked health profile id
router.get("/me", authenticate, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT user_id FROM healthai.utilisateur WHERE api_user_id = $1",
      [req.user.id]
    );
    res.json({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      healthId: r.rows[0]?.user_id ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/stats — admin only: row counts for all tables
router.get("/stats", authenticate, authorizeRole("admin"), async (_req, res) => {
  try {
    const tables = [
      "api_users", "utilisateur", "nutrition",
      "consommation_alimentaire", "activite_journaliere",
    ];
    const counts = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*) FROM healthai.${t}`);
      counts[t] = parseInt(r.rows[0].count);
    }
    res.json(counts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /auth/users — admin only: list all accounts
router.get("/users", authenticate, authorizeRole("admin"), async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, role, created_at FROM healthai.api_users ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/users — admin only: create user with chosen role
router.post("/users", authenticate, authorizeRole("admin"), async (req, res) => {
  try {
    const { email, password, role = "user" } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ error: "Role must be 'user' or 'admin'." });

    const existing = await pool.query(
      "SELECT id FROM healthai.api_users WHERE email = $1", [email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Email already registered." });

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO healthai.api_users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role",
      [email, hash, role]
    );
    res.status(201).json({ message: "User created.", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /auth/users/:id — admin only: update email
router.put("/users/:id", authenticate, authorizeRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const existing = await pool.query(
      "SELECT id FROM healthai.api_users WHERE email = $1 AND id != $2", [email, id]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Email already used by another account." });

    const result = await pool.query(
      "UPDATE healthai.api_users SET email = $1 WHERE id = $2 RETURNING id, email, role",
      [email, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found." });

    res.json({ message: "User updated.", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /auth/users/:id/role — admin only: change role
router.patch("/users/:id/role", authenticate, authorizeRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!["user", "admin"].includes(role))
      return res.status(400).json({ error: "Role must be 'user' or 'admin'." });
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ error: "You cannot change your own role." });

    const result = await pool.query(
      "UPDATE healthai.api_users SET role = $1 WHERE id = $2 RETURNING id, email, role",
      [role, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found." });

    res.json({ message: "Role updated.", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /auth/users/:id — admin only
router.delete("/users/:id", authenticate, authorizeRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id)
      return res.status(400).json({ error: "You cannot delete your own account." });

    const result = await pool.query(
      "DELETE FROM healthai.api_users WHERE id = $1 RETURNING id, email",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found." });

    res.json({ message: "User deleted.", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
