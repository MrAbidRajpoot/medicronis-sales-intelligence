"""Tests for free geometry (x/y) PDF table builder."""

from __future__ import annotations

import io
import os
import zipfile
from pathlib import Path

import pdfplumber
import pytest

from extractor import extract_pdf
from geometry_table import extract_geometry_table
from presets import FAMILY_J_AYAN

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


def test_ayan_geometry_table_multi_word_products():
    data = _read_pdf("Ayan Pharma Taunsa.pdf")
    if data is None:
        pytest.skip("Ayan Pharma Taunsa.pdf not found")

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        table = extract_geometry_table(pdf.pages[0])

    assert len(table) >= 30
    assert max(len(r) for r in table) >= 3

    aminal = next(
        (r for r in table if any(c and "AMINAL" in str(c).upper() for c in r)),
        None,
    )
    assert aminal is not None
    product = next(c for c in aminal if c and "AMINAL" in str(c).upper())
    assert " " in product.strip(), f"expected multi-word product cell, got {product!r}"
    assert "120ML" in product.upper() or "SYP" in product.upper()


def test_tawakal_geometry_empty_no_chars():
    data = _read_pdf("New Tawakal Enterprises ABBT.pdf")
    if data is None:
        pytest.skip("New Tawakal Enterprises ABBT.pdf not found")

    with pdfplumber.open(io.BytesIO(data)) as pdf:
        assert len(pdf.pages[0].chars or []) == 0
        table = extract_geometry_table(pdf.pages[0])

    assert table == []


def test_ayan_extract_uses_geometry_method():
    data = _read_pdf("Ayan Pharma Taunsa.pdf")
    if data is None:
        pytest.skip("Ayan Pharma Taunsa.pdf not found")

    result = extract_pdf(data, template_config=FAMILY_J_AYAN)
    assert result["extract_method"] == "geometry"
    assert len(result["rows"]) >= 30
    aminal = next(
        (r for r in result["rows"] if "AMINAL" in (r["raw_product_text"] or "").upper()),
        None,
    )
    assert aminal is not None
    assert " " in (aminal["raw_product_text"] or "")
