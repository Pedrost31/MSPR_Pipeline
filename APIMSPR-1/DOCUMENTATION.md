# Documentation API — HealthAI


**crtl+ shift+ v pour un bon affichage**

**Stack :** Node.js · Express · PostgreSQL · JWT · React  
**Base de données :** `postgresql://localhost:5432/mspr1` — schéma `healthai`  
**Port :** `3000`

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Base de données](#2-base-de-données)
3. [Authentification](#3-authentification)
4. [Middleware](#4-middleware)
5. [Routes — Utilisateurs](#5-routes--utilisateurs)
6. [Routes — Données de santé](#6-routes--données-de-santé)
7. [Routes — Référentiel](#7-routes--référentiel)
8. [Import CSV](#8-import-csv)
9. [Frontend React](#9-frontend-react)
10. [Démarrage](#10-démarrage)

---

## 1. Architecture générale

```
APIMSPR-1/
├── src/
│   ├── index.js                  # Point d'entrée Express
│   ├── db.js                     # Pool de connexion PostgreSQL
│   ├── middleware/
│   │   ├── auth.js               # JWT + contrôle des rôles
│   │   └── healthId.js           # Résolution du profil santé
│   ├── routes/
│   │   ├── auth.js               # Authentification & gestion des comptes
│   │   ├── utilisateurs.js       # Profils santé
│   │   ├── activite_quotidienne.js
│   │   ├── sommeil.js
│   │   ├── bien_etre.js
│   │   ├── consommation_alimentaire.js
│   │   ├── aliment.js
│   │   └── exercice.js
│   ├── scripts/
│   │   └── importCSV.js          # Script d'import des données CSV
│   └── db/
│       ├── create_api_users.sql
│       ├── create_sessions.sql
│       └── link_users.sql
├── client/                       # Frontend React (Vite)
└── public/dist/                  # Build React servi par Express
```

### Point d'entrée — `src/index.js`

```js
// Routes publiques
app.use("/auth", authRoutes);

// Routes protégées — lecture pour tous, écriture admin uniquement
app.use("/utilisateurs",          authenticate, authorizeWrite, utilisateursRoutes);
app.use("/aliment",               authenticate, authorizeWrite, alimentRoutes);
app.use("/exercice",              authenticate, authorizeWrite, exerciceRoutes);

// Routes données de santé — filtrées par profil pour les non-admins
app.use("/sommeil",               authenticate, authorizeWrite, attachHealthId, sommeiltRoutes);
app.use("/bien_etre",             authenticate, authorizeWrite, attachHealthId, bienEtreRoutes);
app.use("/consommation",          authenticate, authorizeWrite, attachHealthId, consommation_alimentaireRoutes);
app.use("/activite_quotidienne",  authenticate, authorizeWrite, attachHealthId, activiteQuotidienneRoutes);
```

---

## 2. Base de données

### Connexion — `src/db.js`

```js
import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.query("SET search_path TO healthai");
```

Le `search_path` est forcé à `healthai` à la connexion. Toutes les requêtes utilisent néanmoins le préfixe explicite `healthai.table` pour la clarté.

### Schéma des tables

#### `healthai.api_users` — Comptes d'authentification

```sql
CREATE TABLE IF NOT EXISTS healthai.api_users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMP DEFAULT NOW()
);
```

#### `healthai.sessions` — Sessions JWT

```sql
CREATE TABLE IF NOT EXISTS healthai.sessions (
    id         SERIAL PRIMARY KEY,
    user_id    INT REFERENCES healthai.api_users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);
```

#### `healthai.utilisateur` — Profils santé

| Colonne | Type | Description |
|---|---|---|
| `id` | bigint PK | ID Fitbit/source |
| `age` | varchar(20) | Tranche d'âge (ex: "21 to 35") |
| `gender` | varchar | Genre |
| `objective` | varchar | Objectif santé |
| `dietary_constraint` | varchar | Contrainte alimentaire |
| `target_calories_daily` | integer | Calories cibles/jour |
| `preferred_exercise_type` | varchar | Type d'exercice préféré |
| `fitness_level` | varchar | Niveau de forme |
| `bmi_range` | varchar(50) | Catégorie IMC (ex: "Poids normal") |
| `api_user_id` | integer FK | Compte associé (`api_users.id`) |

> **Note :** `api_user_id` a été ajouté via migration (`link_users.sql`). `age` et `bmi_range` ont été convertis de `integer` à `varchar` lors de l'import CSV pour accepter les valeurs textuelles du dataset.

#### `healthai.activite_quotidienne`

| Colonne | Type |
|---|---|
| `id` | bigint FK → utilisateur |
| `activity_date` | date |
| `total_steps` | integer |
| `total_distance` | double |
| `calories` | integer |
| `very/fairly/lightly_active_minutes` | integer |
| `sedentary_minutes` | integer |
| `activity_score` | integer |
| `health_score` | double |
| `activity_trend` | varchar |
| `goal_progress_pct` | double |
| *(+ autres colonnes dérivées)* | |

#### `healthai.sommeil`

| Colonne | Type |
|---|---|
| `id` | bigint FK → utilisateur |
| `activity_date` | date |
| `total_minutes_asleep` | integer |
| `total_minutes` | integer |
| `sleep_efficiency_pct` | double |
| `sleep_hours` | integer |
| `sleep_quality` | varchar |

#### `healthai.bien_etre`

| Colonne | Type |
|---|---|
| `id` | bigint FK → utilisateur |
| `activity_date` | date |
| `fruits_veggies`, `daily_stress`, `flow`, ... | integer |
| `work_life_balance_score` | double |
| `wellbeing_score`, `social_score`, `productivity_score` | double |
| `stress_level` | varchar |

#### `healthai.aliment`

| Colonne | Type |
|---|---|
| `food_name` | varchar PK |
| `category` | varchar |
| `calories_per_100g` | double |
| `protein_g`, `carbs_g`, `fat_g`, `fiber_g` | double |

#### `healthai.exercice`

| Colonne | Type |
|---|---|
| `exercise_name` | varchar PK |
| `category`, `difficulty`, `equipment` | varchar |
| `calories_per_hour` | integer |
| `muscle_groups`, `description` | varchar |

---

## 3. Authentification

Basée sur **JWT** stocké dans un cookie `httpOnly`. Chaque session est également enregistrée en base pour permettre la révocation.

### `POST /auth/register`

Crée un compte utilisateur avec le rôle `user`.

```js
const hash = await bcrypt.hash(password, 10);
await pool.query(
  "INSERT INTO healthai.api_users (email, password_hash, role) VALUES ($1, $2, 'user')",
  [email, hash]
);
```

**Body :** `{ email, password }`  
**Réponse :** `201 { message, user: { id, email, role } }`

---

### `POST /auth/login`

Vérifie les credentials, crée un JWT signé de 24h, l'enregistre en session et le pose en cookie.

```js
const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "24h" }
);

await pool.query(
  "INSERT INTO healthai.sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
  [user.id, token, expiresAt]
);

res.cookie("token", token, { httpOnly: true, sameSite: "strict", maxAge: 86400000 });
```

**Body :** `{ email, password }`  
**Réponse :** `200 { role, email, id }`

---

### `POST /auth/logout`

Supprime la session en base et efface le cookie.

```js
await pool.query("DELETE FROM healthai.sessions WHERE token = $1", [req.token]);
res.clearCookie("token");
```

---

### `GET /auth/me`

Retourne les infos du compte connecté **et** l'ID du profil santé lié.

```js
const r = await pool.query(
  "SELECT id FROM healthai.utilisateur WHERE api_user_id = $1",
  [req.user.id]
);
res.json({
  id: req.user.id,
  email: req.user.email,
  role: req.user.role,
  healthId: r.rows[0]?.id ?? null,
});
```

**Réponse :** `200 { id, email, role, healthId }`

---

### Gestion des comptes (admin uniquement)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/auth/users` | Liste tous les comptes |
| `POST` | `/auth/users` | Crée un compte avec rôle choisi |
| `PUT` | `/auth/users/:id` | Modifie l'email |
| `PATCH` | `/auth/users/:id/role` | Change le rôle (`user` ↔ `admin`) |
| `DELETE` | `/auth/users/:id` | Supprime un compte |
| `GET` | `/auth/stats` | Nombre de lignes par table |

---

## 4. Middleware

### `authenticate` — `src/middleware/auth.js`

Vérifie le JWT (cookie ou header `Authorization: Bearer`) et contrôle que la session est active en base.

```js
export async function authenticate(req, res, next) {
  const token = req.cookies?.token ||
    req.headers["authorization"]?.slice(7);

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const session = await pool.query(
    "SELECT id FROM healthai.sessions WHERE token = $1 AND expires_at > NOW()",
    [token]
  );

  if (session.rows.length === 0)
    return res.status(401).json({ error: "Session expired or revoked." });

  req.user = decoded;  // { id, email, role }
  req.token = token;
  next();
}
```

---

### `authorizeWrite` — `src/middleware/auth.js`

Bloque les méthodes d'écriture (`POST`, `PUT`, `PATCH`, `DELETE`) pour les non-admins.

```js
export function authorizeWrite(req, res, next) {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  if (writeMethods.includes(req.method) && req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required for write operations." });
  }
  next();
}
```

---

### `attachHealthId` — `src/middleware/healthId.js`

Résout l'ID du profil santé (`utilisateur.id`) associé au compte connecté. Appliqué sur toutes les routes de données de santé.

```js
export async function attachHealthId(req, res, next) {
  if (req.user.role === "admin") { next(); return; }

  const r = await pool.query(
    "SELECT id FROM healthai.utilisateur WHERE api_user_id = $1",
    [req.user.id]
  );
  req.healthId = r.rows[0]?.id ?? null;
  next();
}
```

> Si `req.healthId` est `null` (profil non encore attribué), les routes de données retournent un tableau vide `[]`.

---

## 5. Routes — Utilisateurs

### `GET /utilisateurs`

- **Admin :** tous les profils avec le compte associé via `LEFT JOIN`
- **User :** uniquement son propre profil

```js
// Admin
SELECT u.*, a.email AS account_email, a.role AS account_role
FROM healthai.utilisateur u
LEFT JOIN healthai.api_users a ON a.id = u.api_user_id
ORDER BY u.id

// User
SELECT * FROM healthai.utilisateur WHERE api_user_id = $1
```

---

### `GET /utilisateurs/unlinked`

Admin uniquement. Retourne les profils sans compte associé.

```js
SELECT * FROM healthai.utilisateur WHERE api_user_id IS NULL ORDER BY id
```

---

### `PUT /utilisateurs/:id/link`

Admin uniquement. Attribue un compte (`api_user_id`) à un profil santé.

```js
// Body : { api_user_id: 5 }

// Vérifie que le compte existe
// Vérifie qu'il n'est pas déjà lié à un autre profil
await pool.query(
  "UPDATE healthai.utilisateur SET api_user_id = $1 WHERE id = $2 RETURNING *",
  [api_user_id, id]
);
```

**Réponse :** `200 { message, utilisateur }`  
**Erreurs :** `404` compte introuvable · `409` compte déjà utilisé

---

### `DELETE /utilisateurs/:id/link`

Admin uniquement. Retire le lien entre un profil et son compte.

```js
await pool.query(
  "UPDATE healthai.utilisateur SET api_user_id = NULL WHERE id = $1 RETURNING *",
  [id]
);
```

---

### `POST /utilisateurs`

Crée un nouveau profil santé. Pour les non-admins, `api_user_id` est automatiquement défini sur leur propre compte.

```js
const api_user_id = req.user.role !== "admin"
  ? req.user.id
  : (req.body.api_user_id ?? null);

await pool.query(
  `INSERT INTO healthai.utilisateur
   (id, age, gender, objective, dietary_constrant, target_calories_daily,
    preferred_exercise_type, fitness_level, bmi_range, api_user_id)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
  [id, age, gender, objective, dietary_constrant,
   target_calories_daily, preferred_exercise_type,
   fitness_level, bmi_range, api_user_id]
);
```

---

## 6. Routes — Données de santé

Toutes ces routes appliquent le même pattern de filtrage :

```js
// Admin → toutes les données
const query = req.user.role === 'admin'
  ? 'SELECT * FROM healthai.{table}'
  : 'SELECT * FROM healthai.{table} WHERE id = $1';
const params = req.user.role === 'admin' ? [] : [req.healthId];
```

### Activité quotidienne — `/activite_quotidienne`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Liste des activités |
| `GET` | `/:id/:date` | Une activité par ID + date |
| `POST` | `/` | Créer une activité (admin) |
| `PUT` | `/:id/:date` | Modifier (admin) |
| `DELETE` | `/:id/:date` | Supprimer (admin) |

**Exemple POST :**
```js
INSERT INTO healthai.activite_quotidienne
  (id, activity_date, total_steps, total_distance, tracker_distance,
   very_active_distance, moderately_active_distance, light_active_distance,
   very_active_minutes, fairly_active_minutes, lightly_active_minutes,
   sedentary_minutes, calories, activity_score, intense_activity_ratio,
   sedentary_ratio_pct, total_active_minutes, steps_7d_avg,
   activity_trend, health_score, goal_progress_pct)
VALUES ($1,$2,...,$21) RETURNING *
```

---

### Sommeil — `/sommeil`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Liste des enregistrements |
| `GET` | `/:id/:date` | Un enregistrement |
| `POST` | `/` | Créer (admin) |
| `PUT` | `/:id/:date` | Modifier (admin) |
| `DELETE` | `/:id/:date` | Supprimer (admin) |

**Exemple POST :**
```js
INSERT INTO healthai.sommeil
  (id, activity_date, total_minutes_asleep, total_minutes,
   sleep_efficiency_pct, sleep_hours, sleep_quality)
VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *
```

---

### Bien-être — `/bien_etre`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Liste |
| `GET` | `/:id/:date` | Un enregistrement |
| `POST` | `/` | Créer (admin) — colonnes dynamiques |
| `PUT` | `/:id/:date` | Modifier (admin) |
| `DELETE` | `/:id/:date` | Supprimer (admin) |

Le POST accepte un body dynamique :

```js
const keys   = Object.keys(data);
const values = Object.values(data);
const query  = `INSERT INTO healthai.bien_etre (${keys.join(',')})
                VALUES (${keys.map((_,i) => '$'+(i+1)).join(',')}) RETURNING *`;
```

---

### Consommation alimentaire — `/consommation`

Clé composite : `(id, food_name, consumption_date)`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Liste |
| `GET` | `/:id/:food_name/:date` | Un enregistrement |
| `POST` | `/` | Créer (admin) |
| `PUT` | `/:id/:food_name/:date` | Modifier (admin) |
| `DELETE` | `/:id/:food_name/:date` | Supprimer (admin) |

---

## 7. Routes — Référentiel

Ces routes sont accessibles à tous les utilisateurs authentifiés en lecture. Écriture admin uniquement.

### Aliments — `/aliment`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Tous les aliments |
| `GET` | `/:food_name` | Un aliment |
| `POST` | `/` | Créer (admin) |
| `PUT` | `/:food_name` | Modifier (admin) |
| `DELETE` | `/:food_name` | Supprimer (admin) |

**Colonnes :** `food_name`, `category`, `calories_per_100g`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`

---

### Exercices — `/exercice`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/` | Tous les exercices |
| `GET` | `/:exercise_name` | Un exercice |
| `POST` | `/` | Créer (admin) |
| `PUT` | `/:exercise_name` | Modifier (admin) |
| `DELETE` | `/:exercise_name` | Supprimer (admin) |

**Colonnes :** `exercise_name`, `category`, `difficulty`, `equipment`, `calories_per_hour`, `muscle_groups`, `description`

---

## 8. Import CSV

### Script — `src/scripts/importCSV.js`

Importe les données du fichier `merged.csv` (940 lignes, 33 utilisateurs uniques) dans les 4 tables de santé.

**Utilisation :**
```bash
node src/scripts/importCSV.js /chemin/vers/merged.csv
```

**Fonctionnement :**

```js
// 1. Parser CSV maison (gère les guillemets)
function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = [];
    let cur = '', inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    values.push(cur.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

// 2. Helpers de conversion de types
const num = v => v === '' ? null : Number(v);
const int = v => v === '' ? null : Math.round(Number(v));
const str = v => v === '' ? null : String(v).trim();
```

**Ordre d'insertion (respect des FK) :**

1. `utilisateur` — 1 ligne par `Id` unique (dédupliqué avec `Set`)
2. `activite_quotidienne` — 1 ligne par ligne CSV
3. `sommeil` — 1 ligne par ligne CSV (ignorée si `TotalMinutesAsleep` vide)
4. `bien_etre` — 1 ligne par ligne CSV

Tout est dans une **transaction** : si une insertion échoue, tout est annulé.

```js
await client.query('BEGIN');
// ... toutes les insertions ...
await client.query('COMMIT');
// En cas d'erreur :
await client.query('ROLLBACK');
```

Chaque `INSERT` utilise `ON CONFLICT DO NOTHING` pour être idempotent (peut être relancé sans créer de doublons).

**Adaptations de schéma effectuées avant l'import :**

```sql
-- Suppression de la contrainte CHECK incompatible avec les tranches d'âge textuelles
ALTER TABLE healthai.utilisateur DROP CONSTRAINT utilisateur_age_check;

-- Conversion de integer → varchar pour les champs textuels du CSV
ALTER TABLE healthai.utilisateur ALTER COLUMN age TYPE varchar(20) USING age::text;
ALTER TABLE healthai.utilisateur ALTER COLUMN bmi_range TYPE varchar(50) USING bmi_range::text;
```

**Résultat de l'import :**

| Table | Lignes insérées |
|---|---|
| `utilisateur` | 33 |
| `activite_quotidienne` | 940 |
| `sommeil` | 940 |
| `bien_etre` | 940 |

---

## 9. Frontend React

**Stack :** React 18 · Vite · React Router · CSS variables

### Structure

```
client/src/
├── main.jsx              # AuthProvider + ToastProvider
├── App.jsx               # Routeur + Guards de rôle
├── api.js                # Wrapper fetch
├── context/
│   ├── AuthContext.jsx   # État d'authentification global
│   └── ToastContext.jsx  # Notifications
├── components/
│   └── Modal.jsx         # Modal réutilisable
└── pages/
    ├── Login.jsx
    ├── admin/
    │   ├── AdminPage.jsx
    │   └── sections/
    │       ├── DashboardSection.jsx
    │       ├── UsersSection.jsx
    │       ├── ProfilsSection.jsx   ← gestion des attributions
    │       ├── AlimentSection.jsx
    │       ├── ExerciceSection.jsx
    │       └── HealthSection.jsx    ← section générique
    └── dashboard/
        └── DashboardPage.jsx
```

### Wrapper API — `src/api.js`

```js
export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   // envoie le cookie JWT
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}
```

### Guards de rôle — `src/App.jsx`

```jsx
function Guard({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>;
  if (!user)             return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}
```

### Section Profils — `ProfilsSection.jsx`

Interface admin pour attribuer les profils santé importés aux comptes utilisateurs.

```jsx
// Lier un profil à un compte
const confirmLink = async () => {
  await api('PUT', `/utilisateurs/${linkTarget.id}/link`, {
    api_user_id: Number(selectedAccountId)
  });
};

// Délier un profil
const confirmUnlink = async () => {
  await api('DELETE', `/utilisateurs/${unlinkTarget.id}/link`);
};
```

Fonctionnalités :
- Tableau de tous les profils avec badge **"Non lié"** (rouge) ou **email du compte** (vert)
- Compteurs en temps réel : `X non liés / X liés`
- Modal d'attribution avec liste des comptes disponibles (comptes déjà utilisés grisés)
- Modal de confirmation pour délier

---

## 10. Démarrage

### Variables d'environnement — `.env`

```env
DATABASE_URL=postgresql://postgres:MotDePasse@localhost:5432/mspr1
JWT_SECRET=votre_secret_jwt
NODE_ENV=development
PORT=3000
```

### Lancer l'API

```bash
npm run dev          # API sur http://localhost:3000
npm run dev:client   # Frontend Vite sur http://localhost:5173
npm run build        # Build React → public/dist (servi par Express)
```

### Importer les données CSV

```bash
node src/scripts/importCSV.js /chemin/vers/merged.csv
```

### Accorder le rôle admin à un compte

```sql
UPDATE healthai.api_users SET role = 'admin' WHERE email = 'ton@email.com';
```

### Flux complet d'attribution d'un profil

```
1. Admin crée un compte
   POST /auth/users  { "email": "user@mail.com", "password": "...", "role": "user" }

2. Admin consulte les profils sans compte
   GET /utilisateurs/unlinked

3. Admin attribue un profil au compte
   PUT /utilisateurs/1503960366/link  { "api_user_id": 5 }

4. L'utilisateur se connecte → GET /auth/me retourne son healthId
   { "id": 5, "email": "user@mail.com", "role": "user", "healthId": 1503960366 }

5. L'utilisateur accède à ses données
   GET /sommeil  →  données filtrées automatiquement sur son healthId
   GET /activite_quotidienne
   GET /bien_etre
```
