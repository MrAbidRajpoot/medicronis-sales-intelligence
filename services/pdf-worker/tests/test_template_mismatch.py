"""Tests for template mismatch detection (Phase 9)."""

from __future__ import annotations

import copy

from column_resolver import label_resolution_ok, resolve_label_columns
from presets import FAMILY_A_DEFAULT


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


def _make_data_row(product: str, qty: str, amount: str) -> list[str | None]:
    row: list[str | None] = [product, "90.00"] + [""] * 15
    row[12] = qty
    row[14] = amount
    return row


class TestTemplateMismatchDetection:
    def test_bad_label_mapping_fails_label_resolution(self):
        table = _aim_header_17()
        bad_config = copy.deepcopy(FAMILY_A_DEFAULT)
        bad_config["fields"]["sales_qty"]["group"] = "NONEXISTENT GROUP"
        bad_config["fields"]["sales_qty"]["leaf"] = "FAKE LEAF"

        assert label_resolution_ok(table, bad_config) is False
        cols = resolve_label_columns(table, bad_config)
        assert "sales_qty" not in cols

    def test_good_mapping_passes_label_resolution(self):
        table = _aim_header_17()
        assert label_resolution_ok(table, FAMILY_A_DEFAULT) is True

    def test_unrecognizable_layout_fails_label_resolution(self):
        """Simulated layout change: saved template cannot resolve required header labels."""
        table = [["UNKNOWN", "LAYOUT"], ["Widget A", "10", "100"]]
        assert label_resolution_ok(table, FAMILY_A_DEFAULT) is False

    def test_synthetic_extract_flags_template_resolution_failure(self):
        """Bad saved template should fail label-path resolution for daily upload."""
        header = _aim_header_17()
        bad_config = copy.deepcopy(FAMILY_A_DEFAULT)
        bad_config["fields"]["product_name"]["group"] = "WRONG"
        bad_config["fields"]["product_name"]["leaf"] = "HEADER"

        table = header + [_make_data_row("TEST PRODUCT", "5", "500")]
        assert label_resolution_ok(table, bad_config) is False
