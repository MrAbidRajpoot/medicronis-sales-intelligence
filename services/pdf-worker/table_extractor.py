"""Config-driven table row extraction."""

from __future__ import annotations

import re
from typing import Any

from column_resolver import find_header_span, label_resolution_ok, resolve_with_data_start
from pdf_text import extract_cell, normalize_header, parse_number, should_skip_row

# Output keys (ExtractedRowOut shape)
FIELD_TO_OUTPUT: dict[str, str] = {
    "product_name": "raw_product_text",
    "sales_qty": "quantity",
    "sales_amount": "gross_value",
    "unit_price": "unit_price",
    "returns_qty": "returns_qty",
    "closing_stock": "closing_stock",
}

REQUIRED_FIELDS = ("product_name", "sales_qty", "sales_amount")


def _is_numeric_only_product(text: str) -> bool:
    return bool(re.fullmatch(r"[\d,\.\s\-]+", text))


def _is_group_row(product_text: str) -> bool:
    return product_text.lower().startswith("group:")


def _build_row(
    raw_row: list[str | None],
    col_map: dict[str, int],
    source: str,
) -> dict[str, Any] | None:
    product_col = col_map.get("product_name")
    product_text = extract_cell(raw_row, product_col)
    if not product_text:
        return None
    if _is_group_row(product_text):
        return None
    if _is_numeric_only_product(product_text):
        return None

    qty = parse_number(extract_cell(raw_row, col_map.get("sales_qty")))
    gross = parse_number(extract_cell(raw_row, col_map.get("sales_amount")))
    unit_price = parse_number(extract_cell(raw_row, col_map.get("unit_price")))
    returns = parse_number(extract_cell(raw_row, col_map.get("returns_qty")))
    closing = parse_number(extract_cell(raw_row, col_map.get("closing_stock")))

    if qty is None:
        qty = 0.0
    if gross is None and unit_price is not None and qty:
        gross = qty * unit_price
    if gross is None:
        gross = 0.0

    return {
        "raw_product_text": product_text,
        "raw_product_code": None,
        "quantity": qty,
        "unit_price": unit_price,
        "gross_value": gross,
        "returns_qty": returns,
        "closing_stock": closing,
        "transaction_date": None,
        "customer_name": None,
        "metadata": {"source": source},
    }


def extract_rows_from_table(
    table: list[list[str | None]], config: dict[str, Any]
) -> list[dict[str, Any]]:
    """
    Extract product rows from a pdfplumber table using TemplateConfig.
    Required fields: product_name, sales_qty, sales_amount (zero allowed).
    """
    if not table:
        return []

    fields = config.get("fields") or {}
    skip_terms: list[str] = list(config.get("skipRowsContaining") or [])
    source = config.get("_source") or "config_driven"

    col_map, data_start = resolve_with_data_start(table, config)

    if col_map.get("product_name") is None:
        return []

    for req in REQUIRED_FIELDS:
        if req not in col_map:
            return []

    rows: list[dict[str, Any]] = []
    for raw_row in table[data_start:]:
        if should_skip_row(raw_row, skip_terms):
            continue
        parsed = _build_row(raw_row, col_map, source)
        if parsed:
            rows.append(parsed)

    return rows


def is_likely_data_table(table: list[list[str | None]], config: dict[str, Any]) -> bool:
    """True when table has a recognizable header or looks like continuation data."""
    if find_header_span(table, config) is not None:
        return True
    fields = config.get("fields") or {}
    product_col = fields.get("product_name", {}).get("col")
    if product_col is None:
        return False
    for raw_row in table[:3]:
        product = extract_cell(raw_row, product_col)
        if product and not _is_group_row(product) and not _is_numeric_only_product(product):
            norm = normalize_header(product)
            if norm not in ("item", "item description", "product", "description"):
                return True
    return False
