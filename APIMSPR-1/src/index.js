/* global console */
import express from "express";
import authRoutes from "./routes/auth.js";
import utilisateursRoutes from "./routes/utilisateurs.js";
import alimentRoutes from "./routes/aliment.js";
import activiteRoutes from "./routes/activite_quotidienne.js";
import consommationRoutes from "./routes/consommation_alimentaire.js";
import analyticsRoutes from "./routes/analytics.js";
import { authenticate, authorizeWrite } from "./middleware/auth.js";
import { attachHealthId } from "./middleware/healthId.js";
import cookieParser from "cookie-parser";
import process from "process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(join(__dirname, "../public/dist")));

// Public
app.use("/auth", authRoutes);

// Référentiels (admin write / user read)
app.use("/utilisateurs", authenticate, authorizeWrite, utilisateursRoutes);
app.use("/aliment",      authenticate, authorizeWrite, alimentRoutes);

// Données de santé (filtrées par user_id pour les non-admins)
app.use("/activite_quotidienne", authenticate, authorizeWrite, attachHealthId, activiteRoutes);
app.use("/consommation",         authenticate, authorizeWrite, attachHealthId, consommationRoutes);

// Vues analytiques (lecture seule, filtrées par healthId pour les non-admins)
app.use("/analytics", authenticate, attachHealthId, analyticsRoutes);

// React app fallback
app.use((_req, res) => {
  res.sendFile(join(__dirname, "../public/dist/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
