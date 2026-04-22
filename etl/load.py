import os
from .utils import get_logger

OUTPUT_PATH = "data/processed/"
logger = get_logger(__name__)

def load_data(data):
    os.makedirs(OUTPUT_PATH, exist_ok=True)

    data["users"].to_csv(os.path.join(OUTPUT_PATH, "users_clean.csv"), index=False)
    data["users_for_merge"].to_csv(
        os.path.join(OUTPUT_PATH, "users_for_merge.csv"), index=False
    )
    data["activity"].to_csv(os.path.join(OUTPUT_PATH, "activity_clean.csv"), index=False)
    data["nutrition"].to_csv(os.path.join(OUTPUT_PATH, "nutrition_clean.csv"), index=False)
    data["merged_mspr_20"].to_csv(
        os.path.join(OUTPUT_PATH, "merged_analytics_mspr_20.csv"), index=False
    )
    data["consommation_alimentaire"].to_csv(
        os.path.join(OUTPUT_PATH, "consommation_alimentaire.csv"), index=False
    )

    logger.info("Donnees sauvegardees dans %s", OUTPUT_PATH)