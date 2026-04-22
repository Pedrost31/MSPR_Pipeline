import pandas as pd
import os
from .utils import get_logger

DATA_PATH = "data/raw/"
logger = get_logger(__name__)

def extract_data():
    try:
        users = pd.read_csv(os.path.join(DATA_PATH, "gym_members_exercise_tracking.csv"), on_bad_lines='skip')
        activity = pd.read_csv(os.path.join(DATA_PATH, "Activity.csv"), on_bad_lines='skip')
        nutrition = pd.read_csv(os.path.join(DATA_PATH, "daily_food_nutrition_dataset.csv"), on_bad_lines='skip')

        logger.info("Extraction reussie")

        return {
            "users": users,
            "activity": activity,
            "nutrition": nutrition
        }

    except Exception as e:
        logger.exception("Erreur extraction: %s", e)
        return None