/* global console */
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET / — consommations avec nom de l'aliment (JOIN nutrition)
router.get("/", async (req, res) => {
  try {
    if (req.user.role !== "admin" && !req.healthId) return res.json([]);

    const query = req.user.role === "admin"
      ? `SELECT c.id_consumption, c.user_id, n.food_item, n.category,
                c.date_consommation, c.repas_type, c.quantite_grammes,
                n.calories_kcal, n.protein_g, n.carbohydrates_g, n.fat_g
         FROM healthai.consommation_alimentaire c
         JOIN healthai.nutrition n ON n.nutrition_id = c.nutrition_id
         ORDER BY c.date_consommation DESC`
      : `SELECT c.id_consumption, c.user_id, n.food_item, n.category,
                c.date_consommation, c.repas_type, c.quantite_grammes,
                n.calories_kcal, n.protein_g, n.carbohydrates_g, n.fat_g
         FROM healthai.consommation_alimentaire c
         JOIN healthai.nutrition n ON n.nutrition_id = c.nutrition_id
         WHERE c.user_id = $1
         ORDER BY c.date_consommation DESC`;
    const params = req.user.role === "admin" ? [] : [req.healthId];

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /:id_consumption — une consommation par sa clé primaire
router.get("/:id_consumption", async (req, res) => {
  const { id_consumption } = req.params;
  try {
    const result = await pool.query(
      `SELECT c.*, n.food_item, n.category, n.calories_kcal
       FROM healthai.consommation_alimentaire c
       JOIN healthai.nutrition n ON n.nutrition_id = c.nutrition_id
       WHERE c.id_consumption = $1`,
      [id_consumption]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Consommation non trouvée." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST / — ajouter une consommation
// Body : { nutrition_id, date_consommation, repas_type, quantite_grammes }
// user_id pris depuis healthId (non-admin) ou body (admin)
router.post("/", async (req, res) => {
  try {
    const { nutrition_id, date_consommation, repas_type, quantite_grammes } = req.body;
    const user_id = req.user.role !== "admin" ? req.healthId : req.body.user_id;

    const result = await pool.query(
      `INSERT INTO healthai.consommation_alimentaire
         (id_consumption, user_id, nutrition_id, date_consommation, repas_type, quantite_grammes)
       SELECT COALESCE(MAX(id_consumption), 0) + 1, $1, $2, $3, $4, $5
       FROM healthai.consommation_alimentaire
       RETURNING *`,
      [user_id, nutrition_id, date_consommation, repas_type, quantite_grammes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /:id_consumption — modifier quantité, repas_type ou date
router.put("/:id_consumption", async (req, res) => {
  const { id_consumption } = req.params;
  const allowed = ["nutrition_id", "date_consommation", "repas_type", "quantite_grammes"];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Aucun champ modifiable fourni." });

  try {
    const keys   = Object.keys(updates);
    const values = Object.values(updates);
    const setQuery = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");

    const result = await pool.query(
      `UPDATE healthai.consommation_alimentaire SET ${setQuery}
       WHERE id_consumption = $${keys.length + 1} RETURNING *`,
      [...values, id_consumption]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Consommation non trouvée." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /:id_consumption
router.delete("/:id_consumption", async (req, res) => {
  const { id_consumption } = req.params;
  try {
    await pool.query(
      "DELETE FROM healthai.consommation_alimentaire WHERE id_consumption = $1",
      [id_consumption]
    );
    res.json({ message: "Consommation supprimée." });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
