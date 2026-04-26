/* global console */
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Admin → no filter. User with linked profile → filter by healthId. User without profile → [].
function resolveUid(req) {
  if (req.user.role === "admin") return { isAdmin: true, uid: null };
  return { isAdmin: false, uid: req.healthId ?? null };
}

// GET /analytics/profil — v_profil_utilisateur
router.get("/profil", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_profil_utilisateur ORDER BY user_id")
      : await pool.query("SELECT * FROM healthai.v_profil_utilisateur WHERE user_id = $1", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/resume — v_resume_journalier
router.get("/resume", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_resume_journalier ORDER BY user_id, date DESC")
      : await pool.query("SELECT * FROM healthai.v_resume_journalier WHERE user_id = $1 ORDER BY date DESC", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/bilan — v_bilan_calorique
router.get("/bilan", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_bilan_calorique ORDER BY user_id, date DESC")
      : await pool.query("SELECT * FROM healthai.v_bilan_calorique WHERE user_id = $1 ORDER BY date DESC", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/apport — v_apport_nutritionnel
router.get("/apport", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_apport_nutritionnel ORDER BY user_id, date DESC")
      : await pool.query("SELECT * FROM healthai.v_apport_nutritionnel WHERE user_id = $1 ORDER BY date DESC", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/intensite — v_intensite_seance
router.get("/intensite", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_intensite_seance ORDER BY user_id, date DESC")
      : await pool.query("SELECT * FROM healthai.v_intensite_seance WHERE user_id = $1 ORDER BY date DESC", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /analytics/kpi — v_kpi_dashboard
router.get("/kpi", async (req, res) => {
  try {
    const { isAdmin, uid } = resolveUid(req);
    if (!isAdmin && !uid) return res.json([]);
    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM healthai.v_kpi_dashboard ORDER BY user_id")
      : await pool.query("SELECT * FROM healthai.v_kpi_dashboard WHERE user_id = $1", [uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
