# Script to run the data pipeline
import os
import sys

# Change to the project root directory
project_root = os.path.dirname(os.path.dirname(__file__))
os.chdir(project_root)
sys.path.insert(0, project_root)

from etl.pipeline import run_pipeline

if __name__ == "__main__":
    run_pipeline()