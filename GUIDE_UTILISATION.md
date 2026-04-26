# Guide d'utilisation — HealthAI Coach

**Projet MSPR** — Stack : Python ETL · PostgreSQL · Node.js/Express · React 18  
**Auteur :** Hajar El-Gassir  
**Date :** Avril 2026

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Prérequis](#2-prérequis)
3. [Installation et démarrage rapide (Docker)](#3-installation-et-démarrage-rapide-docker)
4. [Installation manuelle (sans Docker)](#4-installation-manuelle-sans-docker)
5. [Premiers pas — Connexion et rôles](#5-premiers-pas--connexion-et-rôles)
6. [Interface administrateur](#6-interface-administrateur)
7. [Interface utilisateur](#7-interface-utilisateur)
8. [API REST — Utilisation directe](#8-api-rest--utilisation-directe)
9. [Pipeline ETL](#9-pipeline-etl)
10. [Variables d'environnement](#10-variables-denvironnement)
11. [Résolution des problèmes courants](#11-résolution-des-problèmes-courants)

---

## 1. Présentation du projet

**HealthAI Coach** est une plateforme de suivi santé et fitness composée de trois briques :

```
┌──────────────────┐    CSV     ┌──────────────────┐    SQL    ┌───────────────────┐
│  Pipeline ETL    │ ─────────► │   PostgreSQL 15   │ ────────► │  API REST +        │
│  (Python/pandas) │            │  schéma healthai  │           │  Frontend React    │
└──────────────────┘            └──────────────────┘           └───────────────────┘
  3 datasets Kaggle               10 tables · 6 vues            Node.js/Express · JWT
```

**Fonctionnalités principales :**
- Suivi des activités physiques journalières avec décomposition par niveau d'intensité
- Suivi nutritionnel (591 aliments référencés, log des repas)
- Tableau de bord analytique (bilan calorique, KPI, macronutriments)
- Authentification JWT avec gestion des rôles (admin / user)
- Interface d'administration complète

---

## 2. Prérequis

### Avec Docker (recommandé)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24
- Docker Compose ≥ 2.20

### Sans Docker
- Node.js ≥ 18 avec npm
- Python ≥ 3.9 avec pip
- PostgreSQL ≥ 15

---

## 3. Installation et démarrage rapide (Docker)

### 3.1 Cloner et configurer

```bash
# Cloner le dépôt
git clone <url-du-repo>
cd "MSPR pipeline"

# (Optionnel) Personnaliser le secret JWT
export JWT_SECRET="votre_secret_tres_long_et_aleatoire"
```

### 3.2 Construire le frontend React

Le build React doit être effectué **avant** de lancer Docker (Express sert les fichiers statiques) :

```bash
cd APIMSPR-1
npm install
npm run build      # génère APIMSPR-1/public/dist/
cd ..
```

### 3.3 Lancer la stack complète

```bash
docker compose up --build
```

**Ordre d'exécution automatique :**
1. `postgres` démarre et initialise le schéma SQL
2. `pipeline` exécute l'ETL et génère les CSV dans `MSPR_Pipeline/data/processed/`
3. `seed` charge les CSV dans PostgreSQL (attend la fin du pipeline)
4. `api` démarre l'API Node.js (attend que PostgreSQL soit prêt)

**L'application est accessible sur : [http://localhost:3000](http://localhost:3000)**

### 3.4 Démarrage partiel (base déjà peuplée)

Si les données sont déjà chargées, lancer uniquement l'API :

```bash
docker compose up postgres api
```

### 3.5 Arrêter la stack

```bash
docker compose down          # Arrêter sans supprimer les données
docker compose down -v       # Arrêter ET supprimer les volumes (reset complet)
```

---

## 4. Installation manuelle (sans Docker)

### 4.1 Base de données PostgreSQL

```sql
-- Créer la base et le schéma
CREATE DATABASE healthai;
\c healthai
CREATE SCHEMA healthai;

-- Exécuter les scripts d'initialisation dans l'ordre
\i MSPR_Pipeline/database/init.sql
\i MSPR_Pipeline/database/api_schema.sql
```

### 4.2 Pipeline ETL

```bash
cd MSPR_Pipeline

# Créer un environnement virtuel
python -m venv venv
source venv/bin/activate       # Linux/Mac
# ou : venv\Scripts\activate   # Windows

# Installer les dépendances
pip install -r requirements.txt

# Lancer le pipeline (génère les CSV dans data/processed/)
python scripts/run_pipeline.py

# Charger les CSV dans PostgreSQL
POSTGRES_HOST=localhost \
POSTGRES_PORT=5432 \
POSTGRES_DB=healthai \
POSTGRES_USER=healthai \
POSTGRES_PASSWORD=healthai \
python database/seed.py --truncate
```

### 4.3 API Node.js

```bash
cd APIMSPR-1

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env    # ou éditer .env directement
```

Contenu du fichier `.env` :

```env
PORT=3000
DATABASE_URL=postgresql://healthai:healthai@localhost:5432/healthai
JWT_SECRET=votre_secret_jwt_long_et_aleatoire
NODE_ENV=development
```

```bash
# Lancer l'API en développement (rechargement automatique)
npm run dev

# Lancer le frontend en développement (port 5173)
npm run dev:client
```

### 4.4 Build production du frontend

```bash
cd APIMSPR-1
npm run build      # Génère public/dist/ — servi par Express sur le port 3000
```

---

## 5. Premiers pas — Connexion et rôles

### 5.1 Créer le premier compte administrateur

Via SQL (à faire une seule fois après le démarrage) :

```bash
# Se connecter à PostgreSQL (Docker)
docker exec -it healthai-postgres psql -U healthai -d healthai

# Créer un admin (le mot de passe sera haché via l'API, ici on s'inscrit d'abord)
```

**Étape 1 — S'inscrire via l'API :**

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@healthai.fr", "password": "MonMotDePasse123!"}'
```

**Étape 2 — Promouvoir en admin via SQL :**

```sql
UPDATE healthai.api_users
SET role = 'admin'
WHERE email = 'admin@healthai.fr';
```

### 5.2 Se connecter

**Via l'interface web :** Ouvrir [http://localhost:3000](http://localhost:3000) et renseigner email + mot de passe.

**Via l'API :**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "admin@healthai.fr", "password": "MonMotDePasse123!"}'
```

Réponse :
```json
{
  "role": "admin",
  "email": "admin@healthai.fr",
  "id": 1
}
```

### 5.3 Rôles et permissions

| Action | Admin | Utilisateur |
|---|:---:|:---:|
| Voir son propre profil | ✓ | ✓ |
| Voir tous les profils | ✓ | ✗ |
| Créer / modifier / supprimer des données | ✓ | ✗ |
| Gérer les comptes utilisateurs | ✓ | ✗ |
| Lier un profil santé à un compte | ✓ | ✗ |
| Voir ses propres données analytiques | ✓ | ✓ |
| Voir toutes les données analytiques | ✓ | ✗ |

---

## 6. Interface administrateur

Accessible sur `/admin` après connexion avec un compte `admin`.

### 6.1 Tableau de bord (Dashboard)

Vue d'ensemble avec les compteurs de lignes par table.

### 6.2 Gestion des comptes (Users)

Permet de :
- Créer un nouveau compte (email + mot de passe + rôle)
- Modifier l'email d'un compte
- Changer le rôle (`user` ↔ `admin`)
- Supprimer un compte

### 6.3 Attribution des profils (Profils)

**Flux d'attribution d'un profil santé :**

```
1. Les profils santé sont importés depuis le pipeline ETL
   → 33 profils disponibles (issus des 973 membres de gym Kaggle)

2. L'admin voit le tableau des profils :
   - Badge rouge  "Non lié" = profil sans compte associé
   - Badge vert   "email@..."  = profil attribué à un compte

3. Cliquer sur "Lier" → choisir un compte dans la liste
   → Le profil est maintenant associé au compte

4. L'utilisateur peut se connecter et voir ses données
```

### 6.4 Référentiel alimentaire (Aliments)

Ajouter, modifier ou supprimer des aliments dans le référentiel nutritionnel (591 entrées initiales).

### 6.5 Référentiel exercices (Exercices)

Gérer les exercices physiques de référence (catégorie, difficulté, équipement, calories/heure).

### 6.6 Analytiques (Analytics)

Consultation des 6 vues analytiques :
- **Profil** : Agrégats par utilisateur (nb séances, calories moyennes)
- **Résumé journalier** : Activité + nutrition par jour
- **Bilan calorique** : Calories dépensées vs consommées
- **Apport nutritionnel** : Détail macronutriments par repas
- **Intensité** : Répartition des minutes par niveau d'effort
- **KPI Dashboard** : Indicateurs clés globaux

---

## 7. Interface utilisateur

Accessible sur `/dashboard` après connexion avec un compte `user` **auquel un profil a été attribué**.

> **Important :** Un compte sans profil lié verra des données vides.  
> Demander à l'administrateur de lier votre profil via la section Profils.

### 7.1 Tableau de bord personnel

Affiche les données filtrées sur votre profil :
- Historique des activités
- Journaux alimentaires
- Résumé nutritionnel
- Bilan calorique

---

## 8. API REST — Utilisation directe

Base URL : `http://localhost:3000`  
Authentification : Cookie `token` (httpOnly) ou header `Authorization: Bearer <jwt>`

### 8.1 Authentification

```bash
# Inscription
curl -X POST /auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'

# Connexion (retourne un cookie JWT)
curl -X POST /auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "password": "password123"}'

# Vérifier sa session
curl -X GET /auth/me -b cookies.txt

# Déconnexion
curl -X POST /auth/logout -b cookies.txt
```

### 8.2 Activités physiques

```bash
# Lister les activités (filtré sur votre profil si user)
curl -X GET /activite_quotidienne -b cookies.txt

# Créer une activité (admin)
curl -X POST /activite_quotidienne \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
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
  }'

# Supprimer une activité (admin)
curl -X DELETE /activite_quotidienne/42 -b cookies.txt
```

### 8.3 Alimentation

```bash
# Voir le référentiel alimentaire
curl -X GET /aliment -b cookies.txt

# Chercher un aliment
curl -X GET "/aliment/Apple" -b cookies.txt

# Enregistrer une consommation (admin)
curl -X POST /consommation \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "user_id": 1503960366,
    "nutrition_id": 42,
    "date_consommation": "2026-04-26",
    "repas_type": "BREAKFAST",
    "quantite_grammes": 200
  }'
```

### 8.4 Analytiques

```bash
# KPI globaux
curl -X GET /analytics/kpi -b cookies.txt

# Bilan calorique
curl -X GET /analytics/bilan -b cookies.txt

# Résumé journalier
curl -X GET /analytics/resume -b cookies.txt
```

---

## 9. Pipeline ETL

### 9.1 Structure des données sources

Les 3 datasets CSV originaux sont dans `MSPR_Pipeline/data/raw/` :

| Fichier | Description | Lignes |
|---|---|:---:|
| `gym_members_exercise_tracking.csv` | Profils et métriques sportives | 973 |
| `Activity.csv` | Journaux d'activité quotidienne | 940 |
| `daily_food_nutrition_dataset.csv` | Référentiel nutritionnel | 591 |

### 9.2 Lancer le pipeline manuellement

```bash
cd MSPR_Pipeline

# Pipeline complet
python scripts/run_pipeline.py

# Vérification de la qualité des CSV
python scripts/check_csv_quality.py
```

### 9.3 Fichiers générés

Les CSV propres sont écrits dans `MSPR_Pipeline/data/processed/` :

| Fichier | Description | Lignes |
|---|---|:---:|
| `users_clean.csv` | Tous les profils nettoyés | 973 |
| `activity_clean.csv` | Activités nettoyées | 940 |
| `nutrition_clean.csv` | Référentiel nutritionnel | 591 |
| `users_for_merge.csv` | 33 profils alignés sur les activités | 33 |
| `merged_analytics_mspr_20.csv` | Table analytique finale | 940 |
| `consommation_alimentaire.csv` | Logs alimentaires simulés | 2 856 |

### 9.4 Rapport de qualité

Le fichier `MSPR_Pipeline/logs/csv_quality_report.csv` contient les métriques de qualité par colonne (% valeurs manquantes, % zéros, unicité, doublons).

---

## 10. Variables d'environnement

### API (`APIMSPR-1/.env`)

| Variable | Exemple | Description |
|---|---|---|
| `PORT` | `3000` | Port d'écoute de l'API |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | URL de connexion PostgreSQL |
| `JWT_SECRET` | `une_longue_chaine_aleatoire` | Secret de signature des tokens JWT |
| `NODE_ENV` | `development` ou `production` | Environnement d'exécution |

### Docker Compose (racine)

| Variable | Défaut | Description |
|---|---|---|
| `JWT_SECRET` | `change_me_in_production` | À surcharger en production |

Passer la variable avant de lancer Docker :

```bash
JWT_SECRET="mon_secret_securise" docker compose up --build
```

Ou créer un fichier `.env` à la racine :

```env
JWT_SECRET=mon_secret_securise_et_long
```

---

## 11. Résolution des problèmes courants

### L'API ne démarre pas — erreur de connexion PostgreSQL

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution :** Vérifier que PostgreSQL est démarré et que `DATABASE_URL` pointe vers le bon hôte.  
Avec Docker : remplacer `localhost` par `postgres` dans `DATABASE_URL`.

---

### Le seed échoue — "relation does not exist"

Le schéma n'a pas été initialisé. Vérifier que les scripts SQL ont été exécutés :

```bash
docker exec -it healthai-postgres psql -U healthai -d healthai \
  -c "\dt healthai.*"
```

---

### Connexion refusée — "Session expired or revoked"

Le token JWT est expiré (durée de vie : 24h). Se reconnecter :

```bash
curl -X POST /auth/login -d '{"email":"...","password":"..."}'
```

---

### Accès refusé — 403 "Admin access required"

Vous tentez une opération d'écriture avec un compte `user`. Vérifier votre rôle :

```bash
curl -X GET /auth/me -b cookies.txt
# → { "role": "user" }  ← il faut être "admin" pour écrire
```

---

### Données vides pour un utilisateur connecté

Le profil santé n'est pas encore lié à ce compte. Demander à l'admin de lier le profil via `/admin` → section **Profils**.

---

### Le pipeline ETL génère des CSV vides

Vérifier que les fichiers sources sont présents dans `MSPR_Pipeline/data/raw/` :

```
gym_members_exercise_tracking.csv
Activity.csv
daily_food_nutrition_dataset.csv
```

---

### Port 3000 déjà utilisé

```bash
# Identifier le processus qui utilise le port
lsof -i :3000        # Linux/Mac
netstat -ano | findstr :3000   # Windows

# Ou changer le port dans .env
PORT=3001
```

---

## Récapitulatif des commandes clés

```bash
# ── Docker ──────────────────────────────────────────────────────────
docker compose up --build          # Démarrage complet
docker compose up postgres api     # API seule (données déjà chargées)
docker compose down                # Arrêt
docker compose down -v             # Arrêt + suppression des données
docker compose logs api            # Logs de l'API
docker compose logs -f             # Tous les logs en temps réel

# ── Build frontend ───────────────────────────────────────────────────
cd APIMSPR-1 && npm run build

# ── API en développement ─────────────────────────────────────────────
cd APIMSPR-1 && npm run dev         # API sur :3000
cd APIMSPR-1 && npm run dev:client  # Vite sur :5173

# ── Pipeline ETL ─────────────────────────────────────────────────────
cd MSPR_Pipeline && python scripts/run_pipeline.py
cd MSPR_Pipeline && python database/seed.py --truncate

# ── Base de données ───────────────────────────────────────────────────
docker exec -it healthai-postgres psql -U healthai -d healthai
```
