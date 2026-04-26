import { pool } from "../db.js";

// Attaches req.healthId (utilisateur.user_id) for non-admin users
export async function attachHealthId(req, res, next) {
  if (req.user.role === "admin") { next(); return; }

  try {
    const r = await pool.query(
      "SELECT user_id FROM healthai.utilisateur WHERE api_user_id = $1",
      [req.user.id]
    );
    req.healthId = r.rows[0]?.user_id ?? null;
    next();
  } catch (err) {
    next(err);
  }
}
