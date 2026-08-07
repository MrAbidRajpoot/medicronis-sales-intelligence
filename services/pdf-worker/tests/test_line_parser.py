"""Tests for Phase 5 line parser and fallback extraction tiers."""

from __future__ import annotations

import os
import zipfile
from pathlib import Path

import pytest

from extractor import extract_pdf
from line_parser import parse_lines_from_text
from presets import (
    FAMILY_J_AMT,
    FAMILY_J_AYAN,
    FAMILY_J_BUKHARI,
    FAMILY_J_CH_MEDICINE,
    FAMILY_J_ZAFAR,
    FAMILY_Z_HAMZA,
)

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
    if path:
        return path.read_bytes()
    if ZIP_PATH.is_file():
        zip_name = f"July Closing/{name}"
        with zipfile.ZipFile(ZIP_PATH) as zf:
            if zip_name in zf.namelist():
                return zf.read(zip_name)
    return None


class TestLineParser:
    def test_bukhari_stock_statement_line(self):
        line = "AMINAL PLUS SYP 120ML 90.00 79 0 33 5 28 2,700 2 0 49"
        rows = parse_lines_from_text(line, FAMILY_J_BUKHARI)
        assert len(rows) == 1
        assert rows[0]["raw_product_text"] == "AMINAL PLUS SYP 120ML"
        assert rows[0]["quantity"] == 28
        assert rows[0]["gross_value"] == 2700
        assert rows[0]["unit_price"] == 90.0

    def test_ch_medicine_trailing_integers(self):
        line = "CIPAK 200MG/100ML IV INJ INJ. 100ML 146 0 0 146 27 0 119 3240"
        rows = parse_lines_from_text(line, FAMILY_J_CH_MEDICINE)
        assert len(rows) == 1
        assert rows[0]["quantity"] == 27
        assert rows[0]["gross_value"] == 3240

    def test_amt_code_prefix_line(self):
        line = "029AMINAL SYP 120ML 90.00 78 78 5 450 73 6,570"
        rows = parse_lines_from_text(line, FAMILY_J_AMT)
        assert len(rows) == 1
        assert "AMINAL" in rows[0]["raw_product_text"]
        assert rows[0]["quantity"] == 73
        assert rows[0]["gross_value"] == 6570

    def test_zafar_pipe_table_line(self):
        line = "| 1|AMINAL 120ML SYP |1S | 90.00| 115| 150| 15| 13500.00| 280| 139| 13| 12510.00| 128| 11520.00|"
        rows = parse_lines_from_text(line, FAMILY_J_ZAFAR)
        assert len(rows) == 1
        assert rows[0]["raw_product_text"] == "AMINAL 120ML SYP"
        assert rows[0]["quantity"] == 139
        assert rows[0]["gross_value"] == 12510.0
        assert rows[0]["unit_price"] == 90.0


@pytest.mark.parametrize(
    "pdf_name,preset,min_rows,expected_method",
    [
        ("Bukhari Traders MBD.pdf", FAMILY_J_BUKHARI, 20, "line_fallback"),
        ("Ayan Pharma Taunsa.pdf", FAMILY_J_AYAN, 20, "line_fallback"),
        ("Ch Medicine MWL.pdf", FAMILY_J_CH_MEDICINE, 20, "line_fallback"),
    ],
)
def test_family_j_line_fallback_pdfs(pdf_name, preset, min_rows, expected_method):
    data = _read_pdf(pdf_name)
    if data is None:
        pytest.skip(f"Sample PDF not found: {pdf_name}")

    result = extract_pdf(data, template_config=preset)
    assert result["extract_method"] == expected_method
    assert len(result["rows"]) >= min_rows, f"Expected >={min_rows}, got {len(result['rows'])}"
    with_sales = [r for r in result["rows"] if r["quantity"] > 0 or (r["gross_value"] or 0) > 0]
    assert len(with_sales) >= 5


def test_amt_fsd_alternate_or_line_fallback():
    data = _read_pdf("AMT FSD.pdf")
    if data is None:
        pytest.skip("AMT FSD.pdf not found")

    result = extract_pdf(data, template_config=FAMILY_J_AMT)
    assert result["extract_method"] in ("alternate_settings", "line_fallback")
    assert len(result["rows"]) >= 15
    assert result["needs_template_remap"] is False


def test_hamza_alternate_settings_improves_over_default():
    data = _read_pdf("Hamza Medicine TTS.pdf")
    if data is None:
        pytest.skip("Hamza Medicine TTS.pdf not found")

    default = extract_pdf(data, template_config={**FAMILY_Z_HAMZA, "pdfPlumberSettings": None})
    alt = extract_pdf(data, template_config=FAMILY_Z_HAMZA)

    assert len(alt["rows"]) > len(default["rows"])
    assert alt["extract_method"] == "alternate_settings"
