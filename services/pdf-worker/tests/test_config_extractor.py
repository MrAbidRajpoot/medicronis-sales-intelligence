"""Tests for config-driven PDF extraction (Phase 2)."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from column_resolver import resolve_field_columns
from extractor import extract_pdf
from presets import FAMILY_A_16COL, FAMILY_A_DEFAULT, FAMILY_B_DEFAULT, FAMILY_C_DEFAULT
from table_extractor import extract_rows_from_table

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


def _al_haram_header_16() -> list[list[str | None]]:
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
            "QTY",
            "BONUS",
            "QTY",
            "BONUS",
            "QTY",
            "BONUS",
            "AMOUNT",
            "QTY",
            "AMT",
        ],
    ]


def _pad_row(values: list[str | None], width: int) -> list[str | None]:
    row = list(values)
    while len(row) < width:
        row.append("")
    return row


class TestColumnResolver:
    def test_aim_17col_resolves_net_sale_by_label_not_fixed_col(self):
        table = _aim_header_17()
        cols = resolve_field_columns(table, FAMILY_A_DEFAULT)
        assert cols["sales_qty"] == 12
        assert cols["sales_amount"] == 14
        assert cols["product_name"] == 0

    def test_al_haram_16col_resolves_net_sale_by_label(self):
        table = _al_haram_header_16()
        cols = resolve_field_columns(table, FAMILY_A_16COL)
        assert cols["sales_qty"] == 11
        assert cols["sales_amount"] == 13
        assert cols["returns_qty"] == 9

    def test_label_fail_falls_back_to_config_col(self):
        table = [["FOO", "BAR"], ["BAZ", "QUX"]]
        cols = resolve_field_columns(table, FAMILY_A_DEFAULT)
        assert cols["sales_qty"] == 12
        assert cols["sales_amount"] == 14


class TestTableExtractor:
    def test_extracts_rows_with_zero_qty_allowed(self):
        header = _aim_header_17()
        data = _pad_row(
            ["ZERO SALE PRODUCT", "100.00", "", "", "", "", "", "", "", "", "", "", "0", "", "0", "", ""],
            17,
        )
        table = header + [data]
        rows = extract_rows_from_table(table, FAMILY_A_DEFAULT)
        assert len(rows) == 1
        assert rows[0]["raw_product_text"] == "ZERO SALE PRODUCT"
        assert rows[0]["quantity"] == 0.0
        assert rows[0]["gross_value"] == 0.0

    def test_skips_group_and_numeric_only_rows(self):
        header = _aim_header_17()
        group_row = _pad_row(
            ["Group: ANTIBIOTICS", "0", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
            17,
        )
        numeric_row = _pad_row(
            ["1,234.56", "100", "", "", "", "", "", "", "", "", "", "", "5", "", "500", "", ""],
            17,
        )
        product_row = _pad_row(
            ["CLAN PLUS SYP 120ML", "90.00", "", "", "", "", "", "", "", "", "", "", "10", "", "900", "", ""],
            17,
        )
        table = header + [group_row, numeric_row, product_row]
        rows = extract_rows_from_table(table, FAMILY_A_DEFAULT)
        assert len(rows) == 1
        assert rows[0]["raw_product_text"] == "CLAN PLUS SYP 120ML"
        assert rows[0]["quantity"] == 10.0
        assert rows[0]["gross_value"] == 900.0


@pytest.mark.parametrize(
    "pdf_name,min_rows,preset",
    [
        ("AIM Pharma HYD.pdf", 38, FAMILY_A_DEFAULT),
        ("Al Haram Enterprises Kohat.pdf", 26, FAMILY_A_16COL),
    ],
)
def test_family_a_pdf_extraction(pdf_name: str, min_rows: int, preset: dict):
    pdf_path = _find_pdf(pdf_name)
    if pdf_path is None:
        pytest.skip(f"Sample PDF not found: {pdf_name}")

    data = pdf_path.read_bytes()
    result = extract_pdf(data, template_config=preset)
    rows = result["rows"]

    assert len(rows) >= min_rows, f"Expected >={min_rows} rows, got {len(rows)}"

    with_sales = [r for r in rows if r["quantity"] > 0 or (r["gross_value"] or 0) > 0]
    assert len(with_sales) >= min_rows - 5

    for row in with_sales[:5]:
        assert row["raw_product_text"]
        assert isinstance(row["quantity"], (int, float))
        assert isinstance(row["gross_value"], (int, float))


def _make_ssr_data_row(product: str, qty: str, amount: str, width: int) -> list[str | None]:
    """Build a Family A data row with NET SALE qty/amount at 17-col positions."""
    row: list[str | None] = [product, "90.00"] + [""] * (width - 2)
    if width >= 17:
        row[12] = qty
        row[14] = amount
    elif width >= 16:
        row[11] = qty
        row[13] = amount
    return row


def test_synthetic_aim_multi_table_meets_row_threshold():
    """Integration test without PDF: two SSR tables like AIM Pharma HYD layout."""
    header = _aim_header_17()
    table1 = header + [_make_ssr_data_row(f"PRODUCT {i}", str(i), str(i * 100), 17) for i in range(1, 10)]
    table2 = header + [_make_ssr_data_row(f"PRODUCT {i}", str(i), str(i * 100), 17) for i in range(10, 40)]
    all_rows: list[dict] = []
    for table in (table1, table2):
        all_rows.extend(extract_rows_from_table(table, FAMILY_A_DEFAULT))
    assert len(all_rows) >= 38
    assert all(r["quantity"] > 0 for r in all_rows[:5])


@pytest.mark.parametrize(
    "pdf_name,min_rows,preset,format_code",
    [
        ("AL Shifa Enterprises Jampur.pdf", 15, FAMILY_B_DEFAULT, "fmt-b-medicronis-erp"),
        ("Bashir Pharma Gujranwala.pdf", 15, FAMILY_C_DEFAULT, "fmt-c-item-desc-net-sales"),
    ],
)
def test_family_b_c_pdf_extraction(pdf_name: str, min_rows: int, preset: dict, format_code: str):
    pdf_path = _find_pdf(pdf_name)
    if pdf_path is None:
        pytest.skip(f"Sample PDF not found: {pdf_name}")

    data = pdf_path.read_bytes()
    result = extract_pdf(data, template_config=preset, format_code=format_code)
    rows = result["rows"]

    assert result["suggested_format_code"] == format_code or result["template_used"] == "config"
    assert len(rows) >= min_rows, f"Expected >={min_rows} rows, got {len(rows)}"
    assert result["extract_method"] in ("table", "alternate_settings")
    assert result["needs_template_remap"] is False


def test_auto_suggest_without_template_config():
    pdf_path = _find_pdf("AIM Pharma HYD.pdf")
    if pdf_path is None:
        pytest.skip("Sample PDF not found: AIM Pharma HYD.pdf")

    data = pdf_path.read_bytes()
    result = extract_pdf(data)

    assert result["suggested_format_code"] == "fmt-a-ssr-stock-return"
    assert len(result["rows"]) >= 20
    assert result["extract_method"] in ("table", "alternate_settings", "line_fallback")
