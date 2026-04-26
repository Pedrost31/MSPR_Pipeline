# Documentation API — HealthAI Coach

> **Affichage recommandé :** `Ctrl + Shift + V` dans VS Code (aperçu Markdown)

**Stack :** Node.js 20 · Express 5 · PostgreSQL 15 · JWT · React 18 (Vite)  
**Base de données :** schéma `healthai` — `postgresql://localhost:5432/healthai`  
**Port par défaut :** `3000`

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Base de données — Schéma](#2-base-de-données--schéma)
3. [Authentification et sessions](#3-authentification-et-sessions)
4. [Middleware](#4-middleware)
5. [Routes — Auth & Comptes](#5-routes--auth--comptes)
6. [Routes — Profils santé](#6-routes--profils-santé)
7. [Routes — Activités physiques](#7-routes--activités-physiques)
8. [Routes — Référentiel alimentaire](#8-routes--référentiel-alimentaire)
9. [Routes — Consommation alimentaire](#9-routes--consommation-alimentaire)
10. [Routes — Exercices](#10-routes--exercices)
11. [Routes — Analytiques](#11-routes--analytiques)
12. [Frontend React](#12-frontend-react)
13. [Codes d'erreur](#13-codes-derreur)
14. [Démarrage et configuration](#14-démarrage-et-configuration)

---

## 1. Architecture générale

```
APIMSPR-1/
├── src/
│   ├── index.js                       # Point d'entrée Express
│   ├── db.js                          # Pool de connexion PostgreSQL
│   ├── middleware/
│   │   ├── auth.js                    # JWT + contrôle des rôles
│   │   └── healthId.js                # Résolution du profil santé lié
│   └── routes/
│       ├── auth.js                    # Authentification & gestion des comptes
│       ├── utilisateurs.js            # Profils santé
│       ├── activite_quotidienne.js    # Activités physiques journalières
│       ├── aliment.js                 # Référentiel nutritionnel
│       ├── consommation_alimentaire.js # Journaux de repas
│       ├── exercice.js                # Référentiel exercices
│       └── analytics.js              # Vues analytiques
├── client/                            # Frontend React 18 (Vite)
│   └── src/
│       ├── App.jsx                    # Routeur + guards de rôle
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── ToastContext.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── admin/AdminPage.jsx
│           └── dashboard/DashboardPage.jsx
└── public/dist/                       # Build React servi par Express
```

### Montage des routes — `src/index.js`

```
GET  /health                               → healthcheck (200 OK)

POST /auth/register                        → public
POST /auth/login                           → public
     /auth/*                               → authenticate (sauf register/login)

     /utilisateurs/*                       → authenticate → authorizeWrite
     /aliment/*                            → authenticate → authorizeWrite
     /exercice/*                           → authenticate → authorizeWrite
     /activite_quotidienne/*               → authenticate → authorizeWrite → attachHealthId
     /consommation/*                       → authenticate → authorizeWrite → attachHealthId
     /analytics/*                          → authenticate → attachHealthId
```

---

## 2. Base de données — Schéma

### Connexion — `src/db.js`

```js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Toutes les requêtes utilisent le préfixe explicite healthai.table
```

### Tables du schéma `healthai`

#### `api_users` — Comptes d'authentification

```sql
CREATE TABLE healthai.api_users (
    id            SERIAL       PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                               CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

#### `sessions` — Sessions JWT actives

```sql
CREATE TABLE healthai.sessions (
    id         SERIAL      PRIMARY KEY,
    user_id    INT         NOT NULL REFERENCES healthai.api_users(id) ON DELETE CASCADE,
    token      TEXT        UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
```

#### `utilisateur` — Profils santé

```sql
CREATE TABLE healthai.utilisateur (
    user_id          BIGINT       PRIMARY KEY,
    age              SMALLINT     NOT NULL CHECK (age BETWEEN 10 AND 120),
    gender           VARCHAR(20)  NOT NULL CHECK (gender IN ('Male','Female','Other')),
    experience_level SMALLINT     NOT NULL CHECK (experience_level BETWEEN 1 AND 3),
    weight_kg        NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0),
    height_m         NUMERIC(4,2) NOT NULL CHECK (height_m > 0),
    bmi_calculated   NUMERIC(6,2) NOT NULL,
    api_user_id      INT          REFERENCES healthai.api_users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
```

| Colonne | Type | Description |
|---|---|---|
| `user_id` | bigint PK | ID issu du dataset source (Kaggle) |
| `age` | smallint | Âge en années (10–120) |
| `gender` | varchar | `Male`, `Female` ou `Other` |
| `experience_level` | smallint | 1 = débutant, 2 = intermédiaire, 3 = avancé |
| `weight_kg` | numeric(6,2) | Poids en kg |
| `height_m` | numeric(4,2) | Taille en mètres |
| `bmi_calculated` | numeric(6,2) | IMC calculé par le pipeline ETL |
| `api_user_id` | int FK | Compte d'authentification associé (nullable) |

#### `activite_journaliere` — Séances sportives

```sql
CREATE TABLE healthai.activite_journaliere (
    id_activity            BIGSERIAL    PRIMARY KEY,
    user_id                BIGINT       NOT NULL REFERENCES healthai.utilisateur(user_id) ON DELETE CASCADE,
    date                   DATE         NOT NULL,
    workout_type           VARCHAR(50)  NOT NULL,
    steps                  INT          NOT NULL CHECK (steps >= 0),
    total_distance         NUMERIC(8,2) NOT NULL CHECK (total_distance >= 0),
    session_duration_hours NUMERIC(5,2) NOT NULL CHECK (session_duration_hours >= 0),
    calories_burned        INT          NOT NULL CHECK (calories_burned >= 0)
);
```

#### `activite_intensite` — Niveaux d'intensité par séance

```sql
CREATE TYPE healthai.niveau_intensite_t AS ENUM ('VERY_ACTIVE','MODERATE','LIGHT','SEDENTARY');

CREATE TABLE healthai.activite_intensite (
    id_intensite     BIGSERIAL                   PRIMARY KEY,
    id_activity      BIGINT                      NOT NULL REFERENCES healthai.activite_journaliere(id_activity) ON DELETE CASCADE,
    niveau_intensite healthai.niveau_intensite_t NOT NULL,
    distance         NUMERIC(8,2)                CHECK (distance >= 0),
    minutes          INT                         NOT NULL CHECK (minutes >= 0),
    UNIQUE (id_activity, niveau_intensite)
);
```

Chaque séance possède **exactement 4 lignes** d'intensité (une par niveau ENUM).

#### `nutrition` — Référentiel alimentaire

```sql
CREATE TYPE healthai.repas_type_t AS ENUM ('BREAKFAST','LUNCH','DINNER','SNACK');

CREATE TABLE healthai.nutrition (
    nutrition_id    INT          PRIMARY KEY,
    food_item       VARCHAR(255) NOT NULL,
    category        VARCHAR(100) NOT NULL,
    calories_kcal   INT          NOT NULL CHECK (calories_kcal >= 0),
    protein_g       NUMERIC(6,2) NOT NULL CHECK (protein_g >= 0),
    carbohydrates_g NUMERIC(6,2) NOT NULL CHECK (carbohydrates_g >= 0),
    fat_g           NUMERIC(6,2) NOT NULL CHECK (fat_g >= 0),
    fiber_g         NUMERIC(6,2) NOT NULL CHECK (fiber_g >= 0),
    sugars_g        NUMERIC(6,2) NOT NULL CHECK (sugars_g >= 0),
    sodium_mg       INT          NOT NULL CHECK (sodium_mg >= 0),
    cholesterol_mg  INT          NOT NULL CHECK (cholesterol_mg >= 0),
    meal_type       healthai.repas_type_t NOT NULL,
    water_intake_ml INT          NOT NULL CHECK (water_intake_ml >= 0)
);
```

#### `consommation_alimentaire` — Journaux de repas

```sql
CREATE TABLE healthai.consommation_alimentaire (
    id_consumption    BIGINT                NOT NULL PRIMARY KEY,
    user_id           BIGINT                NOT NULL REFERENCES healthai.utilisateur(user_id) ON DELETE CASCADE,
    nutrition_id      INT                   NOT NULL REFERENCES healthai.nutrition(nutrition_id),
    date_consommation DATE                  NOT NULL,
    repas_type        healthai.repas_type_t NOT NULL,
    quantite_grammes  NUMERIC(7,2)          NOT NULL CHECK (quantite_grammes > 0)
);
```

#### `exercice` — Référentiel exercices

```sql
CREATE TABLE healthai.exercice (
    exercise_name     VARCHAR(100) PRIMARY KEY,
    category          VARCHAR(100),
    difficulty        VARCHAR(50),
    equipment         VARCHAR(100),
    calories_per_hour INT          CHECK (calories_per_hour >= 0),
    muscle_groups     VARCHAR(255),
    description       TEXT
);
```

### Vues analytiques

| Vue | Description |
|---|---|
| `v_profil_utilisateur` | Profil + agrégats de séances (nb, calories moyennes, steps) |
| `v_resume_journalier` | Résumé quotidien activité + macronutriments |
| `v_bilan_calorique` | Balance énergétique (dépensé − consommé) avec statut |
| `v_apport_nutritionnel` | Détail macros par repas et par jour |
| `v_intensite_seance` | Répartition minutes par niveau d'intensité |
| `v_kpi_dashboard` | KPI globaux pour tableau de bord |

---

## 3. Authentification et sessions

Le système utilise des **tokens JWT** (durée de vie 24h) stockés dans un cookie `httpOnly`.  
Chaque session est également enregistrée en base (`healthai.sessions`) pour permettre la **révocation**.

### Flux complet

```
Client          API                    PostgreSQL
  │                │                       │
  │ POST /auth/login │                     │
  │ { email, pass } ├──────────────────────►│
  │                │  SELECT api_users      │
  │                │◄──────────────────────┤
  │                │  bcrypt.compare()      │
  │                │  jwt.sign() → token    │
  │                ├──────────────────────►│
  │                │  INSERT sessions       │
  │◄──────────────┤                       │
  │  Set-Cookie: token=...  (httpOnly)     │
  │                │                       │
  │ GET /auth/me   │                       │
  │  Cookie: token ├──────────────────────►│
  │                │  SELECT sessions       │
  │                │  WHERE token=? AND     │
  │                │  expires_at > NOW()    │
  │◄──────────────┤                       │
  │  { id, email, role, healthId }        │
```

### Token JWT — payload

```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "user",
  "iat": 1714128000,
  "exp": 1714214400
}
```

---

## 4. Middleware

### `authenticate` — `src/middleware/auth.js`

Vérifie le JWT (cookie `token` ou header `Authorization: Bearer <token>`) et contrôle que la session est encore active en base.

```js
export async function authenticate(req, res, next) {
  const token = req.cookies?.token
    || req.headers["authorization"]?.slice(7);

  if (!token) return res.status(401).json({ error: "No token provided." });

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const session = await pool.query(
    "SELECT id FROM healthai.sessions WHERE token = $1 AND expires_at > NOW()",
    [token]
  );
  if (session.rows.length === 0)
    return res.status(401).json({ error: "Session expired or revoked." });

  req.user  = decoded;  // { id, email, role }
  req.token = token;
  next();
}
```

### `authorizeWrite` — `src/middleware/auth.js`

Bloque les méthodes d'écriture (`POST`, `PUT`, `PATCH`, `DELETE`) pour les comptes avec le rôle `user`.

```js
export function authorizeWrite(req, res, next) {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(req.method) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required for write operations." });
  }
  next();
}
```

### `attachHealthId` — `src/middleware/healthId.js`

Résout l'ID du profil santé (`utilisateur.user_id`) lié au compte connecté.  
Appliqué sur les routes de données de santé — permet le filtrage automatique par utilisateur.

```js
export async function attachHealthId(req, res, next) {
  if (req.user.role === "admin") { next(); return; }

  const r = await pool.query(
    "SELECT user_id FROM healthai.utilisateur WHERE api_user_id = $1",
    [req.user.id]
  );
  req.healthId = r.rows[0]?.user_id ?? null;
  next();
}
```

> Si `req.healthId` est `null` (profil non encore attribué), les routes renvoient `[]`.

---

## 5. Routes — Auth & Comptes

### `POST /auth/register`

Crée un compte avec le rôle `user`.

**Body :**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Réponse 201 :**
```json
{ "message": "Account created.", "user": { "id": 1, "email": "user@example.com", "role": "user" } }
```

**Erreurs :** `400` champs manquants · `409` email déjà utilisé

---

### `POST /auth/login`

Authentifie l'utilisateur, crée un JWT (24h), l'enregistre en session et le pose en cookie `httpOnly`.

**Body :**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Réponse 200 :**
```json
{ "role": "admin", "email": "user@example.com", "id": 1 }
```

**Erreurs :** `400` champs manquants · `401` email ou mot de passe incorrect

---

### `POST /auth/logout`

Supprime la session en base et efface le cookie JWT.

**Auth :** Requis  
**Réponse 200 :**
```json
{ "message": "Logged out." }
```

---

### `GET /auth/me`

Retourne les infos du compte connecté et l'ID du profil santé lié.

**Auth :** Requis  
**Réponse 200 :**
```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "user",
  "healthId": 1503960366
}
```

> `healthId` est `null` si aucun profil n'est encore attribué.

---

### Gestion des comptes — Admin uniquement

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/auth/users` | Liste tous les comptes (id, email, role, created_at) |
| `POST` | `/auth/users` | Crée un compte avec rôle choisi |
| `PUT` | `/auth/users/:id` | Modifie l'email d'un compte |
| `PATCH` | `/auth/users/:id/role` | Change le rôle (`user` ↔ `admin`) |
| `DELETE` | `/auth/users/:id` | Supprime un compte (cascade sur sessions) |
| `GET` | `/auth/stats` | Nombre de lignes par table |

**POST /auth/users — Body :**
```json
{ "email": "newuser@example.com", "password": "pass123", "role": "user" }
```

**PATCH /auth/users/:id/role — Body :**
```json
{ "role": "admin" }
```

---

## 6. Routes — Profils santé

Base URL : `/utilisateurs`  
**Auth :** Requis sur toutes les routes

### `GET /utilisateurs`

- **Admin :** Tous les profils avec le compte associé (LEFT JOIN sur `api_users`)
- **User :** Uniquement son propre profil

**Réponse admin (exemple) :**
```json
[
  {
    "user_id": 1503960366,
    "age": 28,
    "gender": "Male",
    "experience_level": 2,
    "weight_kg": "78.50",
    "height_m": "1.75",
    "bmi_calculated": "25.63",
    "api_user_id": 3,
    "account_email": "john@example.com",
    "account_role": "user"
  }
]
```

---

### `GET /utilisateurs/unlinked`

**Admin uniquement.** Retourne les profils sans compte associé (`api_user_id IS NULL`).

---

### `PUT /utilisateurs/:id/link`

**Admin uniquement.** Attribue un compte à un profil santé.

**Body :**
```json
{ "api_user_id": 5 }
```

**Réponse 200 :**
```json
{ "message": "Profile linked.", "utilisateur": { ... } }
```

**Erreurs :** `404` compte introuvable · `409` compte déjà lié à un autre profil

---

### `DELETE /utilisateurs/:id/link`

**Admin uniquement.** Retire le lien entre un profil et son compte (SET api_user_id = NULL).

**Réponse 200 :**
```json
{ "message": "Profile unlinked.", "utilisateur": { ... } }
```

---

### `POST /utilisateurs`

**Admin uniquement.** Crée un nouveau profil santé.

**Body :**
```json
{
  "user_id": 9999999,
  "age": 30,
  "gender": "Female",
  "experience_level": 1,
  "weight_kg": 65.0,
  "height_m": 1.68,
  "bmi_calculated": 23.03,
  "api_user_id": null
}
```

---

### `PUT /utilisateurs/:id`

**Admin uniquement.** Met à jour un profil (age, gender, weight_kg, height_m, bmi_calculated).

---

### `DELETE /utilisateurs/:id`

**Admin uniquement.** Supprime un profil (cascade sur activités et consommations).

---

## 7. Routes — Activités physiques

Base URL : `/activite_quotidienne`  
**Auth :** Requis · **Écriture :** Admin uniquement

### `GET /activite_quotidienne`

- **Admin :** Toutes les activités de tous les utilisateurs
- **User :** Uniquement ses propres activités (filtré par `healthId`)

**Réponse (exemple) :**
```json
[
  {
    "id_activity": 1,
    "user_id": 1503960366,
    "date": "2016-04-12",
    "workout_type": "Running",
    "steps": 13162,
    "total_distance": "8.50",
    "session_duration_hours": "1.25",
    "calories_burned": 1985
  }
]
```

---

### `GET /activite_quotidienne/:user_id/:date`

Récupère une activité précise par utilisateur et date.

**Exemple :** `GET /activite_quotidienne/1503960366/2016-04-12`

---

### `POST /activite_quotidienne`

Crée une séance + ses 4 lignes d'intensité en **transaction**.

**Body :**
```json
{
  "user_id": 1503960366,
  "date": "2026-04-26",
  "workout_type": "Running",
  "steps": 10500,
  "total_distance": 8.5,
  "session_duration_hours": 1.25,
  "calories_burned": 650,
  "very_active_distance": 8.5,
  "very_active_minutes": 45,
  "fairly_active_minutes": 20,
  "lightly_active_minutes": 10,
  "sedentary_minutes": 10
}
```

**Réponse 201 :**
```json
{
  "activity": { "id_activity": 42, ... },
  "intensities": [
    { "niveau_intensite": "VERY_ACTIVE", "distance": 8.5, "minutes": 45 },
    { "niveau_intensite": "MODERATE",    "distance": null, "minutes": 20 },
    { "niveau_intensite": "LIGHT",       "distance": null, "minutes": 10 },
    { "niveau_intensite": "SEDENTARY",   "distance": null, "minutes": 10 }
  ]
}
```

---

### `PUT /activite_quotidienne/:id_activity`

Met à jour une séance et ses niveaux d'intensité (même body que POST sans `user_id`).

---

### `DELETE /activite_quotidienne/:id_activity`

Supprime une séance (cascade sur les 4 lignes d'intensité).

---

## 8. Routes — Référentiel alimentaire

Base URL : `/aliment`  
**Auth :** Requis · **Écriture :** Admin uniquement

### `GET /aliment`

Retourne tous les aliments du référentiel (591 entrées initiales).

**Réponse (exemple) :**
```json
[
  {
    "nutrition_id": 1,
    "food_item": "Apple",
    "category": "Fruits",
    "calories_kcal": 52,
    "protein_g": "0.30",
    "carbohydrates_g": "14.00",
    "fat_g": "0.20",
    "fiber_g": "2.40",
    "sugars_g": "10.40",
    "sodium_mg": 1,
    "cholesterol_mg": 0,
    "meal_type": "SNACK",
    "water_intake_ml": 200
  }
]
```

---

### `GET /aliment/:food_item`

Retourne un aliment par son nom exact.

**Exemple :** `GET /aliment/Apple`

---

### `POST /aliment`

Crée un aliment dans le référentiel.

**Body :**
```json
{
  "nutrition_id": 600,
  "food_item": "Quinoa",
  "category": "Grains",
  "calories_kcal": 120,
  "protein_g": 4.4,
  "carbohydrates_g": 21.3,
  "fat_g": 1.9,
  "fiber_g": 2.8,
  "sugars_g": 0.9,
  "sodium_mg": 7,
  "cholesterol_mg": 0,
  "meal_type": "LUNCH",
  "water_intake_ml": 0
}
```

---

### `PUT /aliment/:food_item`

Met à jour les informations nutritionnelles d'un aliment.

---

### `DELETE /aliment/:food_item`

Supprime un aliment du référentiel.

---

## 9. Routes — Consommation alimentaire

Base URL : `/consommation`  
**Auth :** Requis · **Écriture :** Admin uniquement

### `GET /consommation`

- **Admin :** Tous les journaux alimentaires
- **User :** Uniquement ses propres entrées (filtré par `healthId`)

**Réponse (exemple) :**
```json
[
  {
    "id_consumption": 1,
    "user_id": 1503960366,
    "nutrition_id": 42,
    "date_consommation": "2016-04-12",
    "repas_type": "BREAKFAST",
    "quantite_grammes": "200.00"
  }
]
```

---

### `GET /consommation/:id_consumption`

Récupère une entrée par son ID.

---

### `POST /consommation`

Enregistre une consommation alimentaire.

**Body (admin) :**
```json
{
  "user_id": 1503960366,
  "nutrition_id": 42,
  "date_consommation": "2026-04-26",
  "repas_type": "BREAKFAST",
  "quantite_grammes": 200
}
```

**Body (user)** — `user_id` est ignoré, remplacé par `healthId` :
```json
{
  "nutrition_id": 42,
  "date_consommation": "2026-04-26",
  "repas_type": "BREAKFAST",
  "quantite_grammes": 200
}
```

**Valeurs acceptées pour `repas_type` :** `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`

---

### `PUT /consommation/:id_consumption`

Met à jour une entrée de consommation.

---

### `DELETE /consommation/:id_consumption`

Supprime une entrée de consommation.

---

## 10. Routes — Exercices

Base URL : `/exercice`  
**Auth :** Requis · **Écriture :** Admin uniquement

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/exercice` | Liste tous les exercices |
| `GET` | `/exercice/:exercise_name` | Un exercice par nom |
| `POST` | `/exercice` | Créer un exercice |
| `PUT` | `/exercice/:exercise_name` | Modifier un exercice |
| `DELETE` | `/exercice/:exercise_name` | Supprimer un exercice |

**POST /exercice — Body :**
```json
{
  "exercise_name": "Burpees",
  "category": "Cardio",
  "difficulty": "Hard",
  "equipment": "None",
  "calories_per_hour": 800,
  "muscle_groups": "Full Body",
  "description": "Exercice complet combinant squat, planche et saut."
}
```

---

## 11. Routes — Analytiques

Base URL : `/analytics`  
**Auth :** Requis · **Lecture seule**  
Toutes les routes retournent les données filtrées sur le profil de l'utilisateur connecté (admin voit tout).

| Méthode | Route | Vue SQL | Description |
|---|---|---|---|
| `GET` | `/analytics/profil` | `v_profil_utilisateur` | Profil + agrégats de séances |
| `GET` | `/analytics/resume` | `v_resume_journalier` | Résumé quotidien activité + nutrition |
| `GET` | `/analytics/bilan` | `v_bilan_calorique` | Balance énergétique par jour |
| `GET` | `/analytics/apport` | `v_apport_nutritionnel` | Macros détaillés par repas |
| `GET` | `/analytics/intensite` | `v_intensite_seance` | Minutes par niveau d'intensité |
| `GET` | `/analytics/kpi` | `v_kpi_dashboard` | KPI globaux pour tableau de bord |

**Exemple — `GET /analytics/bilan` :**
```json
[
  {
    "user_id": 1503960366,
    "date": "2016-04-12",
    "calories_depensees": 1985,
    "calories_consommees": 1820,
    "bilan": 165,
    "statut": "Deficit"
  }
]
```

**Statuts du bilan calorique :**
- `Deficit` : calories_depensees − calories_consommées > 200
- `Excedent` : calories_consommées − calories_depensées > 200
- `Equilibre` : différence ≤ 200 kcal

---

## 12. Frontend React

**Stack :** React 18 · Vite 5 · React Router 6 · CSS variables

### Structure

```
client/src/
├── main.jsx                # AuthProvider + ToastProvider
├── App.jsx                 # Routeur + guards de rôle
├── api.js                  # Wrapper fetch (credentials: include)
├── context/
│   ├── AuthContext.jsx     # État global : user, role, healthId
│   └── ToastContext.jsx    # Notifications toast
├── components/
│   ├── Icons.jsx
│   └── Modal.jsx           # Modal réutilisable
└── pages/
    ├── Login.jsx
    ├── admin/
    │   ├── AdminPage.jsx   # Conteneur avec navigation par sections
    │   └── sections/
    │       ├── DashboardSection.jsx   # Compteurs de lignes
    │       ├── UsersSection.jsx       # CRUD comptes
    │       ├── ProfilsSection.jsx     # Attribution profils ↔ comptes
    │       ├── AlimentSection.jsx     # CRUD référentiel alimentaire
    │       ├── ExerciceSection.jsx    # CRUD référentiel exercices
    │       ├── HealthSection.jsx      # Données de santé génériques
    │       └── AnalyticsSection.jsx   # Affichage des vues
    └── dashboard/
        └── DashboardPage.jsx          # Dashboard utilisateur
```

### Wrapper API — `src/api.js`

```js
export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",   // envoie le cookie JWT httpOnly
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data;
}
```

### Guards de rôle — `src/App.jsx`

```jsx
function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;
  if (!user)              return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

// Routes :
//   /           → Login
//   /admin      → Guard(role="admin") → AdminPage
//   /dashboard  → Guard(role="user")  → DashboardPage
```

### Section Profils — Attribution admin

```jsx
// Lier un profil à un compte
await api("PUT", `/utilisateurs/${profileId}/link`, {
  api_user_id: Number(selectedAccountId)
});

// Délier un profil
await api("DELETE", `/utilisateurs/${profileId}/link`);
```

---

## 13. Codes d'erreur

| Code | Signification | Cause fréquente |
|---|---|---|
| `400` | Bad Request | Champ manquant ou invalide dans le body |
| `401` | Unauthorized | Token absent, expiré ou révoqué |
| `403` | Forbidden | Opération d'écriture avec un rôle `user` |
| `404` | Not Found | Ressource (profil, aliment, activité) inexistante |
| `409` | Conflict | Email déjà utilisé · Compte déjà lié à un autre profil |
| `500` | Internal Server Error | Erreur PostgreSQL ou serveur |

**Format d'erreur standard :**
```json
{ "error": "Message décrivant le problème." }
```

---

## 14. Démarrage et configuration

### Variables d'environnement — `.env`

```env
PORT=3000
DATABASE_URL=postgresql://healthai:healthai@localhost:5432/healthai
JWT_SECRET=votre_secret_jwt_long_et_aleatoire_ici
NODE_ENV=development
```

### Commandes

```bash
# Développement
npm run dev              # API sur http://localhost:3000 (nodemon)
npm run dev:client       # Frontend Vite sur http://localhost:5173

# Production
npm run build            # Build React → public/dist/
node src/index.js        # Serveur Express (sert API + frontend)
```

### Promouvoir le premier admin

```bash
# Après inscription via POST /auth/register
psql $DATABASE_URL -c "UPDATE healthai.api_users SET role = 'admin' WHERE email = 'votre@email.com';"
```

### Flux d'attribution d'un profil (résumé)

```
1. Admin crée un compte
   POST /auth/users  { "email": "user@mail.com", "password": "...", "role": "user" }

2. Admin consulte les profils disponibles
   GET /utilisateurs/unlinked

3. Admin attribue un profil
   PUT /utilisateurs/1503960366/link  { "api_user_id": 5 }

4. L'utilisateur se connecte
   POST /auth/login  → GET /auth/me  →  { ..., "healthId": 1503960366 }

5. L'utilisateur accède à ses données (filtrées automatiquement)
   GET /activite_quotidienne
   GET /consommation
   GET /analytics/kpi
```

### Matrice d'autorisation complète

| Route | Public | User | Admin |
|---|:---:|:---:|:---:|
| `POST /auth/register` | ✓ | ✓ | ✓ |
| `POST /auth/login` | ✓ | ✓ | ✓ |
| `GET /auth/me` | ✗ | ✓ | ✓ |
| `GET /auth/users` | ✗ | ✗ | ✓ |
| `POST/PUT/DELETE /auth/users` | ✗ | ✗ | ✓ |
| `GET /utilisateurs` (propre) | ✗ | ✓ | ✓ |
| `GET /utilisateurs` (tous) | ✗ | ✗ | ✓ |
| `PUT /utilisateurs/:id/link` | ✗ | ✗ | ✓ |
| `POST/PUT/DELETE /utilisateurs` | ✗ | ✗ | ✓ |
| `GET /activite_quotidienne` (propre) | ✗ | ✓ | ✓ |
| `POST/PUT/DELETE /activite_quotidienne` | ✗ | ✗ | ✓ |
| `GET /aliment` | ✗ | ✓ | ✓ |
| `POST/PUT/DELETE /aliment` | ✗ | ✗ | ✓ |
| `GET /consommation` (propre) | ✗ | ✓ | ✓ |
| `POST/PUT/DELETE /consommation` | ✗ | ✗ | ✓ |
| `GET /exercice` | ✗ | ✓ | ✓ |
| `POST/PUT/DELETE /exercice` | ✗ | ✗ | ✓ |
| `GET /analytics/*` (propre) | ✗ | ✓ | ✓ |
| `GET /analytics/*` (tous) | ✗ | ✗ | ✓ |
