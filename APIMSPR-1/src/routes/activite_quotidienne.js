/* global console */
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET / — activités avec détail intensité (vue v_intensite_seance)
router.get("/", async (req, res) => {
  try {
    if (req.user.role !== "admin" && !req.healthId) return res.json([]);

    const query = req.user.role === "admin"
      ? "SELECT * FROM healthai.v_intensite_seance ORDER BY date DESC"
      : "SELECT * FROM healthai.v_intensite_seance WHERE user_id = $1 ORDER BY date DESC";
    const params = req.user.role === "admin" ? [] : [req.healthId];

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /:user_id/:date — séance par utilisateur et date
router.get("/:user_id/:date", async (req, res) => {
  const { user_id, date } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM healthai.v_intensite_seance WHERE user_id = $1 AND date = $2",
      [user_id, date]
    );
    res.json(result.rows[0] ?? null);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// POST / — créer une séance + 4 lignes d'intensité (transaction)
router.post("/", async (req, res) => {
  const {
    user_id,
    date,
    workout_type,
    steps              = 0,
    total_distance     = 0,
    session_duration_hours = 0,
    calories_burned    = 0,
    very_active_distance       = null,
    very_active_minutes        = 0,
    moderately_active_distance = null,
    fairly_active_minutes      = 0,
    light_active_distance      = null,
    lightly_active_minutes     = 0,
    sedentary_minutes          = 0,
  } = req.body;

  const effectiveUserId = req.user.role !== "admin" ? req.healthId : user_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const actResult = await client.query(
      `INSERT INTO healthai.activite_journaliere
         (user_id, date, workout_type, steps, total_distance, session_duration_hours, calories_burned)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [effectiveUserId, date, workout_type, steps, total_distance, session_duration_hours, calories_burned]
    );
    const { id_activity } = actResult.rows[0];

    const intensites = [
      ["VERY_ACTIVE", very_active_distance,       very_active_minutes],
      ["MODERATE",    moderately_active_distance,  fairly_active_minutes],
      ["LIGHT",       light_active_distance,        lightly_active_minutes],
      ["SEDENTARY",   null,                         sedentary_minutes],
    ];

    for (const [niveau, distance, minutes] of intensites) {
      await client.query(
        `INSERT INTO healthai.activite_intensite (id_activity, niveau_intensite, distance, minutes)
         VALUES ($1,$2,$3,$4)`,
        [id_activity, niveau, distance, minutes]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ...actResult.rows[0], intensites });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /:id_activity — modifier une séance et ses intensités
router.put("/:id_activity", async (req, res) => {
  const { id_activity } = req.params;
  const allowed = ["date", "workout_type", "steps", "total_distance", "session_duration_hours", "calories_burned"];
  const fields = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (Object.keys(fields).length > 0) {
      const setString = Object.keys(fields).map((k, i) => `${k} = $${i + 1}`).join(", ");
      const values = [...Object.values(fields), id_activity];
      await client.query(
        `UPDATE healthai.activite_journaliere SET ${setString} WHERE id_activity = $${values.length}`,
        values
      );
    }

    const intensiteMap = {
      VERY_ACTIVE: { dist: req.body.very_active_distance,       min: req.body.very_active_minutes },
      MODERATE:    { dist: req.body.moderately_active_distance,  min: req.body.fairly_active_minutes },
      LIGHT:       { dist: req.body.light_active_distance,        min: req.body.lightly_active_minutes },
      SEDENTARY:   { dist: null,                                  min: req.body.sedentary_minutes },
    };

    for (const [niveau, { dist, min }] of Object.entries(intensiteMap)) {
      if (min !== undefined) {
        await client.query(
          `UPDATE healthai.activite_intensite
           SET distance = $1, minutes = $2
           WHERE id_activity = $3 AND niveau_intensite = $4`,
          [dist ?? null, min, id_activity, niveau]
        );
      }
    }

    await client.query("COMMIT");

    const result = await pool.query(
      "SELECT * FROM healthai.v_intensite_seance WHERE id_activity = $1",
      [id_activity]
    );
    res.json(result.rows[0] ?? null);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// DELETE /:id_activity — supprime la séance (CASCADE sur intensite)
router.delete("/:id_activity", async (req, res) => {
  const { id_activity } = req.params;
  try {
    await pool.query(
      "DELETE FROM healthai.activite_journaliere WHERE id_activity = $1",
      [id_activity]
    );
    res.json({ message: "Séance supprimée." });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
