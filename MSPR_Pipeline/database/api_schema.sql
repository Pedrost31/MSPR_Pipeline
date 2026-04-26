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

