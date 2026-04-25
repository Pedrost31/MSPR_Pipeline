from pathlib import Path

import pandas as pd

from .utils import get_logger

logger = get_logger(__name__)


def analyze_csv(path: Path, zero_threshold: float):
    df = pd.read_csv(path)
    row_count = len(df)
    duplicate_rows = int(df.duplicated().sum())

    records = []
    for col in df.columns:
        series = df[col]
        missing = int(series.isna().sum())
        missing_pct = round((missing / row_count) * 100, 2) if row_count else 0.0
        unique = int(series.nunique(dropna=True))
        dtype = str(series.dtype)
        constant = unique <= 1

        zero_pct = None
        high_zero = False
        if pd.api.types.is_numeric_dtype(series):
            zero_count = int((series == 0).sum())
            zero_pct = round((zero_count / row_count) * 100, 2) if row_count else 0.0
            high_zero = zero_pct >= zero_threshold

        records.append(
            {
                "file": path.name,
                "column": col,
                "dtype": dtype,
                "rows": row_count,
                "missing_count": missing,
                "missing_pct": missing_pct,
                "unique_values": unique,
                "is_constant": constant,
                "zero_pct": zero_pct,
                "high_zero_flag": high_zero,
                "duplicate_rows_file_level": duplicate_rows,
            }
        )

    return pd.DataFrame(records)


def run_csv_quality_check(
    input_dir: str = "data/processed",
    output_file: str = "logs/csv_quality_report.csv",
    zero_threshold: float = 70.0,
) -> dict:
    source_dir = Path(input_dir)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    csv_files = sorted(source_dir.glob("*.csv"))
    if not csv_files:
        logger.warning("No CSV files found in %s", source_dir)
        return {"files": 0, "columns": 0, "flagged": 0, "report": str(output_path)}

    report_parts = [analyze_csv(path, zero_threshold) for path in csv_files]
    report = pd.concat(report_parts, ignore_index=True)
    report.to_csv(output_path, index=False)

    flagged = report[
        (report["missing_pct"] > 0)
        | (report["is_constant"])
        | (report["high_zero_flag"])
    ]
    summary = {
        "files": len(csv_files),
        "columns": len(report),
        "flagged": int(len(flagged)),
        "report": str(output_path),
    }
    logger.info(
        "CSV quality check done | files=%s columns=%s flagged=%s report=%s",
        summary["files"],
        summary["columns"],
        summary["flagged"],
        summary["report"],
    )
    return summary
