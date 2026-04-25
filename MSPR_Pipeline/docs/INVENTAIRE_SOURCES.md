# Rapport d'inventaire des sources de données

**Projet :** HealthAI Coach — Backend métier  
**Composant :** Pipeline ETL  
**Date :** Avril 2026

---

## 1. Vue d'ensemble des sources

Le pipeline ETL intègre trois sources de données open data issues de Kaggle, couvrant les trois domaines métier de la plateforme HealthAI Coach : profils utilisateurs, activité physique et nutrition.

| # | Fichier source | Domaine | Lignes | Colonnes | Format | Licence |
|---|---|---|---|---|---|---|
| 1 | `gym_members_exercise_tracking.csv` | Profils utilisateurs | 973 | 15 | CSV | CC0 Public Domain |
| 2 | `Activity.csv` | Activité physique quotidienne | 941 | 18 | CSV | CC0 Public Domain |
| 3 | `daily_food_nutrition_dataset.csv` | Nutrition | 591 | 13 | CSV | CC0 Public Domain |

Aucune source ne contient de données personnelles réelles. Toutes les données sont fictives ou anonymisées, conformément aux exigences RGPD.

---

## 2. Fiche détaillée par source

### 2.1 Gym Members Exercise Dataset

| Attribut | Valeur |
|---|---|
| **Nom du fichier** | `gym_members_exercise_tracking.csv` |
| **Origine** | Kaggle — [valakhorasani/gym-members-exercise-dataset](https://www.kaggle.com/datasets/valakhorasani/gym-members-exercise-dataset) |
| **Format** | CSV (séparateur virgule, encodage UTF-8) |
| **Volume** | 973 lignes × 15 colonnes — 65 Ko |
| **Fréquence de mise à jour** | Dataset statique (snapshot, pas de mise à jour automatique) |
| **Données personnelles** | Non — données fictives |

**Colonnes et types :**

| Colonne | Type | Description | Valeurs manquantes |
|---|---|---|---|
| Age | int | Âge de l'utilisateur (en années) | 0 |
| Gender | string | Sexe (Male / Female) | 0 |
| Weight (kg) | float | Poids en kilogrammes | 0 |
| Height (m) | float | Taille en mètres | 0 |
| Max_BPM | int | Fréquence cardiaque maximale | 0 |
| Avg_BPM | int | Fréquence cardiaque moyenne | 0 |
| Resting_BPM | int | Fréquence cardiaque au repos | 0 |
| Session_Duration (hours) | float | Durée de séance en heures | 0 |
| Calories_Burned | float | Calories brûlées par séance | 0 |
| Workout_Type | string | Type d'exercice (Cardio, HIIT, Yoga, Strength) | 0 |
| Fat_Percentage | float | Pourcentage de masse grasse | 0 |
| Water_Intake (liters) | float | Consommation d'eau en litres | 0 |
| Workout_Frequency (days/week) | int | Fréquence d'entraînement par semaine | 0 |
| Experience_Level | int | Niveau d'expérience (1=débutant, 3=avancé) | 0 |
| BMI | float | Indice de masse corporelle fourni | 0 |

**Règles de qualité appliquées :**
- Suppression des doublons exacts
- Génération d'un UserID séquentiel (1 à 973) — le dataset source n'en contient pas
- Calcul de `BMI_calculated` = Poids / Taille² (vérification du BMI fourni)
- Aucune valeur manquante détectée

**Justification du choix :**  
Ce dataset fournit des profils utilisateurs complets et représentatifs de la cible HealthAI Coach (adultes actifs, diverses morphologies, différents niveaux de pratique sportive). Il couvre les métriques biométriques (BPM, BMI, poids, taille) et les habitudes sportives nécessaires aux recommandations personnalisées.

---

### 2.2 Fitness Tracker Dataset (Activity)

| Attribut | Valeur |
|---|---|
| **Nom du fichier** | `Activity.csv` |
| **Origine** | Kaggle — [nadeemajeedch/fitness-tracker-dataset](https://www.kaggle.com/datasets/nadeemajeedch/fitness-tracker-dataset) |
| **Format** | CSV (séparateur virgule, encodage UTF-8) |
| **Volume** | 941 lignes × 18 colonnes — 90 Ko |
| **Fréquence de mise à jour** | Dataset statique |
| **Données personnelles** | Non — données fictives |

**Colonnes et types :**

| Colonne | Type | Description | Valeurs manquantes |
|---|---|---|---|
| UserID | bigint | Identifiant utilisateur (format numérique long) | 0 |
| Date | date | Date de l'enregistrement d'activité | 0 |
| Steps | int | Nombre de pas effectués | 0 |
| Total_Distance | float | Distance totale parcourue (km) | 0 |
| Very_Active_Distance | float | Distance en activité intense | 0 |
| Moderately_Active_Distance | float | Distance en activité modérée | 0 |
| Light_Active_Distance | float | Distance en activité légère | 0 |
| Very_Active_Minutes | int | Minutes d'activité intense | 0 |
| Fairly_Active_Minutes | int | Minutes d'activité modérée | 0 |
| Lightly_Active_Minutes | int | Minutes d'activité légère | 0 |
| Sedentary_Minutes | int | Minutes sédentaires | 0 |
| Calories | int | Calories brûlées dans la journée | 0 |
| *(autres colonnes)* | — | Variables additionnelles selon version du dataset | — |

**Règles de qualité appliquées :**
- Suppression des doublons
- Conversion de la colonne `Date` en type `datetime`
- Suppression des lignes avec `UserID` ou `Date` manquants
- Remplissage à 0 des colonnes numériques manquantes restantes

**Note sur les UserIDs :**  
Ce dataset contient 33 UserIDs uniques de format numérique long (ex: 1503960366). Ces identifiants ne correspondent pas aux UserIDs générés pour le dataset Gym Members. Un alignement par échantillonnage déterministe (`random_state=42`) est réalisé dans la phase de transformation pour permettre la jointure analytique — voir `etl/transform.py:align_users_with_activity_ids()`.

**Justification du choix :**  
Ce dataset simule les exports de trackers d'activité (Fitbit, Apple Watch) avec une granularité journalière et une décomposition par niveaux d'intensité. Il correspond exactement aux métriques de performance décrites dans le cahier des charges (steps, distance, minutes actives, calories).

---

### 2.3 Daily Food & Nutrition Dataset

| Attribut | Valeur |
|---|---|
| **Nom du fichier** | `daily_food_nutrition_dataset.csv` |
| **Origine** | Kaggle — [adilshamim8/daily-food-and-nutrition-dataset](https://www.kaggle.com/datasets/adilshamim8/daily-food-and-nutrition-dataset) |
| **Format** | CSV (séparateur virgule, encodage UTF-8) |
| **Volume** | 591 lignes × 13 colonnes — 48 Ko |
| **Fréquence de mise à jour** | Dataset statique |
| **Données personnelles** | Non |

**Colonnes et types :**

| Colonne | Type | Description | Valeurs manquantes |
|---|---|---|---|
| Food_Item | string | Nom de l'aliment | 0 |
| Calories (kcal) | int | Apport énergétique pour 100g | 0 |
| Protein (g) | float | Protéines pour 100g | 0 |
| Carbohydrates (g) | float | Glucides pour 100g | 0 |
| Fat (g) | float | Lipides pour 100g | 0 |
| Fiber (g) | float | Fibres pour 100g | 0 |
| Sugars (g) | float | Sucres pour 100g | 0 |
| Sodium (mg) | int | Sodium pour 100g | 0 |
| Cholesterol (mg) | int | Cholestérol pour 100g | 0 |
| Category | string | Catégorie alimentaire | 0 |
| Meal_Type | string | Type de repas recommandé | 0 |
| Water_Intake (ml) | int | Apport hydrique associé | 0 |
| nutrition_id | int | Identifiant généré par le pipeline | 0 |

**Règles de qualité appliquées :**
- Suppression des doublons
- Remplissage des valeurs numériques manquantes par 0
- Remplissage des valeurs textuelles manquantes par "unknown"
- Génération d'un `nutrition_id` séquentiel

**Justification du choix :**  
Ce dataset constitue le référentiel nutritionnel de la plateforme. Sa couverture (591 aliments avec macronutriments complets) permet d'alimenter les analyses nutritionnelles (déficits/excès caloriques, équilibre protéines/glucides/lipides) et les recommandations diététiques du module IA futur.

---

## 3. Schéma des flux de données

```
data/raw/
    ├── gym_members_exercise_tracking.csv ──┐
    ├── Activity.csv ────────────────────────┼──► etl/extract.py
    └── daily_food_nutrition_dataset.csv ───┘
                                             │
                                             ▼
                                    etl/transform.py
                                    ┌──────────────────────────────────────┐
                                    │ 1. clean_users()                     │
                                    │    → dédup + UserID séquentiel + BMI │
                                    │                                      │
                                    │ 2. clean_activity()                  │
                                    │    → dédup + parsing dates           │
                                    │                                      │
                                    │ 3. clean_nutrition()                 │
                                    │    → dédup + fillna + nutrition_id   │
                                    │                                      │
                                    │ 4. add_user_features()               │
                                    │    → BMI_calculated                  │
                                    │                                      │
                                    │ 5. align_users_with_activity_ids()   │
                                    │    → 33 profils alignés sur Activity │
                                    │                                      │
                                    │ 6. merge(activity, users_for_merge)  │
                                    │    → table analytique combinée       │
                                    │                                      │
                                    │ 7. _select_mspr_20_columns()         │
                                    │    → sélection 20 colonnes cibles    │
                                    │                                      │
                                    │ 8. build_consumption_data()          │
                                    │    → simulation consommations (×3/j) │
                                    └──────────────────────────────────────┘
                                             │
                                             ▼
                                    etl/load.py + etl/quality.py
                                             │
                                             ▼
data/processed/
    ├── users_clean.csv
    ├── activity_clean.csv
    ├── nutrition_clean.csv
    ├── users_for_merge.csv
    ├── merged_analytics_mspr_20.csv
    └── consommation_alimentaire.csv

logs/
    ├── etl.log
    └── csv_quality_report.csv
```

---

## 4. Règles de qualité globales

| Règle | Implémentation | Fichier |
|---|---|---|
| Suppression des doublons | `df.drop_duplicates()` | `transform.py` |
| Validation des colonnes requises | `validate_required_columns()` | `utils.py` |
| Parsing des dates | `pd.to_datetime(errors='coerce')` | `transform.py` |
| Remplissage des valeurs manquantes numériques | `fillna(0)` | `transform.py` |
| Arrondi à 2 décimales | `df.round(2)` | `transform.py` |
| Détection colonnes à fort taux de zéros (>70%) | `high_zero_flag` | `quality.py` |
| Détection colonnes constantes | `is_constant` | `quality.py` |
| Rapport qualité automatique post-pipeline | `csv_quality_report.csv` | `quality.py` |
| Traçabilité complète des exécutions | `etl.log` | `utils.py` |

---

## 5. Limites et points d'attention

| Point | Description |
|---|---|
| **Alignement des UserIDs** | Les datasets Gym Members et Activity n'ont pas d'identifiant commun. Un alignement déterministe (échantillonnage `random_state=42`) est appliqué. La table `users_for_merge.csv` est une correspondance synthétique, cohérente avec la nature simulée des données. |
| **Consommations alimentaires simulées** | La table `consommation_alimentaire.csv` est entièrement générée (2-4 items/jour/utilisateur, assignation aléatoire déterministe). Elle représente un jeu de données de démonstration pour le module nutrition. |
| **Données statiques** | Les trois sources sont des snapshots Kaggle sans mise à jour automatique. Pour une mise en production, il faudrait les remplacer par des flux temps réel (API trackers, BDD clients). |
| **Lignes ignorées à l'extraction** | `on_bad_lines='skip'` est activé. Aucune ligne malformée n'a été détectée sur les datasets actuels. |
