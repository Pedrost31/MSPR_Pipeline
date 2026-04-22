from .extract import extract_data
from .transform import transform_data
from .load import load_data
from .quality import run_csv_quality_check
from .utils import get_logger

logger = get_logger(__name__)

def run_pipeline():
    logger.info("Demarrage du pipeline ETL")

    data = extract_data()

    if data:
        clean_data = transform_data(data)
        load_data(clean_data)
        run_csv_quality_check()
        logger.info("Pipeline ETL termine avec succes")
    else:
        logger.error("Pipeline arretee: extraction vide ou en echec")