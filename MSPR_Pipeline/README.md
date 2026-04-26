# HealthAI Coach — Pipeline ETL

Pipeline d'ingestion, de nettoyage et de transformation des données pour la plateforme **HealthAI Coach**.  
Ce composant constitue la couche Data Engineering du backend métier : il produit les jeux de données consolidés consommés par l'API REST (Node.js) et le tableau de bord analytique.

---

## Architecture globale

```
Sources brutes (CSV Kaggle)
        │
        ▼
┌─────────────────────────────┐
│     Pipeline ETL (Python)   │
│  extract → transform → load │
│  + quality check + logs     │
└─────────────────────────────┘
        │
        ▼
  data/processed/ (6 CSV)
        │
        ▼
  PostgreSQL (autre repo)
        │
        ▼
  API REST Node.js (autre repo)
        │
        ▼
  Interface web / Dashboard (autre repo)
```

---

## Structure du projet

```
MSPR_Pipeline/
├── data/
│   ├── raw/                              # Sources brutes (non modifiées)
│   │   ├── gym_members_exercise_tracking.csv
│   │   ├── Activity.csv
│   │   └── daily_food_nutrition_dataset.csv
│   └── processed/                        # Sorties du pipeline
│       ├── users_clean.csv               # 973 profils utilisateurs nettoyés
│       ├── activity_clean.csv            # 940 journées d'activité nettoyées
│       ├── nutrition_clean.csv           # 591 aliments nettoyés
│       ├── users_for_merge.csv           # 33 profils alignés sur les IDs Activity
│       ├── merged_analytics_mspr_20.csv  # Table analytique principale (20 colonnes)
│       └── consommation_alimentaire.csv  # Consommations simulées (2856 lignes)
├── etl/
│   ├── extract.py        # Lecture des 3 CSV sources
│   ├── transform.py      # Nettoyage, feature engineering, merge
│   ├── load.py           # Export CSV processed
│   ├── quality.py        # Rapport qualité automatique
│   ├── pipeline.py       # Orchestration extract→transform→load→quality
│   └── utils.py          # Logger + validation des colonnes
├── scripts/
│   └── run_pipeline.py   # Point d'entrée
├── logs/
│   ├── etl.log                  # Trace de chaque exécution
│   └── csv_quality_report.csv   # Rapport qualité des fichiers produits
├── docs/
│   ├── DIAGRAMMES_MSPR.md       # DFD, architecture, UML, déploiement
│   ├── MCD_DATABASE.md          # MCD/MLD/SQL (Merise)
│   └── INVENTAIRE_SOURCES.md    # Rapport d'inventaire des sources
├── Dockerfile
└── requirements.txt
```

---

## Datasets utilisés et justification

| Dataset | Source | Raison du choix |
|---|---|---|
| **Gym Members Exercise Dataset** | [Kaggle](https://www.kaggle.com/datasets/valakhorasani/gym-members-exercise-dataset) | 973 profils utilisateurs fictifs avec données démographiques (âge, poids, taille, BMI, BPM) et métriques sportives (calories, durée, type d'exercice) — représentatif des cibles HealthAI Coach |
| **Fitness Tracker Dataset** | [Kaggle](https://www.kaggle.com/datasets/nadeemajeedch/fitness-tracker-dataset) | Données d'activité quotidienne (steps, distance, minutes par intensité) similaires aux exports Fitbit/Apple Watch — simule les données biométriques du cahier des charges |
| **Daily Food & Nutrition Dataset** | [Kaggle](https://www.kaggle.com/datasets/adilshamim8/daily-food-and-nutrition-dataset) | Référentiel nutritionnel complet (591 aliments, macronutriments, types de repas) pour alimenter le module de suivi nutritionnel |

Les trois datasets sont open data (licence Kaggle), sans données personnelles réelles, conformément aux exigences RGPD du projet.

---

## Prérequis

- Python 3.9+
- pip

```bash
pip install -r requirements.txt
```

---

## Lancer le pipeline

```bash
# Depuis la racine du projet
python scripts/run_pipeline.py
```

Le pipeline :
1. Lit les 3 fichiers dans `data/raw/`
2. Nettoie, transforme et fusionne les données
3. Écrit 6 fichiers dans `data/processed/`
4. Génère le rapport qualité dans `logs/csv_quality_report.csv`
5. Trace l'exécution dans `logs/etl.log`

---

## Via Docker

```bash
# Build
docker build -t healthai-pipeline .

# Run
docker run --rm -v $(pwd)/data:/app/data -v $(pwd)/logs:/app/logs healthai-pipeline
```

---

## Fichiers produits

| Fichier | Lignes | Description |
|---|---|---|
| `users_clean.csv` | 973 | Profils utilisateurs nettoyés + BMI calculé |
| `activity_clean.csv` | 940 | Activités journalières nettoyées + dates parsées |
| `nutrition_clean.csv` | 591 | Référentiel aliments nettoyé |
| `users_for_merge.csv` | 33 | Profils alignés sur les UserIDs du dataset Activity |
| `merged_analytics_mspr_20.csv` | 940 | Table analytique principale : activité + profil utilisateur (20 colonnes MSPR) |
| `consommation_alimentaire.csv` | 2856 | Consommations alimentaires simulées (2-4 items/jour/utilisateur) |

---

## Logs et qualité

Chaque exécution est tracée dans `logs/etl.log` avec le format :
```
2026-04-21 10:32:14 | INFO | etl.pipeline | Pipeline ETL termine avec succes
```

Le rapport `logs/csv_quality_report.csv` analyse pour chaque colonne de chaque fichier produit :
- Taux de valeurs manquantes
- Taux de zéros
- Nombre de valeurs uniques
- Colonnes constantes (alerte)
- Lignes dupliquées

---

## Documentation

- [Diagrammes (DFD, architecture, UML, déploiement)](docs/DIAGRAMMES_MSPR.md)
- [Modèle de données (MCD/MLD/SQL)](docs/MCD_DATABASE.md)
- [Inventaire des sources de données](docs/INVENTAIRE_SOURCES.md)
