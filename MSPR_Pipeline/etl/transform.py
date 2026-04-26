import pandas as pd
import numpy as np
from .utils import get_logger, validate_required_columns

logger = get_logger(__name__)


# -----------------------------
# CLEANING FUNCTIONS
# -----------------------------

def clean_users(df):
    df = df.copy()
    df = df.drop_duplicates()

    if "UserID" not in df.columns:
        df["UserID"] = range(1, len(df) + 1)

    validate_required_columns(df, ["UserID"], "users")

    return df


def clean_activity(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.drop_duplicates()
    validate_required_columns(df, ["UserID", "Date"], "activity")

    if "Date" in df.columns:
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")

    df = df.dropna(subset=["UserID", "Date"])

    numeric_cols = df.select_dtypes(include="number").columns
    df[numeric_cols] = df[numeric_cols].fillna(0)

    return df


#  AJOUT MANQUANT
def clean_nutrition(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.drop_duplicates()
    validate_required_columns(df, ["Food_Item", "Calories (kcal)"], "nutrition")

    # Keep text dimensions readable while normalizing numeric metrics.
    numeric_cols = df.select_dtypes(include="number").columns
    text_cols = df.columns.difference(numeric_cols)
    df[numeric_cols] = df[numeric_cols].fillna(0)
    df[text_cols] = df[text_cols].fillna("unknown")
    if "nutrition_id" not in df.columns:
        df["nutrition_id"] = range(1, len(df) + 1)
    return df


# -----------------------------
# FEATURE ENGINEERING
# -----------------------------

def add_user_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    if "Weight (kg)" in df.columns and "Height (m)" in df.columns:
        df["BMI_calculated"] = df["Weight (kg)"] / (df["Height (m)"] ** 2)

    return df


def align_users_with_activity_ids(
    users_df: pd.DataFrame, activity_df: pd.DataFrame
) -> pd.DataFrame:
    """
    Build a deterministic profile table keyed by activity UserID.
    The source user dataset has no native UserID compatible with activity IDs,
    so we assign activity IDs to sampled user profiles.
    """
    users_df = users_df.copy()
    activity_user_ids = (
        activity_df["UserID"].dropna().drop_duplicates().sort_values().tolist()
    )

    if not activity_user_ids:
        raise ValueError("Aucun UserID disponible dans activity pour l'alignement")

    sampled_users = users_df.sample(
        n=len(activity_user_ids),
        replace=len(users_df) < len(activity_user_ids),
        random_state=42,
    ).reset_index(drop=True)
    sampled_users["UserID"] = activity_user_ids
    return sampled_users


def _collapse_suffix_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    suffix_x = [c for c in df.columns if c.endswith("_x")]
    for col_x in suffix_x:
        base = col_x[:-2]
        col_y = f"{base}_y"
        if col_y not in df.columns:
            continue

        x_na = df[col_x].isna().mean()
        y_na = df[col_y].isna().mean()

        if df[col_x].equals(df[col_y]):
            df[base] = df[col_x]
            df = df.drop(columns=[col_x, col_y])
        elif x_na <= y_na:
            df[base] = df[col_x]
            df = df.drop(columns=[col_x, col_y])
        else:
            df[base] = df[col_y]
            df = df.drop(columns=[col_x, col_y])
    return df


def _drop_useless_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    drop_cols = []

    for col in df.columns:
        if df[col].isna().all():
            drop_cols.append(col)

    if drop_cols:
        df = df.drop(columns=drop_cols)

    # Drop exact duplicate columns by content.
    df = df.loc[:, ~df.T.duplicated()]
    return df


def _drop_high_zero_columns(df: pd.DataFrame, threshold: float = 0.7) -> pd.DataFrame:
    df = df.copy()
    drop_cols = []
    numeric_cols = df.select_dtypes(include="number").columns
    for col in numeric_cols:
        zero_ratio = (df[col] == 0).mean()
        if zero_ratio >= threshold:
            drop_cols.append(col)
    if drop_cols:
        df = df.drop(columns=drop_cols)
    return df


def _standardize_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = _collapse_suffix_columns(df)

    numeric_cols = df.select_dtypes(include="number").columns
    df[numeric_cols] = df[numeric_cols].round(2)
    return df


def _select_mspr_20_columns(df: pd.DataFrame) -> pd.DataFrame:
    desired_columns = [
        "UserID",
        "Date",
        "Workout_Type",
        "Experience_Level",
        "Age",
        "Gender",
        "BMI_calculated",
        "Weight (kg)",
        "Height (m)",
        "Steps",
        "Total_Distance",
        "Very_Active_Distance",
        "Moderately_Active_Distance",
        "Light_Active_Distance",
        "Very_Active_Minutes",
        "Fairly_Active_Minutes",
        "Lightly_Active_Minutes",
        "Sedentary_Minutes",
        "Session_Duration (hours)",
        "Calories_Burned",
    ]
    existing = [col for col in desired_columns if col in df.columns]
    missing = [col for col in desired_columns if col not in df.columns]
    if missing:
        logger.warning("Colonnes MSPR-20 manquantes et ignorees: %s", missing)
    return df[existing].copy()


def build_consumption_data(
    merged_mspr_20: pd.DataFrame, nutrition: pd.DataFrame, seed: int = 42
) -> pd.DataFrame:
    """
    Build a simulated food consumption table to link users with nutrition.
    """
    validate_required_columns(merged_mspr_20, ["UserID", "Date"], "merged_mspr_20")
    validate_required_columns(nutrition, ["nutrition_id"], "nutrition")

    rng = np.random.default_rng(seed)
    nutrition_ids = nutrition["nutrition_id"].dropna().astype(int).tolist()
    if not nutrition_ids:
        raise ValueError("Aucun nutrition_id disponible pour simuler les consommations")

    meal_types = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]
    records = []
    id_consumption = 1

    for row in merged_mspr_20.itertuples(index=False):
        n_items = int(rng.integers(2, 5))  # 2 to 4 food items per day/user
        selected_ids = rng.choice(nutrition_ids, size=n_items, replace=False)
        selected_meals = rng.choice(meal_types, size=n_items, replace=True)
        quantities = rng.uniform(80, 350, size=n_items)

        for nutrition_id, meal, qty in zip(selected_ids, selected_meals, quantities):
            records.append(
                {
                    "id_consumption": id_consumption,
                    "user_id": int(row.UserID),
                    "nutrition_id": int(nutrition_id),
                    "date_consommation": pd.to_datetime(row.Date).date(),
                    "repas_type": str(meal),
                    "quantite_grammes": round(float(qty), 2),
                }
            )
            id_consumption += 1

    return pd.DataFrame(records)


# -----------------------------
# MAIN TRANSFORM FUNCTION
# -----------------------------

def transform_data(data: dict) -> dict:

    # 1. Nettoyage
    users = clean_users(data["users"])
    activity = clean_activity(data["activity"])
    nutrition = clean_nutrition(data["nutrition"])

    # 2. Enrichissement
    users = add_user_features(users)
    users_for_merge = align_users_with_activity_ids(users, activity)

    # 3. Merge analytique user/activity.
    merged = activity.merge(users_for_merge, on="UserID", how="left")

    if "Date" in merged.columns:
        merged = merged.sort_values(by="Date")

    users = _standardize_frame(users)
    users_for_merge = _standardize_frame(users_for_merge)
    activity = _standardize_frame(activity)
    nutrition = _standardize_frame(nutrition)
    merged = _standardize_frame(merged)
    merged_mspr_20 = _select_mspr_20_columns(merged)
    consommation_alimentaire = build_consumption_data(merged_mspr_20, nutrition)

    logger.info(
        "Transformation OK | users=%s activity=%s nutrition=%s merged=%s consommation=%s",
        len(users),
        len(activity),
        len(nutrition),
        len(merged),
        len(consommation_alimentaire),
    )

    return {
        "users": users,
        "users_for_merge": users_for_merge,
        "activity": activity,
        "nutrition": nutrition,
        "merged_mspr_20": merged_mspr_20,
        "consommation_alimentaire": consommation_alimentaire,
    }