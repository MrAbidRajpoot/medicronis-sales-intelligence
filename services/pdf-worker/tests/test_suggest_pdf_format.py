"""Tests for suggest_pdf_format (Phase 3)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from presets import PDF_FORMAT_PRESETS, PRESET_BY_CODE, _normalize_text, _pick_best_format, _score_preset

ROOT = Path(__file__).resolve().parents[3]
ANALYSIS_PATH = ROOT / "samples" / "pdf-analysis" / "july-closing-analysis.json"

RECOMMENDED = {
    "AIM Pharma HYD.pdf": "fmt-a-ssr-stock-return",
    "Lal Drug Agency Sibbi.pdf": "fmt-a-ssr-stock-return",
    "Reliable Pharma MPK.pdf": "fmt-a-ssr-stock-return",
    "Al Haram Enterprises Kohat.pdf": "fmt-a-ssr-stock-return",
    "AL Shifa Enterprises Jampur.pdf": "fmt-b-medicronis-erp",
    "AQ Enterprises Sargodha.pdf": "fmt-b-medicronis-erp",
    "Al Harmain ENterprises DG Khan.pdf": "fmt-b-medicronis-erp",
    "N&G Enterprises SWL.pdf": "fmt-b-medicronis-erp",
    "Wellcome Pharma alipur.pdf": "fmt-b-medicronis-erp",
    "sHAHZAIB pHARMA Okara30.pdf": "fmt-b-medicronis-erp",
    "Ruman Medicine Promotion RYK.pdf": "fmt-b-medicronis-erp",
    "Ruman Medicine Trade RYK.pdf": "fmt-b-medicronis-erp",
    "Evergreen Enterprises DI Khan.pdf": "fmt-b-medicronis-erp",
    "Al Rehman  Medical Sources Lahore.pdf": "fmt-c-item-desc-net-sales",
    "Al Rehman Medical Sources Lahore.pdf": "fmt-c-item-desc-net-sales",
    "Bashir Pharma Gujranwala.pdf": "fmt-c-item-desc-net-sales",
    "M&C RWP.pdf": "fmt-c-item-desc-net-sales",
    "Pharmarite Distributor Jehlum.pdf": "fmt-c-item-desc-net-sales",
    "Shafiq Medicine Company Khanpur.pdf": "fmt-c-item-desc-net-sales",
    "Haji Nizam & Sons Quetta.pdf": "fmt-c-item-desc-net-sales",
    "Faiz Enterprises Rajanpur.pdf": "fmt-f-simple-sales",
    "Al Makkah Trading Buner.PDF": "fmt-d-product-name-tp-tax",
    "Kamal Medicine Company Timergarah.PDF": "fmt-d-product-name-tp-tax",
    "Medicamp PSW.PDF": "fmt-d-product-name-tp-tax",
    "Umar Medicine Swabi.PDF": "fmt-d-product-name-tp-tax",
    "Hamed Pharma Bannu Promotion.pdf": "fmt-e-trad-rate-net-sale",
    "Hamed Pharma Bannu Trade.pdf": "fmt-e-trad-rate-net-sale",
    "Mehran Traders Mardan.pdf": "fmt-e-trad-rate-net-sale",
    "Punjab Medicine Layyah 22.pdf": "fmt-f-simple-sales",
    "Chishti Pharma Multan.pdf": "fmt-g-code-product-net-sale",
    "Zavion Pharma Jhang.pdf": "fmt-g-code-product-net-sale",
    "Mashal Enterprises Bajaur.pdf": "fmt-h-name-price-sales",
    "Hashmani Health Care Karachi.pdf": "fmt-i-vertical-qty-bon",
    "Ayan Pharma Taunsa.pdf": "fmt-j-no-table",
    "Ch Medicine MWL.pdf": "fmt-j-no-table",
    "Globar Enterprises SKP.PDF": "fmt-j-no-table",
    "Mrwa Enterprises BWP.pdf": "fmt-j-no-table",
    "Noor Khan Mingora.pdf": "fmt-j-no-table",
    "Noor KHan minogra promotion30.pdf": "fmt-j-no-table",
    "Zafar & Sons NWS.pdf": "fmt-j-no-table",
    "New Tawakal Enterprises ABBT.pdf": "fmt-j-no-table",
    "Bukhari Traders MBD.pdf": "fmt-j-no-table",
    "AMT FSD.pdf": "fmt-j-no-table",
    "Hamza Medicine TTS.pdf": "fmt-j-no-table",
    "Life Care Distributor Gujrat.pdf": "fmt-j-no-table",
    "The Hamza Traders Kasur.pdf": "fmt-j-no-table",
}


def test_ten_pdf_format_presets():
    assert len(PDF_FORMAT_PRESETS) == 10
    families = {p["family"] for p in PDF_FORMAT_PRESETS}
    assert families == set("ABCDEFGHIJ")


def test_july_closing_assignments_cover_46_pdfs():
    data = json.loads(ANALYSIS_PATH.read_text(encoding="utf-8"))
    files = [p["file"] for p in data["pdfs"]]
    assert len(files) == 46
    assert len(RECOMMENDED) == 46
    assert set(files) == set(RECOMMENDED.keys())


@pytest.mark.parametrize("filename,expected_code", list(RECOMMENDED.items()))
def test_suggest_from_analysis_metadata(filename: str, expected_code: str):
    """Score presets using header text from july-closing-analysis.json."""
    data = json.loads(ANALYSIS_PATH.read_text(encoding="utf-8"))
    entry = next(p for p in data["pdfs"] if p["file"] == filename)

    text_parts = [entry.get("detected_pattern") or "", entry.get("distributor_hint") or ""]
    header_text = ""
    col_count = None
    if entry.get("tables"):
        t = entry["tables"][0]
        col_count = t.get("cols")
        for row_key in ("header0", "header1"):
            header_text += " ".join(str(x or "") for x in t.get(row_key) or [])

    text_upper = _normalize_text(" ".join(text_parts) + " " + header_text)
    hints = {
        "col_count": col_count,
        "header_text": _normalize_text(header_text),
        "table_count": len(entry.get("tables") or []),
        "has_product_table": bool(
            col_count
            and col_count >= 5
            and any(k in _normalize_text(header_text) for k in ("ITEM", "DESCRIPTION", "PRODUCT", "NAME"))
        ),
    }

    scores = {code: _score_preset(PRESET_BY_CODE[code], text_upper, hints) for code in PRESET_BY_CODE}
    best = _pick_best_format(scores, text_upper, hints)
    assert best == expected_code, (
        f"{filename}: got {best} ({scores[best]:.2f}), expected {expected_code}; scores={scores}"
    )
