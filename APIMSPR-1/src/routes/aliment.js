/* global console */
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET — tous les aliments (table nutrition)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT nutrition_id, food_item, category, calories_kcal,
              protein_g, carbohydrates_g, fat_g, fiber_g,
              sugars_g, sodium_mg, cholesterol_mg, meal_type, water_intake_ml
       FROM healthai.nutrition
       ORDER BY nutrition_id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /:food_item — recherche par nom exact
router.get("/:food_item", async (req, res) => {
  const { food_item } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM healthai.nutrition WHERE food_item = $1",
      [food_item]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Aliment non trouvé." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST — ajout d'un aliment (nutrition_id auto-incrémenté)
router.post("/", async (req, res) => {
  try {
    const {
      food_item, category, calories_kcal, protein_g, carbohydrates_g,
      fat_g, fiber_g, sugars_g = 0, sodium_mg = 0,
      cholesterol_mg = 0, meal_type = "SNACK", water_intake_ml = 0,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO healthai.nutrition
         (nutrition_id, food_item, category, calories_kcal, protein_g,
          carbohydrates_g, fat_g, fiber_g, sugars_g, sodium_mg,
          cholesterol_mg, meal_type, water_intake_ml)
       SELECT COALESCE(MAX(nutrition_id), 0) + 1,
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
       FROM healthai.nutrition
       RETURNING *`,
      [food_item, category, calories_kcal, protein_g, carbohydrates_g,
       fat_g, fiber_g, sugars_g, sodium_mg, cholesterol_mg, meal_type, water_intake_ml]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /:food_item — mise à jour par nom
router.put("/:food_item", async (req, res) => {
  const { food_item } = req.params;
  const allowed = [
    "food_item", "category", "calories_kcal", "protein_g", "carbohydrates_g",
    "fat_g", "fiber_g", "sugars_g", "sodium_mg", "cholesterol_mg",
    "meal_type", "water_intake_ml",
  ];
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
      `UPDATE healthai.nutrition SET ${setQuery}
       WHERE food_item = $${keys.length + 1} RETURNING *`,
      [...values, food_item]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Aliment non trouvé." });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /:food_item
router.delete("/:food_item", async (req, res) => {
  const { food_item } = req.params;
  try {
    await pool.query("DELETE FROM healthai.nutrition WHERE food_item = $1", [food_item]);
    res.json({ message: "Aliment supprimé." });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
