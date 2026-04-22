import argparse
import os
import sys

# Change to the project root directory
project_root = os.path.dirname(os.path.dirname(__file__))
os.chdir(project_root)
sys.path.insert(0, project_root)

from etl.quality import run_csv_quality_check


def main():
    parser = argparse.ArgumentParser(description="CSV quality checker")
    parser.add_argument(
        "--input-dir",
        default="data/processed",
        help="Directory containing CSV files to check",
    )
    parser.add_argument(
        "--output-file",
        default="logs/csv_quality_report.csv",
        help="Output CSV report path",
    )
    parser.add_argument(
        "--zero-threshold",
        type=float,
        default=70.0,
        help="Flag numeric columns with >= threshold percent zeros",
    )
    args = parser.parse_args()

    summary = run_csv_quality_check(
        input_dir=args.input_dir,
        output_file=args.output_file,
        zero_threshold=args.zero_threshold,
    )

    print(f"CSV files analyzed: {summary['files']}")
    print(f"Columns analyzed: {summary['columns']}")
    print(f"Flagged columns: {summary['flagged']}")
    print(f"Report generated: {summary['report']}")
    return 0 if summary["files"] > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
