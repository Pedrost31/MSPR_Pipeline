/* global console */
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET — admin: tous les profils + compte / user: son propre profil
router.get("/", async (req, res) => {
  try {
    let query, params = [];
    if (req.user.role === "admin") {
      query = `
        SELECT u.*, a.email AS account_email, a.role AS account_role
        FROM healthai.utilisateur u
        LEFT JOIN healthai.api_users a ON a.id = u.api_user_id
        ORDER BY u.user_id
      `;
    } else {
      query = "SELECT * FROM healthai.utilisateur WHERE api_user_id = $1";
      params.push(req.user.id);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /utilisateurs/unlinked — admin only: profils sans compte lié
router.get("/unlinked", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only." });
  try {
    const result = await pool.query(
      "SELECT * FROM healthai.utilisateur WHERE api_user_id IS NULL ORDER BY user_id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /utilisateurs/:id/link — admin only: lier un profil à un compte
router.put("/:id/link", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only." });
  try {
    const { id } = req.params;
    const { api_user_id } = req.body;
    if (!api_user_id)
      return res.status(400).json({ error: "api_user_id is required." });

    const accountExists = await pool.query(
      "SELECT id FROM healthai.api_users WHERE id = $1", [api_user_id]
    );
    if (accountExists.rows.length === 0)
      return res.status(404).json({ error: "Account not found." });

    const alreadyLinked = await pool.query(
      "SELECT user_id FROM healthai.utilisateur WHERE api_user_id = $1 AND user_id != $2",
      [api_user_id, id]
    );
    if (alreadyLinked.rows.length > 0)
      return res.status(409).json({ error: "This account is already linked to another profile." });

    const result = await pool.query(
      "UPDATE healthai.utilisateur SET api_user_id = $1 WHERE user_id = $2 RETURNING *",
      [api_user_id, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Profile not found." });

    res.json({ message: "Profile linked.", utilisateur: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /utilisateurs/:id/link — admin only: délier profil et compte
router.delete("/:id/link", async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only." });
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE healthai.utilisateur SET api_user_id = NULL WHERE user_id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Profile not found." });

    res.json({ message: "Profile unlinked.", utilisateur: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST — colonnes ETL : user_id, age, gender, experience_level, weight_kg, height_m, bmi_calculated
router.post("/", async (req, res) => {
  try {
    const {
      user_id, age, gender, experience_level,
      weight_kg, height_m, bmi_calculated,
    } = req.body;

    const api_user_id = req.user.role !== "admin"
      ? req.user.id
      : (req.body.api_user_id ?? null);

    const result = await pool.query(
      `INSERT INTO healthai.utilisateur
         (user_id, age, gender, experience_level, weight_kg, height_m, bmi_calculated, api_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [user_id, age, gender, experience_level, weight_kg, height_m, bmi_calculated, api_user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — mise à jour (colonnes autorisées seulement, api_user_id protégé)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ["age", "gender", "experience_level", "weight_kg", "height_m", "bmi_calculated"];
    const fields = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    if (Object.keys(fields).length === 0)
      return res.status(400).json({ error: "Aucun champ modifiable fourni." });

    const setString = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`).join(", ");
    const values = [...Object.values(fields), id];

    const result = await pool.query(
      `UPDATE healthai.utilisateur SET ${setString} WHERE user_id = $${values.length} RETURNING *`,
      values
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Utilisateur non trouvé." });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM healthai.utilisateur WHERE user_id = $1", [id]);
    res.json({ message: "Utilisateur supprimé." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
