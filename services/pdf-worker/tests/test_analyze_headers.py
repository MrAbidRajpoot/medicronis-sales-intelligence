"""Tests for header_analyzer (Phase 6 template wizard)."""

from __future__ import annotations

import io
import os
import zipfile
from pathlib import Path

import pdfplumber
import pytest

from column_resolver import (
    build_detected_groups,
    find_header_span,
    resolve_label_columns,
)
from header_analyzer import analyze_headers
from presets import FAMILY_A_DEFAULT, FAMILY_B_DEFAULT, FAMILY_J_AYAN

ROOT = Path(__file__).resolve().parents[2]
PDF_SEARCH_DIRS = [
    ROOT / "samples" / "pdfs",
    Path(os.environ.get("MEDICRONIS_PDF_DIR", "")),
    Path(r"D:\Downloads\July Closing"),
    Path(r"D:\Downloads"),
]
ZIP_PATH = Path(r"D:\Downloads\July Closing.zip")


def _find_pdf(name: str) -> Path | None:
    for directory in PDF_SEARCH_DIRS:
        if not directory or not directory.is_dir():
            continue
        candidate = directory / name
        if candidate.is_file():
            return candidate
    return None


def _read_pdf(name: str) -> bytes | None:
    path = _find_pdf(name)
    if path is not None:
        return path.read_bytes()
    if ZIP_PATH.is_file():
        with zipfile.ZipFile(ZIP_PATH) as zf:
            for entry in zf.namelist():
                if entry.replace("\\", "/").endswith(name):
                    return zf.read(entry)
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


def _al_shifa_header_15() -> list[list[str | None]]:
    """Family B title block + group row + leaf row, as pdfplumber returns it."""
    return [
        ["Sales and Stock Statement"] + [None] * 14,
        ["From Date:01/07/2026 To Date:30/07/2026"] + [None] * 14,
        [
            "",
            None,
            "OPENING",
            "PURCHASE",
            None,
            "P-RETURN",
            None,
            "E & C",
            "G-SAL",
            "S-RET",
            "NET SALE",
            None,
            None,
            "CLOSING STOCK",
            None,
        ],
        [
            "PR.ID",
            "PRODUCT",
            "QTY+BN",
            "QTY",
            "BNS",
            "QTY",
            "BNS",
            "QTY",
            "QTY",
            "QTY+BN",
            "QTY",
            "BNS",
            "VALUE",
            "QTY",
            "VALUE",
        ],
    ]


def test_synthetic_al_shifa_header_span_prefers_group_row():
    """Family B leaf row carries qty/value, but the group row above must win."""
    table = _al_shifa_header_15() + [
        ["40035", "Aminal120ml Syp(1)", "147", "-", "-", "-", "-", "-", "1", "-", "1", "-", "90", "146", "13,140"]
    ]

    assert find_header_span(table, FAMILY_B_DEFAULT) == (2, 4)

    cols = resolve_label_columns(table, FAMILY_B_DEFAULT)
    assert cols["sales_qty"] == 10
    assert cols["sales_amount"] == 12


def test_synthetic_al_shifa_single_row_header_still_matches():
    """Without a group row above the leaf row, fall back to a single-row header."""
    table = [
        ["Sales and Stock Statement"] + [None] * 4,
        ["From Date:01/07/2026"] + [None] * 4,
        ["PR.ID", "PRODUCT", "QTY", "BNS", "VALUE"],
        ["40035", "Aminal120ml Syp(1)", "1", "-", "90"],
    ]

    assert find_header_span(table, FAMILY_B_DEFAULT) == (2, 3)


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


def _al_shifa_product_table(pdf_bytes: bytes) -> list[list[str | None]]:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        tables = pdf.pages[0].extract_tables() or []
    assert tables, "Expected a product table on page 1"
    return tables[0]


def test_header_span_al_shifa_two_row():
    pdf_path = _find_pdf("AL Shifa Enterprises Jampur.pdf")
    if pdf_path is None:
        pytest.skip("Sample PDF not found: AL Shifa Enterprises Jampur.pdf")

    table = _al_shifa_product_table(pdf_path.read_bytes())
    assert find_header_span(table, FAMILY_B_DEFAULT) == (2, 4)


def test_analyze_headers_al_shifa_grid():
    pdf_path = _find_pdf("AL Shifa Enterprises Jampur.pdf")
    if pdf_path is None:
        pytest.skip("Sample PDF not found: AL Shifa Enterprises Jampur.pdf")

    result = analyze_headers(pdf_path.read_bytes(), FAMILY_B_DEFAULT)

    assert result["headerStructure"] == "title_block_then_table"
    assert len(result["headerGrid"]) == 2

    group_row = [c.upper() for c in result["headerGrid"][0]]
    leaf_row = [c.upper() for c in result["headerGrid"][1]]
    assert "NET SALE" in group_row
    assert "OPENING" in group_row
    assert "PRODUCT" in leaf_row

    groups_upper = [g.upper() for g in result["detectedGroups"]]
    assert "NET SALE" in groups_upper

    net_sale_qty = [
        c for c in result["leafColumns"] if c["group"] == "net sale" and c["leaf"] == "qty"
    ]
    assert [c["col"] for c in net_sale_qty] == [10]


def test_analyze_headers_ayan_uses_geometry_grid():
    data = _read_pdf("Ayan Pharma Taunsa.pdf")
    if data is None:
        pytest.skip("Sample PDF not found: Ayan Pharma Taunsa.pdf")

    result = analyze_headers(data, FAMILY_J_AYAN)

    assert result["headerStructure"] == "grouped_two_row"
    assert result["usesLineParser"] is False
    assert result["colCount"] == 10
    assert len(result["headerGrid"]) == 2
    assert "DESCRIPTION" in result["headerGrid"][0][0].upper()
    assert any("SALES" in cell.upper() for cell in result["headerGrid"][1])
    assert result["suggestedMappings"]["product_name"]["col"] == 0
    assert result["suggestedMappings"]["sales_qty"]["col"] == 4
    assert result["unresolvedFields"] == []
