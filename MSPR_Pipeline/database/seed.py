"""
Seed PostgreSQL — HealthAI Coach
Charge les CSV de data/processed/ dans le schéma healthai.

Usage :
    python database/seed.py [--truncate]

    --truncate  Vide les tables avant d'insérer (recommandé pour re-seed propre)

Variables d'environnement (valeurs par défaut) :
    POSTGRES_HOST      localhost
    POSTGRES_PORT      5432
    POSTGRES_DB        healthai
    POSTGRES_USER      healthai
    POSTGRES_PASSWORD  healthai
"""

import os
import sys
import argparse
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

# Evite UnicodeDecodeError sur Windows (fichiers pgpass/pg_service en cp1252)
os.environ["PGPASSFILE"]    = os.devnull
os.environ["PGSYSCONFDIR"]  = os.devnull

DB_CONFIG = {
    "host":     os.getenv("POSTGRES_HOST",     "localhost"),
    "port":     int(os.getenv("POSTGRES_PORT", "5432")),
    "dbname":   os.getenv("POSTGRES_DB",       "healthai"),
    "user":     os.getenv("POSTGRES_USER",     "healthai"),
    "password": os.getenv("POSTGRES_PASSWORD", "healthai"),
}

ROOT_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(ROOT_DIR, "data", "processed")


def _csv(filename: str) -> pd.DataFrame:
    path = os.path.join(PROCESSED_DIR, filename)
    df = pd.read_csv(path, on_bad_lines="skip")
    print(f"  [csv] {filename}  ({len(df)} lignes)")
    return df


# ── seeders ──────────────────────────────────────────────────────────────────

def _seed_utilisateur(cur, df: pd.DataFrame) -> None:
    users = df[
        ["UserID", "Age", "Gender", "Experience_Level",
         "Weight (kg)", "Height (m)", "BMI_calculated"]
    ].drop_duplicates("UserID")

    rows = [
        (
            int(r["UserID"]),
            int(r["Age"]),
            str(r["Gender"]),
            int(r["Experience_Level"]),
            float(r["Weight (kg)"]),
            float(r["Height (m)"]),
            float(r["BMI_calculated"]),
        )
        for _, r in users.iterrows()
    ]
    execute_values(cur, """
        INSERT INTO healthai.utilisateur
            (user_id, age, gender, experience_level, weight_kg, height_m, bmi_calculated)
        VALUES %s
        ON CONFLICT (user_id) DO NOTHING
    """, rows)
    print(f"    → {len(rows)} utilisateurs")


def _seed_activite(cur, df: pd.DataFrame) -> dict:
    rows = [
        (
            int(r["UserID"]),
            str(r["Date"])[:10],
            str(r["Workout_Type"]),
            int(r["Steps"]),
            float(r["Total_Distance"]),
            float(r["Session_Duration (hours)"]),
            int(r["Calories_Burned"]),
        )
        for _, r in df.iterrows()
    ]
    execute_values(cur, """
        INSERT INTO healthai.activite_journaliere
            (user_id, date, workout_type, steps,
             total_distance, session_duration_hours, calories_burned)
        VALUES %s
    """, rows)
    print(f"    → {len(rows)} activites")

    # Récupère les IDs auto-générés pour le mapping des intensités
    cur.execute("""
        SELECT id_activity, user_id, date::text
        FROM healthai.activite_journaliere
        ORDER BY id_activity
    """)
    return {(row[1], row[2]): row[0] for row in cur.fetchall()}


def _seed_intensite(cur, df: pd.DataFrame, id_map: dict) -> None:
    intensity_levels = [
        ("Very_Active_Distance",       "Very_Active_Minutes",    "VERY_ACTIVE"),
        ("Moderately_Active_Distance",  "Fairly_Active_Minutes",  "MODERATE"),
        ("Light_Active_Distance",       "Lightly_Active_Minutes", "LIGHT"),
        (None,                          "Sedentary_Minutes",      "SEDENTARY"),
    ]

    rows = []
    missing = 0
    for _, r in df.iterrows():
        key = (int(r["UserID"]), str(r["Date"])[:10])
        id_activity = id_map.get(key)
        if id_activity is None:
            missing += 1
            continue
        for dist_col, min_col, niveau in intensity_levels:
            dist = float(r[dist_col]) if dist_col and dist_col in df.columns else None
            mins = int(r[min_col])    if min_col in df.columns else 0
            rows.append((id_activity, niveau, dist, mins))

    if missing:
        print(f"    [warn] {missing} lignes sans id_activity correspondant — ignorées")

    execute_values(cur, """
        INSERT INTO healthai.activite_intensite
            (id_activity, niveau_intensite, distance, minutes)
        VALUES %s
        ON CONFLICT (id_activity, niveau_intensite) DO NOTHING
    """, rows)
    print(f"    → {len(rows)} lignes d'intensite ({len(rows) // 4} séances)")


