# Explication technique — HealthAI Coach

**Projet MSPR** — Hajar El-Gassir — Avril 2026  
Ce document explique en détail chaque fichier ajouté ou modifié lors de la dernière session de développement.

---

## Table des matières

1. [Docker — Build multi-stage](#1-docker--build-multi-stage)
2. [Gestion d'erreur backend](#2-gestion-derreur-backend)
3. [Tests unitaires](#3-tests-unitaires)
4. [Gestion d'erreur frontend](#4-gestion-derreur-frontend)
5. [Diagrammes Mermaid](#5-diagrammes-mermaid)
6. [Résumé visuel des fichiers](#6-résumé-visuel-des-fichiers)

---

## 1. Docker — Build multi-stage

### Problème résolu

Avant, le `Dockerfile` copiait simplement les sources Node.js. Si tu n'avais pas lancé `npm run build` localement au préalable, le dossier `public/dist/` (le frontend React compilé) n'existait pas → l'API démarrait mais sans interface.

### `APIMSPR-1/Dockerfile`

```dockerfile
# Stage 1 : construction du frontend React
FROM node:20-alpine AS frontend
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm ci          # installe les dépendances React
COPY client/ ./client/
RUN cd client && npm run build   # Vite compile → /app/public/dist/

# Stage 2 : API Node.js
FROM node:20-alpine AS api
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev            # dépendances de production uniquement
COPY src/ ./src/
COPY --from=frontend /app/public/dist ./public/dist  # copie le build React
EXPOSE 3000
CMD ["node", "src/index.js"]
```

**Pourquoi "multi-stage" ?**  
Docker construit en deux phases indépendantes. Le stage `frontend` construit React (avec tous ses outils de dev), puis on copie **uniquement le résultat** (fichiers HTML/JS/CSS) dans le stage final. L'image finale ne contient pas Node.js dev, Vite, ESLint, etc. → image plus légère et sécurisée.

**Résultat :** `docker compose up --build` fait tout seul — plus besoin de `npm run build` en local.

---

### `APIMSPR-1/.dockerignore`

Fonctionne comme `.gitignore` mais pour Docker. Il dit à Docker quels fichiers **ne pas copier** dans l'image lors du `COPY`.

```
node_modules        ← lourd, inutile (npm ci les réinstalle dans le conteneur)
client/node_modules ← idem pour le frontend
public/dist         ← sera recalculé par le build multi-stage
.env                ← contient des secrets — ne jamais embarquer dans une image
*.log               ← fichiers de log locaux
```

Sans ce fichier, Docker copierait tes `node_modules` locaux (des centaines de Mo) dans l'image, ce qui la ferait gonfler et créerait des conflits de plateforme (Windows vs Linux Alpine).

---

## 2. Gestion d'erreur backend

### `APIMSPR-1/src/middleware/errorHandler.js`

C'est un **middleware Express** spécial : il a 4 paramètres `(err, req, res, next)` — Express le reconnaît automatiquement comme gestionnaire d'erreur.

```js
export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;   // on attache le code HTTP à l'erreur
  }
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // En développement, affiche la stack trace dans la console
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[POST] /auth/login → 500`, err.stack);
  }

  res.status(status).json({ error: message });
}
```

**À quoi ça sert ?**  
Sans ça, si une erreur non gérée remonte dans Express, le serveur plante ou renvoie une réponse vide. Avec ce middleware, toute erreur non catchée retourne proprement un JSON `{ error: "..." }` avec le bon code HTTP.

**`AppError`** permet de lancer des erreurs métier depuis n'importe quelle route :

```js
throw new AppError("Ressource introuvable", 404);
// → le errorHandler intercepte et renvoie 404 { error: "Ressource introuvable" }
```

---

### Modifications de `APIMSPR-1/src/index.js`

Deux ajouts :

**1. Endpoint `/health`** (pour le healthcheck Docker) :

```js
app.get("/health", (_req, res) => res.json({ status: "ok" }));
```

Le `docker-compose.yml` teste régulièrement ce endpoint. Si l'API répond 200, Docker sait qu'elle est prête. Si elle ne répond pas, Docker la redémarre.

**2. Enregistrement du errorHandler en dernier** :

```js
app.use(errorHandler);   // doit être après toutes les routes
```

En Express, l'ordre des middlewares est crucial. Le gestionnaire d'erreur doit être le **dernier** enregistré pour attraper les erreurs de toutes les routes au-dessus.

---

## 3. Tests unitaires

### Pourquoi vitest ?

Le projet utilise `"type": "module"` dans `package.json` (ES modules). Jest a des difficultés avec ES modules. Vitest les supporte nativement, sans configuration complexe.

---

### `APIMSPR-1/vitest.config.js`

```js
export default defineConfig({
  test: {
    environment: "node",   // tests côté serveur (pas de DOM)
    globals: true,         // describe/it/expect disponibles sans import
    coverage: {
      provider: "v8",      // mesure la couverture de code
      reporter: ["text", "json", "html"],
      include: ["src/**/*.js"],
      exclude: ["src/__tests__/**"],
    },
  },
});
```

**Couverture de code** : avec `npm run test:coverage`, vitest génère un rapport qui montre quel pourcentage du code est exercé par les tests. Exemple : `src/middleware/auth.js 95% couvert`.

---

### Modifications de `APIMSPR-1/package.json`

Ajout des scripts de test et des dépendances de développement :

```json
"test":          "vitest run"            // lance tous les tests une fois
"test:watch":    "vitest"                // relance à chaque modification
"test:coverage": "vitest run --coverage" // tests + rapport de couverture

"vitest":               "^2.1.8"  // framework de test
"@vitest/coverage-v8":  "^2.1.8"  // mesure de couverture
"supertest":            "^7.0.0"  // simule des requêtes HTTP sans démarrer le serveur
```

---

### `APIMSPR-1/src/__tests__/middleware.test.js` — 12 tests

Teste les 3 fonctions de `src/middleware/auth.js` **en isolation**, sans base de données réelle.

**Principe du mock :** on remplace `pg` et `jsonwebtoken` par de fausses implémentations contrôlées :

```js
vi.mock("../db.js", () => ({
  pool: { query: vi.fn() }   // pool.query devient une fonction espion
}))
vi.mock("jsonwebtoken", async () => ({
  default: { verify: vi.fn() }
}))
```

**Tests couverts :**

| Fonction | Scénario testé |
|---|---|
| `authenticate` | Token valide → `next()` appelé, `req.user` attaché |
| `authenticate` | Aucun token → 401 |
| `authenticate` | Token dans header `Authorization: Bearer` → accepté |
| `authenticate` | Session expirée en base → 401 |
| `authenticate` | Token JWT invalide (mauvaise signature) → 403 |
| `authorizeWrite` | Admin + POST → `next()` |
| `authorizeWrite` | Admin + DELETE → `next()` |
| `authorizeWrite` | User + POST → 403 |
| `authorizeWrite` | User + PUT → 403 |
| `authorizeWrite` | User + GET → `next()` (lecture autorisée) |
| `authorizeRole` | Bon rôle → `next()` |
| `authorizeRole` | Mauvais rôle → 403 |

---

### `APIMSPR-1/src/__tests__/auth.test.js` — 9 tests

Teste les routes HTTP de `src/routes/auth.js` avec `supertest` (qui simule de vrais appels HTTP sans démarrer le serveur).

**Pattern utilisé :** chaque test configure ce que `pool.query` doit retourner (`mockResolvedValueOnce`), puis envoie une vraie requête HTTP et vérifie la réponse.

Exemple :

```js
it("retourne 409 si l'email est déjà utilisé", async () => {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // simule : email trouvé en BDD

  const res = await request(createApp())
    .post("/auth/register")
    .send({ email: "exists@test.com", password: "pass123" });

  expect(res.status).toBe(409);  // le code doit répondre 409 Conflict
});
```

| Route | Scénarios testés |
|---|---|
| `POST /auth/register` | Création OK (201), champ manquant (400), email dupliqué (409) |
| `POST /auth/login` | Connexion OK + cookie JWT (200), compte inexistant (401), mauvais mot de passe (401), champ manquant (400) |
| `GET /auth/me` | healthId retourné, healthId null si pas de profil lié |

---

### `APIMSPR-1/src/__tests__/activite.test.js` — 9 tests

Teste les routes de `src/routes/activite_quotidienne.js`. Particularité : le `POST /` ouvre une **transaction** avec `pool.connect()` → il faut mocker le client de transaction séparément.

```js
const mockClient = {
  query: vi.fn()
    .mockResolvedValueOnce(undefined)                  // BEGIN
    .mockResolvedValueOnce({ rows: [mockActivity] })   // INSERT activite_journaliere
    .mockResolvedValueOnce(undefined)                  // INSERT intensite VERY_ACTIVE
    .mockResolvedValueOnce(undefined)                  // INSERT intensite MODERATE
    .mockResolvedValueOnce(undefined)                  // INSERT intensite LIGHT
    .mockResolvedValueOnce(undefined)                  // INSERT intensite SEDENTARY
    .mockResolvedValueOnce(undefined),                 // COMMIT
  release: vi.fn(),
};
pool.connect.mockResolvedValueOnce(mockClient);
```

Le test vérifie que `ROLLBACK` est bien appelé si une insertion échoue — garantissant l'intégrité des données.

| Route | Scénarios testés |
|---|---|
| `GET /` | Toutes les activités pour admin, `[]` si user sans healthId, données filtrées par healthId, erreur DB → 500 |
| `GET /:user_id/:date` | Séance trouvée, null si inexistante |
| `POST /` | Création OK avec transaction (201), ROLLBACK sur erreur DB (500) |
| `DELETE /:id` | Suppression OK avec confirmation |

---

## 4. Gestion d'erreur frontend

### `APIMSPR-1/client/src/api.js`

**Avant** : en cas d'erreur, le message était soit `data.error` soit le texte générique `"Erreur serveur"`. Le composant n'avait aucune info sur le code HTTP.

**Après** :

```js
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status   // 401, 403, 404, 500, ou 0 (réseau)
  }
}

const ERROR_LABELS = {
  401: 'Non authentifié — veuillez vous reconnecter',
  403: 'Accès refusé',
  404: 'Ressource introuvable',
  409: 'Conflit — cette ressource existe déjà',
  500: 'Erreur serveur interne',
}
```

Le `catch` réseau est aussi géré :

```js
} catch {
  throw new ApiError('Impossible de joindre le serveur. Vérifiez votre connexion.', 0)
}
```

Avant, si le serveur était coupé, `fetch` lançait une `TypeError` brute et non traduite.

Les composants peuvent maintenant brancher sur le `status` pour agir différemment :

```js
} catch (err) {
  if (err.status === 401) navigate('/login')  // rediriger si session expirée
  setAlert(err.message)
}
```

---

### `APIMSPR-1/client/src/components/ErrorBoundary.jsx`

Les **React Error Boundaries** sont des composants de classe qui interceptent les erreurs JavaScript non gérées qui surviennent **pendant le rendu** d'un composant enfant — erreur que `try/catch` classique ne peut pas attraper dans JSX.

**Sans `ErrorBoundary`** : une erreur dans un composant fait planter toute l'application → écran blanc, rien affiché.

**Avec `ErrorBoundary`** : l'erreur est interceptée, un écran de repli s'affiche avec deux options :
- **Réessayer** : remet le state `hasError = false`, React retente le rendu
- **Retour à l'accueil** : redirige vers `/`

```jsx
static getDerivedStateFromError(error) {
  return { hasError: true, error }   // React appelle ça automatiquement
}

