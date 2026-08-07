#!/usr/bin/env python3
"""CLI acceptance check for Family A config-driven extraction."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(WORKER_DIR))

from extractor import extract_pdf  # noqa: E402
from presets import FAMILY_A_16COL, FAMILY_A_DEFAULT  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Family A PDF extraction")
    parser.add_argument("pdf", type=Path, help="Path to PDF file")
    parser.add_argument("--sixteen-col", action="store_true", help="Use 16-column preset (Al Haram)")
    parser.add_argument("--min-rows", type=int, default=None)
    args = parser.parse_args()

    preset = FAMILY_A_16COL if args.sixteen_col else FAMILY_A_DEFAULT
    min_rows = args.min_rows or (26 if args.sixteen_col else 38)

    data = args.pdf.read_bytes()
    result = extract_pdf(data, template_config=preset)
    rows = result["rows"]

    print(f"File: {args.pdf.name}")
    print(f"Rows: {len(rows)} (min {min_rows})")
    print(f"Template: {result['template_used']}")
    print(f"Confidence: {result['confidence']}")

    if rows:
        sample = rows[0]
        print(f"Sample: {sample['raw_product_text']!r} qty={sample['quantity']} amount={sample['gross_value']}")

    if len(rows) < min_rows:
        print(f"FAIL: expected >={min_rows} rows", file=sys.stderr)
        return 1

    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