_VALID_MEAL_TYPES = {"BREAKFAST", "LUNCH", "DINNER", "SNACK"}

def _normalize_meal_type(value: str) -> str:
    """Normalise en uppercase et remplace les valeurs inconnues par SNACK."""
    upper = str(value).strip().upper()
    return upper if upper in _VALID_MEAL_TYPES else "SNACK"


def _seed_nutrition(cur) -> None:
    df = _csv("nutrition_clean.csv")
    rows = [
        (
            int(r["nutrition_id"]),
            str(r["Food_Item"]),
            str(r["Category"]),
            int(r["Calories (kcal)"]),
            float(r["Protein (g)"]),
            float(r["Carbohydrates (g)"]),
            float(r["Fat (g)"]),
            float(r["Fiber (g)"]),
            float(r["Sugars (g)"]),
            int(r["Sodium (mg)"]),
            int(r["Cholesterol (mg)"]),
            _normalize_meal_type(r["Meal_Type"]),
            int(r["Water_Intake (ml)"]),
        )
        for _, r in df.iterrows()
    ]
    execute_values(cur, """
        INSERT INTO healthai.nutrition
            (nutrition_id, food_item, category, calories_kcal,
             protein_g, carbohydrates_g, fat_g, fiber_g, sugars_g,
             sodium_mg, cholesterol_mg, meal_type, water_intake_ml)
        VALUES %s
        ON CONFLICT (nutrition_id) DO NOTHING
    """, rows)
    print(f"    → {len(rows)} aliments")


def _seed_consommation(cur) -> None:
    df = _csv("consommation_alimentaire.csv")
    rows = [
        (
            int(r["id_consumption"]),
            int(r["user_id"]),
            int(r["nutrition_id"]),
            str(r["date_consommation"])[:10],
            str(r["repas_type"]),
            float(r["quantite_grammes"]),
        )
        for _, r in df.iterrows()
    ]
    execute_values(cur, """
        INSERT INTO healthai.consommation_alimentaire
            (id_consumption, user_id, nutrition_id,
             date_consommation, repas_type, quantite_grammes)
        VALUES %s
        ON CONFLICT (id_consumption) DO NOTHING
    """, rows)
    print(f"    → {len(rows)} consommations")


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed PostgreSQL HealthAI Coach")
    parser.add_argument(
        "--truncate", action="store_true",
        help="Vide les tables avant l'insertion (TRUNCATE CASCADE)"
    )
    args = parser.parse_args()

    print("Connexion PostgreSQL...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
    except psycopg2.OperationalError as e:
        print(f"Connexion impossible : {e}", file=sys.stderr)
        sys.exit(1)

    conn.autocommit = False
    cur = conn.cursor()

    try:
        if args.truncate:
            print("Truncate tables (CASCADE)...")
            cur.execute("""
                TRUNCATE
                    healthai.consommation_alimentaire,
                    healthai.activite_intensite,
                    healthai.activite_journaliere,
                    healthai.nutrition,
                    healthai.utilisateur
                CASCADE
            """)

        # api_user_id reste NULL après seed — les profils sont liés manuellement via PUT /utilisateurs/:id/link
        print("\n[1/5] Utilisateurs")
        df_merged = _csv("merged_analytics_mspr_20.csv")
        _seed_utilisateur(cur, df_merged)

        print("\n[2/5] Activités journalières")
        id_map = _seed_activite(cur, df_merged)

        print("\n[3/5] Intensités d'activité")
        _seed_intensite(cur, df_merged, id_map)

        print("\n[4/5] Nutrition")
        _seed_nutrition(cur)

        print("\n[5/5] Consommations alimentaires")
        _seed_consommation(cur)

        conn.commit()
        print("\nSeed terminé avec succès.")

    except Exception as exc:
        conn.rollback()
        print(f"\nErreur — rollback effectué : {exc}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
