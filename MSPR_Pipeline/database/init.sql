-- ============================================================
-- HealthAI Coach — Schéma PostgreSQL
-- Généré depuis le pipeline ETL MSPR
-- Tables : utilisateur, activite_journaliere, activite_intensite,
--          nutrition, consommation_alimentaire
-- Vues   : v_profil_utilisateur, v_resume_journalier,
--          v_bilan_calorique, v_apport_nutritionnel,
--          v_intensite_seance, v_kpi_dashboard
-- ============================================================

CREATE SCHEMA IF NOT EXISTS healthai;
SET search_path = healthai, public;

-- ── Types ENUM ──────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE niveau_intensite_t AS ENUM
        ('VERY_ACTIVE', 'MODERATE', 'LIGHT', 'SEDENTARY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE repas_type_t AS ENUM
        ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLES
-- ============================================================

-- ── 1. UTILISATEUR ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS utilisateur (
    user_id          BIGINT        PRIMARY KEY,
    age              SMALLINT      NOT NULL CHECK (age BETWEEN 10 AND 120),
    gender           VARCHAR(20)   NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
    experience_level SMALLINT      NOT NULL CHECK (experience_level BETWEEN 1 AND 3),
    weight_kg        NUMERIC(6,2)  NOT NULL CHECK (weight_kg > 0),
    height_m         NUMERIC(4,2)  NOT NULL CHECK (height_m > 0),
    bmi_calculated   NUMERIC(6,2)  NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  utilisateur              IS 'Profils utilisateurs HealthAI Coach';
COMMENT ON COLUMN utilisateur.experience_level IS '1=débutant 2=intermédiaire 3=avancé';
COMMENT ON COLUMN utilisateur.bmi_calculated   IS 'weight_kg / height_m^2';

-- ── 2. ACTIVITE_JOURNALIERE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS activite_journaliere (
    id_activity            BIGSERIAL    PRIMARY KEY,
    user_id                BIGINT       NOT NULL
                               REFERENCES utilisateur(user_id) ON DELETE CASCADE,
    date                   DATE         NOT NULL,
    workout_type           VARCHAR(50)  NOT NULL,
    steps                  INT          NOT NULL CHECK (steps >= 0),
    total_distance         NUMERIC(8,2) NOT NULL CHECK (total_distance >= 0),
    session_duration_hours NUMERIC(5,2) NOT NULL CHECK (session_duration_hours >= 0),
    calories_burned        INT          NOT NULL CHECK (calories_burned >= 0)
);

CREATE INDEX IF NOT EXISTS ix_activite_user_id ON activite_journaliere(user_id);
CREATE INDEX IF NOT EXISTS ix_activite_date    ON activite_journaliere(date);
CREATE INDEX IF NOT EXISTS ix_activite_workout ON activite_journaliere(workout_type);

COMMENT ON TABLE activite_journaliere IS 'Séances sportives journalières (merged_analytics_mspr_20)';

-- ── 3. ACTIVITE_INTENSITE ───────────────────────────────────

CREATE TABLE IF NOT EXISTS activite_intensite (
    id_intensite     BIGSERIAL            PRIMARY KEY,
    id_activity      BIGINT               NOT NULL
                         REFERENCES activite_journaliere(id_activity) ON DELETE CASCADE,
    niveau_intensite niveau_intensite_t   NOT NULL,
    distance         NUMERIC(8,2)         CHECK (distance >= 0),
    minutes          INT                  NOT NULL CHECK (minutes >= 0),
    UNIQUE (id_activity, niveau_intensite)
);

CREATE INDEX IF NOT EXISTS ix_intensite_activity ON activite_intensite(id_activity);

COMMENT ON TABLE activite_intensite IS 'Décomposition de chaque séance en 4 niveaux d''intensité';

-- ── 4. NUTRITION ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nutrition (
    nutrition_id    INT           PRIMARY KEY,
    food_item       VARCHAR(255)  NOT NULL,
    category        VARCHAR(100)  NOT NULL,
    calories_kcal   INT           NOT NULL CHECK (calories_kcal >= 0),
    protein_g       NUMERIC(6,2)  NOT NULL CHECK (protein_g >= 0),
    carbohydrates_g NUMERIC(6,2)  NOT NULL CHECK (carbohydrates_g >= 0),
    fat_g           NUMERIC(6,2)  NOT NULL CHECK (fat_g >= 0),
    fiber_g         NUMERIC(6,2)  NOT NULL CHECK (fiber_g >= 0),
    sugars_g        NUMERIC(6,2)  NOT NULL CHECK (sugars_g >= 0),
    sodium_mg       INT           NOT NULL CHECK (sodium_mg >= 0),
    cholesterol_mg  INT           NOT NULL CHECK (cholesterol_mg >= 0),
    meal_type       repas_type_t  NOT NULL,
    water_intake_ml INT           NOT NULL CHECK (water_intake_ml >= 0)
);

CREATE INDEX IF NOT EXISTS ix_nutrition_category  ON nutrition(category);
CREATE INDEX IF NOT EXISTS ix_nutrition_meal_type ON nutrition(meal_type);

COMMENT ON TABLE nutrition IS 'Référentiel nutritionnel (daily_food_nutrition_dataset)';
COMMENT ON COLUMN nutrition.meal_type IS 'Type de repas : même ENUM que consommation_alimentaire.repas_type';

-- ── 5. CONSOMMATION_ALIMENTAIRE ─────────────────────────────

CREATE TABLE IF NOT EXISTS consommation_alimentaire (
    id_consumption    BIGINT       PRIMARY KEY,
    user_id           BIGINT       NOT NULL
                          REFERENCES utilisateur(user_id) ON DELETE CASCADE,
    nutrition_id      INT          NOT NULL
                          REFERENCES nutrition(nutrition_id),
    date_consommation DATE         NOT NULL,
    repas_type        repas_type_t NOT NULL,
    quantite_grammes  NUMERIC(7,2) NOT NULL CHECK (quantite_grammes > 0)
);

CREATE INDEX IF NOT EXISTS ix_consomm_user_id   ON consommation_alimentaire(user_id);
CREATE INDEX IF NOT EXISTS ix_consomm_date      ON consommation_alimentaire(date_consommation);
CREATE INDEX IF NOT EXISTS ix_consomm_nutrition ON consommation_alimentaire(nutrition_id);

COMMENT ON TABLE consommation_alimentaire IS 'Consommations alimentaires simulées (seed=42)';

-- ============================================================
-- VUES ANALYTIQUES
-- ============================================================

-- Vue 1 : Profil complet avec catégorie IMC et stats agrégées

CREATE OR REPLACE VIEW v_profil_utilisateur AS
SELECT
    u.user_id,
    u.age,
    u.gender,
    u.experience_level,
    u.weight_kg,
    u.height_m,
    u.bmi_calculated,
    CASE
        WHEN u.bmi_calculated < 18.5 THEN 'Sous-poids'
        WHEN u.bmi_calculated < 25   THEN 'Normal'
        WHEN u.bmi_calculated < 30   THEN 'Surpoids'
        ELSE 'Obesite'
    END                                               AS categorie_imc,
    COUNT(DISTINCT aj.id_activity)                    AS nb_seances,
    ROUND(AVG(aj.calories_burned))                    AS moy_calories_brulees,
    ROUND(AVG(aj.session_duration_hours)::NUMERIC, 2) AS moy_duree_seance_h,
    COALESCE(SUM(aj.steps), 0)                        AS total_steps
FROM utilisateur u
LEFT JOIN activite_journaliere aj ON aj.user_id = u.user_id
GROUP BY u.user_id, u.age, u.gender, u.experience_level,
         u.weight_kg, u.height_m, u.bmi_calculated;

-- Vue 2 : Résumé journalier — activité + macros nutritionnels

CREATE OR REPLACE VIEW v_resume_journalier AS
SELECT
    aj.user_id,
    aj.date,
    aj.workout_type,
    aj.steps,
    aj.calories_burned,
    aj.session_duration_hours,
    ROUND(COALESCE(
        SUM((ca.quantite_grammes / 100.0) * n.calories_kcal), 0
    )::NUMERIC, 0) AS calories_consommees,
    ROUND(COALESCE(
        SUM((ca.quantite_grammes / 100.0) * n.protein_g), 0
    )::NUMERIC, 1) AS proteines_g,
    ROUND(COALESCE(
        SUM((ca.quantite_grammes / 100.0) * n.carbohydrates_g), 0
    )::NUMERIC, 1) AS glucides_g,
    ROUND(COALESCE(
        SUM((ca.quantite_grammes / 100.0) * n.fat_g), 0
    )::NUMERIC, 1) AS lipides_g
FROM activite_journaliere aj
LEFT JOIN consommation_alimentaire ca
       ON ca.user_id          = aj.user_id
      AND ca.date_consommation = aj.date
LEFT JOIN nutrition n ON n.nutrition_id = ca.nutrition_id
GROUP BY aj.id_activity, aj.user_id, aj.date,
         aj.workout_type, aj.steps, aj.calories_burned, aj.session_duration_hours;

-- Vue 3 : Bilan calorique (dépense vs apport)

CREATE OR REPLACE VIEW v_bilan_calorique AS
SELECT
    user_id,
    date,
    calories_burned                          AS calories_depensees,
    calories_consommees,
    (calories_burned - calories_consommees)  AS bilan,
    CASE
        WHEN (calories_burned - calories_consommees) >  200 THEN 'Deficit'
        WHEN (calories_burned - calories_consommees) < -200 THEN 'Excedent'
        ELSE 'Equilibre'
    END                                      AS statut
FROM v_resume_journalier;

-- Vue 4 : Apport nutritionnel détaillé par repas

CREATE OR REPLACE VIEW v_apport_nutritionnel AS
SELECT
    ca.user_id,
    ca.date_consommation                                                        AS date,
    ca.repas_type,
    n.food_item,
    n.category,
    ca.quantite_grammes,
    ROUND((ca.quantite_grammes / 100.0 * n.calories_kcal)::NUMERIC,  1) AS calories_total,
    ROUND((ca.quantite_grammes / 100.0 * n.protein_g)::NUMERIC,      2) AS proteines_g,
    ROUND((ca.quantite_grammes / 100.0 * n.carbohydrates_g)::NUMERIC, 2) AS glucides_g,
    ROUND((ca.quantite_grammes / 100.0 * n.fat_g)::NUMERIC,           2) AS lipides_g
FROM consommation_alimentaire ca
JOIN nutrition n ON n.nutrition_id = ca.nutrition_id;

-- Vue 5 : Répartition de l'intensité par séance

CREATE OR REPLACE VIEW v_intensite_seance AS
SELECT
    aj.id_activity,
    aj.user_id,
    aj.date,
    aj.workout_type,
    SUM(CASE WHEN ai.niveau_intensite = 'VERY_ACTIVE' THEN ai.minutes ELSE 0 END) AS min_tres_actif,
    SUM(CASE WHEN ai.niveau_intensite = 'MODERATE'    THEN ai.minutes ELSE 0 END) AS min_modere,
    SUM(CASE WHEN ai.niveau_intensite = 'LIGHT'       THEN ai.minutes ELSE 0 END) AS min_leger,
    SUM(CASE WHEN ai.niveau_intensite = 'SEDENTARY'   THEN ai.minutes ELSE 0 END) AS min_sedentaire,
    ROUND(
        100.0
        * SUM(CASE WHEN ai.niveau_intensite IN ('VERY_ACTIVE','MODERATE')
                   THEN ai.minutes ELSE 0 END)
        / NULLIF(SUM(ai.minutes), 0)
    , 1) AS pct_actif
FROM activite_journaliere aj
JOIN activite_intensite ai ON ai.id_activity = aj.id_activity
GROUP BY aj.id_activity, aj.user_id, aj.date, aj.workout_type;

-- Vue 6 : KPI dashboard (endpoint /kpi/:user_id)

CREATE OR REPLACE VIEW v_kpi_dashboard AS
SELECT
    vp.user_id,
    vp.age,
    vp.gender,
    vp.bmi_calculated,
    vp.categorie_imc,
    vp.nb_seances,
    vp.moy_calories_brulees,
    vp.moy_duree_seance_h,
    vp.total_steps,
    COUNT(DISTINCT rj.date)                        AS jours_avec_activite,
    ROUND(AVG(rj.calories_consommees)::NUMERIC, 0) AS moy_calories_consommees,
    ROUND(AVG(rj.proteines_g)::NUMERIC, 1)         AS moy_proteines_g,
    ROUND(AVG(rj.glucides_g)::NUMERIC, 1)          AS moy_glucides_g,
    ROUND(AVG(rj.lipides_g)::NUMERIC, 1)           AS moy_lipides_g
FROM v_profil_utilisateur vp
LEFT JOIN v_resume_journalier rj ON rj.user_id = vp.user_id
GROUP BY vp.user_id, vp.age, vp.gender, vp.bmi_calculated,
         vp.categorie_imc, vp.nb_seances, vp.moy_calories_brulees,
         vp.moy_duree_seance_h, vp.total_steps;