componentDidCatch(error, info) {
  console.error('[ErrorBoundary]', error, info.componentStack)  // log pour debug
}
```

---

### Modification de `APIMSPR-1/client/src/main.jsx`

```jsx
<ErrorBoundary>          // enveloppe TOUT, incluant AuthProvider et App
  <AuthProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </AuthProvider>
</ErrorBoundary>
```

Placé au niveau racine pour attraper n'importe quelle erreur dans n'importe quel composant de l'application.

---

## 5. Diagrammes Mermaid

Les fichiers `.mmd` sont du **texte brut** avec la syntaxe Mermaid — comme du code source pour des schémas. Ils s'affichent directement dans GitHub, GitLab, et l'extension VS Code "Mermaid Preview".

---

### `docs/diagrams/architecture.mmd`

**Type :** `graph TB` (top → bottom)

Montre toute la stack du projet : sources Kaggle → ETL Python → PostgreSQL → API Node.js → Frontend React → Docker Compose. Utile pour présenter l'architecture globale lors d'une soutenance ou dans un README.

---

### `docs/diagrams/er_diagram.mmd`

**Type :** `erDiagram`

Toutes les tables avec leurs colonnes (types et contraintes), et les relations avec cardinalités :
- `||--o{` = un à plusieurs (1..N)
- `|o--o|` = zéro ou un des deux côtés (0..1 — 0..1)
- `||--|{` = un à un-ou-plusieurs (obligatoire)

C'est la version visuelle du MLD.

---

### `docs/diagrams/auth_flow.mmd`

**Type :** `sequenceDiagram`

Montre chronologiquement les échanges entre Client, API, Middleware et PostgreSQL pour 5 scénarios :

| Scénario | Ce qui se passe |
|---|---|
| Connexion | login → bcrypt → jwt.sign → INSERT session → Set-Cookie |
| Requête protégée | authenticate → session check → attachHealthId → données filtrées |
| Session expirée | session absente en base → 401 |
| Écriture refusée | rôle user + méthode POST → 403 |
| Déconnexion | DELETE session → Clear-Cookie |

---

### `docs/diagrams/etl_flow.mmd`

**Type :** `flowchart TD`

Montre le chemin complet des données depuis les 3 CSV Kaggle bruts jusqu'aux tables PostgreSQL, en passant par chaque étape du pipeline Python (extract → transform → load → quality).

---

### `docs/diagrams/render.ps1`

Script PowerShell qui convertit tous les `.mmd` en images PNG grâce à `@mermaid-js/mermaid-cli`.

**Installation du prérequis :**
```powershell
npm install -g @mermaid-js/mermaid-cli
```

**Utilisation :**
```powershell
cd "C:\Users\elgas\OneDrive\Desktop\MSPR\MSPR pipeline\docs\diagrams"
.\render.ps1                         # génère tous les PNG dans output\
.\render.ps1 -File auth_flow.mmd     # génère un seul fichier
```

Les images PNG sont sauvegardées dans `docs/diagrams/output/`.

---

## 6. Résumé visuel des fichiers

```
APIMSPR-1/
├── Dockerfile                          ← multi-stage : build React PUIS API Node.js
├── .dockerignore                       ← exclut node_modules, .env, dist
├── vitest.config.js                    ← config des tests (coverage V8, env node)
├── package.json                        ← + scripts test + vitest + supertest
│
├── src/
│   ├── index.js                        ← + GET /health + errorHandler en dernier
│   ├── middleware/
│   │   └── errorHandler.js             ← AppError + handler centralisé Express
│   └── __tests__/
│       ├── middleware.test.js          ← 12 tests (authenticate, authorizeWrite, authorizeRole)
│       ├── auth.test.js                ← 9 tests (register, login, /me)
│       └── activite.test.js           ← 9 tests (GET/POST/DELETE + transaction)
│
└── client/src/
    ├── api.js                          ← ApiError avec status HTTP + labels français + catch réseau
    ├── main.jsx                        ← + <ErrorBoundary> au niveau racine
    └── components/
        └── ErrorBoundary.jsx           ← écran de repli + bouton réessayer

docs/diagrams/
├── architecture.mmd                    ← stack complète full-stack + Docker
├── er_diagram.mmd                      ← modèle entité-relation avec types et cardinalités
├── auth_flow.mmd                       ← flux JWT (5 scénarios)
├── etl_flow.mmd                        ← pipeline ETL → PostgreSQL
└── render.ps1                          ← génère les PNG via mmdc
```

---

## Commandes pour lancer les tests

```powershell
cd "C:\Users\elgas\OneDrive\Desktop\MSPR\MSPR pipeline\APIMSPR-1"

# Installer les dépendances (dont vitest et supertest)
npm install

# Lancer tous les tests une fois
npm test

# Lancer les tests en mode watch (relance à chaque modification)
npm run test:watch

# Lancer les tests avec rapport de couverture de code
npm run test:coverage
```
