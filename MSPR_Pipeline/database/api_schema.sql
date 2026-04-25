-- ============================================================
-- HealthAI Coach — Tables applicatives (Auth + Ressources API)
-- À exécuter UNE FOIS après init.sql
-- ============================================================

SET search_path = healthai, public;

-- ── Comptes utilisateurs de l'API ───────────────────────────

CREATE TABLE IF NOT EXISTS api_users (
    id            SERIAL        PRIMARY KEY,
    email         VARCHAR(255)  UNIQUE NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    role          VARCHAR(20)   NOT NULL DEFAULT 'user'
                      CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Sessions JWT ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
    id         SERIAL      PRIMARY KEY,
    user_id    INT         NOT NULL REFERENCES api_users(id) ON DELETE CASCADE,
    token      TEXT        UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS ix_sessions_user  ON sessions(user_id);

-- ── Lien profil santé ↔ compte API ───────────────────────────

ALTER TABLE utilisateur
    ADD COLUMN IF NOT EXISTS api_user_id INT
        REFERENCES api_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_utilisateur_api_user ON utilisateur(api_user_id);

-- ── Référentiel exercices ────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercice (
    exercise_name     VARCHAR(100) PRIMARY KEY,
    category          VARCHAR(100),
    difficulty        VARCHAR(50),
    equipment         VARCHAR(100),
    calories_per_hour INT          CHECK (calories_per_hour >= 0),
    muscle_groups     VARCHAR(255),
    description       TEXT
);

-- ── Bien-être journalier ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS bien_etre (
    id            BIGINT   NOT NULL
                      REFERENCES utilisateur(user_id) ON DELETE CASCADE,
    activity_date DATE     NOT NULL,
    stress_level  SMALLINT CHECK (stress_level  BETWEEN 1 AND 10),
    energy_level  SMALLINT CHECK (energy_level  BETWEEN 1 AND 10),
    mood_score    SMALLINT CHECK (mood_score    BETWEEN 1 AND 10),
    hydration_ml  INT      CHECK (hydration_ml  >= 0),
    notes         TEXT,
    PRIMARY KEY (id, activity_date)
);

CREATE INDEX IF NOT EXISTS ix_bienetre_id ON bien_etre(id);

-- ── Sommeil journalier ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS sommeil (
    id                   BIGINT       NOT NULL
                             REFERENCES utilisateur(user_id) ON DELETE CASCADE,
    activity_date        DATE         NOT NULL,
    total_minutes_asleep INT          CHECK (total_minutes_asleep >= 0),
    total_minutes        INT          CHECK (total_minutes        >= 0),
    sleep_efficiency_pct NUMERIC(5,2) CHECK (sleep_efficiency_pct BETWEEN 0 AND 100),
    sleep_hours          NUMERIC(4,2) CHECK (sleep_hours >= 0),
    sleep_quality        VARCHAR(20),
    PRIMARY KEY (id, activity_date)
);

CREATE INDEX IF NOT EXISTS ix_sommeil_id ON sommeil(id);
