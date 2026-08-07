"""Tests for header_analyzer (Phase 6 template wizard)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from column_resolver import build_detected_groups, resolve_label_columns
from header_analyzer import analyze_headers
from presets import FAMILY_A_DEFAULT

ROOT = Path(__file__).resolve().parents[2]
PDF_SEARCH_DIRS = [
    ROOT / "samples" / "pdfs",
    Path(os.environ.get("MEDICRONIS_PDF_DIR", "")),
    Path(r"D:\Downloads\July Closing"),
    Path(r"D:\Downloads"),
]


def _find_pdf(name: str) -> Path | None:
    for directory in PDF_SEARCH_DIRS:
        if not directory or not directory.is_dir():
            continue
        candidate = directory / name
        if candidate.is_file():
            return candidate
    return None


def _aim_header_17() -> list[list[str | None]]:
    return [
        [
            "ITEM",
            "RATE",
            "OPEN",
            "RCVD",
            "TOTAL",
            "TRANS\nFERED",
            "SALE",
            "",
            "",
            "",
            "RETURN",
            "",
            "NET SALE",
            "",
            "",
            "CLOSING",
            "",
        ],
        [
            "",
            "",
            "",
            "",
            "",
            "",
            "LAST\nMONTH",
            "TODAY",
            "QTY",
            "BONUS",
            "QTY",
            "BONUS",
            "QTY",
            "BONUS",
            "AMOUNT",
            "QTY",
            "",
        ],
    ]


def test_synthetic_aim_header_grid_and_mappings():
    """AIM-style 17-col grouped header resolves NET SALE QTY/AMOUNT via preset."""
    table = _aim_header_17() + [
        ["PRODUCT A", "90.00", "", "", "", "", "", "", "", "", "", "", "5", "", "500", "", ""]
    ]

    cols = resolve_label_columns(table, FAMILY_A_DEFAULT)
    assert cols["sales_qty"] == 12
    assert cols["sales_amount"] == 14
    assert cols["product_name"] == 0

    groups = build_detected_groups(table[0])
    assert "net sale" in groups
    assert "item" in groups


@pytest.mark.parametrize("pdf_name", ["AIM Pharma HYD.pdf"])
def test_aim_pdf_header_analysis(pdf_name: str):
    pdf_path = _find_pdf(pdf_name)
    if pdf_path is None:
        pytest.skip(f"Sample PDF not found: {pdf_name}")

    result = analyze_headers(pdf_path.read_bytes())

    assert result["suggestedFormatCode"] == "fmt-a-ssr-stock-return"
    assert result["confidence"] >= 0.5
    assert result["headerStructure"] == "grouped_two_row"
    assert result["colCount"] in (16, 17)
    assert len(result["headerGrid"]) == 2
    assert len(result["headerGrid"][0]) in (16, 17)

    groups_upper = [g.upper() for g in result["detectedGroups"]]
    assert any("NET SALE" in g for g in groups_upper)

    mappings = result["suggestedMappings"]
    assert mappings["sales_qty"]["group"].upper() == "NET SALE"
    assert mappings["sales_qty"]["leaf"].upper() == "QTY"
    assert mappings["sales_amount"]["leaf"].upper() == "AMOUNT"

    assert result["unresolvedFields"] == []
