"""TemplateConfig presets (Families A–J) and PDF format auto-suggestion."""

from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber

SSR_SKIP = ["total", "group:", "grand total", "page"]

PDFPLUMBER_ALT_SETTINGS: dict[str, Any] = {
    "vertical_strategy": "text",
    "horizontal_strategy": "text",
    "snap_tolerance": 5,
    "join_tolerance": 5,
}

# ---------------------------------------------------------------------------
# Family presets (mirror prisma/pdf-format-presets.ts)
# ---------------------------------------------------------------------------

FAMILY_A_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP,
    "detection": {
        "titlePatterns": [
            "SALES, STOCK & RETURN",
            "SALES STOCK & RETURN",
            "SALES, STOCK AND RETURN",
        ],
        "headerKeywords": ["ITEM", "RATE", "NET SALE"],
    },
    "fields": {
        "product_name": {"col": 0, "group": "ITEM"},
        "unit_price": {"col": 1, "group": "RATE"},
        "returns_qty": {"col": 10, "group": "RETURN", "leaf": "QTY"},
        "sales_qty": {"col": 12, "group": "NET SALE", "leaf": "QTY"},
        "sales_amount": {"col": 14, "group": "NET SALE", "leaf": "AMOUNT"},
        "closing_stock": {"col": 15, "group": "CLOSING", "leaf": "QTY"},
    },
}

FAMILY_A_16COL: dict[str, Any] = {
    **FAMILY_A_DEFAULT,
    "fields": {
        "product_name": {"col": 0, "group": "ITEM"},
        "unit_price": {"col": 1, "group": "RATE"},
        "returns_qty": {"col": 9, "group": "RETURN", "leaf": "QTY"},
        "sales_qty": {"col": 11, "group": "NET SALE", "leaf": "QTY"},
        "sales_amount": {"col": 13, "group": "NET SALE", "leaf": "AMOUNT"},
        "closing_stock": {"col": 14, "group": "CLOSING", "leaf": "QTY"},
    },
}

FAMILY_B_DEFAULT: dict[str, Any] = {
    "headerStructure": "title_block_then_table",
    "skipRowsBeforeHeader": 2,
    "skipRowsContaining": [
        "total",
        "group:",
        "grand total",
        "page",
        "developed by",
        "softronix",
        "net opening value",
        "net purchase value",
        "net sale value",
        "from date:",
        "printing date:",
    ],
    "detection": {
        "titlePatterns": ["SALES AND STOCK STATEMENT", "SALE & STOCK STATMENT"],
        "headerKeywords": ["DESCRIPTION", "NET SALE"],
    },
    "fields": {
        "product_name": {"col": 1, "group": "DESCRIPTION"},
        "unit_price": {"col": 2, "group": "TP"},
        "returns_qty": {"col": 9, "group": "S.RET", "leaf": "QTY"},
        "sales_qty": {"col": 10, "group": "NET SALE", "leaf": "QTY"},
        "sales_amount": {"col": 12, "group": "NET SALE", "leaf": "VALUE"},
        "closing_stock": {"col": 14, "group": "CLOSING", "leaf": "QTY"},
    },
}

FAMILY_C_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": ["total", "group:", "grand total", "page", "sub total", "subtotal"],
    "detection": {
        "headerKeywords": ["ITEM DESCRIPTION", "OPENING BALANCE", "NET SALES"],
    },
    "fields": {
        "product_name": {"col": 0, "group": "Item Description"},
        "unit_price": {"col": 1, "group": "Rate"},
        "returns_qty": {"col": 5, "group": "PURCHASE", "leaf": "Return"},
        "sales_qty": {"col": 7, "group": "SALE", "leaf": "Net Sales"},
        "sales_amount": {"col": 9, "group": "SALE", "leaf": "Value"},
        "closing_stock": {"col": 11, "group": "CLOSING", "leaf": "Balance"},
    },
}

FAMILY_D_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP,
    "pdfPlumberSettings": PDFPLUMBER_ALT_SETTINGS,
    "detection": {
        "headerKeywords": ["PRODUCT NAME", "T.P.", "NET SALE", "SALE RETURN"],
    },
    "fields": {
        "product_name": {"col": 0, "group": "Product Name T.P. Tax"},
        "unit_price": {"col": 0, "group": "Product Name T.P. Tax"},
        "returns_qty": {"col": 9, "group": "Sale Return", "leaf": "Qty."},
        "sales_qty": {"col": 11, "group": "Net Sale", "leaf": "Qty."},
        "sales_amount": {"col": 13, "group": "Net Sale", "leaf": "Value"},
        "closing_stock": {"col": 15, "group": "Closing Balance", "leaf": "Qty."},
    },
}

FAMILY_E_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP,
    "detection": {
        "headerKeywords": ["TRAD RATE", "NET SALE", "OPENING BALANCE"],
    },
    "fields": {
        "product_name": {"col": 0, "group": "DESCRIPTION"},
        "unit_price": {"col": 1, "group": "TRAD RATE"},
        "returns_qty": {"col": 6, "group": "SALE", "leaf": "RETURN"},
        "sales_qty": {"col": 7, "group": "SALE", "leaf": "NET SALE"},
        "sales_amount": {"col": 8, "group": "SALE", "leaf": "AMOUNT"},
    },
}

FAMILY_F_DEFAULT: dict[str, Any] = {
    "headerStructure": "single_row",
    "skipRowsContaining": SSR_SKIP,
    "detection": {
        "headerKeywords": ["DESCRIPTION / PACK", "SALES QTY", "SALE VALUE"],
    },
    "fields": {
        "product_name": {"col": 0, "group": "Description / Pack"},
        "unit_price": {"col": 1, "group": "T.P."},
        "sales_qty": {"col": 4, "group": "Sales Qty"},
        "sales_amount": {"col": 5, "group": "Sale Value"},
        "closing_stock": {"col": 8, "group": "Closing Stock"},
    },
}

FAMILY_G_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP,
    "detection": {
        "headerKeywords": ["PRODUCT DESC", "PRODUCT", "NET SALE", "CODE"],
    },
    "fields": {
        "product_name": {"col": 1, "group": "Product Desc"},
        "unit_price": {"col": 3, "group": "Rate"},
        "returns_qty": {"col": 8, "group": "Ret Sale"},
        "sales_qty": {"col": 9, "group": "Net Sale", "leaf": "Qty"},
        "sales_amount": {"col": 10, "group": "Sale Value", "leaf": "Value"},
        "closing_stock": {"col": 14, "group": "Clos Qty"},
    },
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "salesQtyColumn": 5,
        "salesAmountColumn": 6,
        "minNumericColumns": 7,
        "treatDashAsZero": True,
    },
}

FAMILY_H_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP,
    "detection": {
        "headerKeywords": ["NAME", "PRICE", "OPEN STOCK", "NET SALE"],
    },
    "fields": {
        "product_name": {"col": 1, "group": "NAME"},
        "unit_price": {"col": 2, "group": "PRICE"},
        "sales_qty": {"col": 11, "group": "NET SALE"},
        "sales_amount": {"col": 13, "group": "SALE VALUES"},
        "closing_stock": {"col": 15, "group": "TRANSFER"},
    },
}

FAMILY_I_DEFAULT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "skipRowsContaining": SSR_SKIP + ["division / group", "net sold bonus", "grand total"],
    "detection": {
        "headerKeywords": ["NET SALES", "QTY.BON AMOUNT", "SALES RETURN"],
    },
    "fields": {
        "product_name": {"col": 0},
        "returns_qty": {"col": 4, "group": "SALES RETURN", "leaf": "QTY. BO"},
        "sales_qty": {"col": 5, "group": "NET SALES", "leaf": "QTY.BON AMOUNT"},
        "sales_amount": {"col": 5, "group": "NET SALES", "leaf": "QTY.BON AMOUNT"},
    },
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 4,
        "salesAmountColumn": 5,
        "minNumericColumns": 6,
    },
}

FAMILY_J_DEFAULT: dict[str, Any] = {
    "headerStructure": "line_fallback",
    "tableExtractionDisabled": True,
    "preferGeometry": True,
    "skipRowsContaining": ["total", "page", "grand total"],
    "detection": {
        "titlePatterns": [
            "STOCK STATEMENT",
            "SALE & STOCK",
            "SALE AND STOCK",
            "SALES & STOCK REPORT",
        ],
        "noTableIndicator": True,
    },
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 4,
        "salesAmountColumn": 5,
    },
    "fields": {},
}

FAMILY_J_BUKHARI: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 4,
        "salesAmountColumn": 5,
        "minNumericColumns": 6,
        "fieldMappings": {
            "product_name": {"kind": "before_rate"},
            "unit_price": {"kind": "rate_pattern"},
            "sales_qty": {"kind": "after_rate_index", "index": 4},
            "sales_amount": {"kind": "after_rate_index", "index": 5},
            "closing_stock": {"kind": "after_rate_index", "index": 8},
        },
    },
}

FAMILY_J_AYAN: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "preferGeometry": True,
    # Geometry columns: Description/Pack | T.P. | Opening | Purchase | SalesQty | SaleValue | Bonus | S.E.P. | Closing | ClosingValue
    "fields": {
        "product_name": {"col": 0, "group": "Description"},
        "unit_price": {"col": 1, "group": "T.P."},
        "sales_qty": {"col": 4},
        "sales_amount": {"col": 5},
        "closing_stock": {"col": 8},
    },
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 2,
        "salesAmountColumn": 3,
        "minNumericColumns": 4,
        # Product name length varies across rows — prefer after_rate_index over fixed tokens.
        # Sample: AMINAL SYP 120ML 90.00 55 0 4 360 0 0 51 4590
        "fieldMappings": {
            "product_name": {"kind": "before_rate"},
            "unit_price": {"kind": "rate_pattern"},
            "sales_qty": {"kind": "after_rate_index", "index": 2},
            "sales_amount": {"kind": "after_rate_index", "index": 3},
            "closing_stock": {"kind": "after_rate_index", "index": 6},
        },
    },
}

FAMILY_J_CH_MEDICINE: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "lineParser": {
        "enabled": True,
        "mode": "trailing_integers",
        "trailingNumericCount": 8,
        "salesQtyColumn": 4,
        "salesAmountColumn": 7,
    },
}

FAMILY_J_AMT: dict[str, Any] = {
    "headerStructure": "grouped_two_row",
    "tableExtractionDisabled": False,
    "skipRowsContaining": ["total", "page", "grand total", "trade group", "medicronics pharma"],
    "pdfPlumberSettings": PDFPLUMBER_ALT_SETTINGS,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "salesQtyColumn": 4,
        "salesAmountColumn": 5,
        "minNumericColumns": 5,
    },
    "fields": {
        "product_name": {"col": 1, "group": "Product"},
        "sales_qty": {"col": 10, "group": "Net Sale", "leaf": "Qty"},
        "sales_amount": {"col": 11, "group": "Net Sale", "leaf": "Value"},
    },
}

FAMILY_Z_HAMZA: dict[str, Any] = {
    **FAMILY_F_DEFAULT,
    "pdfPlumberSettings": PDFPLUMBER_ALT_SETTINGS,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "treatDashAsZero": True,
        "salesQtyColumn": 2,
        "salesAmountColumn": 3,
        "minNumericColumns": 4,
    },
}

FAMILY_Z_EVERGREEN: dict[str, Any] = {
    **FAMILY_E_DEFAULT,
    "tableExtractionDisabled": True,
    "headerStructure": "line_fallback",
    "preferGeometry": True,
    "skipRowsContaining": SSR_SKIP + ["sale & stock statment", "email:", "land line"],
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "salesQtyColumn": 3,
        "salesAmountColumn": 5,
        "minNumericColumns": 6,
    },
}

FAMILY_J_GLOBAL: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 1,
        "salesAmountColumn": 5,
        "minNumericColumns": 3,
        "fieldMappings": {
            "product_name": {"kind": "before_rate"},
            "unit_price": {"kind": "rate_pattern"},
            "sales_qty": {"kind": "after_rate_index", "index": 1},
            "sales_amount": {"kind": "after_rate_index", "index": 5},
        },
    },
}

FAMILY_J_LIFE_CARE: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "skipRowsContaining": ["total", "page", "grand total", "medicine name", "sr #"],
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "salesQtyColumn": 6,
        "salesAmountColumn": 7,
        "minNumericColumns": 8,
        "treatDashAsZero": True,
    },
}

FAMILY_J_ZAFAR: dict[str, Any] = {
    **FAMILY_J_DEFAULT,
    "skipRowsContaining": ["total", "page", "grand total", "company wise", "company name"],
    "lineParser": {
        "enabled": True,
        "mode": "pipe_table",
        "productColumn": 1,
        "rateColumn": 3,
        "salesQtyColumn": 9,
        "salesAmountColumn": 11,
    },
}

FAMILY_I_HASHMANI: dict[str, Any] = {
    **FAMILY_I_DEFAULT,
    "tableExtractionDisabled": True,
    "headerStructure": "line_fallback",
    "preferGeometry": True,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "salesQtyColumn": 4,
        "salesAmountColumn": 5,
        "minNumericColumns": 6,
    },
}

FAMILY_G_ZAVION: dict[str, Any] = {
    **FAMILY_G_DEFAULT,
    "tableExtractionDisabled": True,
    "headerStructure": "line_fallback",
    "preferGeometry": True,
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "salesQtyColumn": 5,
        "salesAmountColumn": 6,
        "minNumericColumns": 7,
        "treatDashAsZero": True,
    },
}

FAMILY_D_AL_MAKKAH: dict[str, Any] = {
    **FAMILY_D_DEFAULT,
    "tableExtractionDisabled": True,
    "headerStructure": "line_fallback",
    "preferGeometry": True,
    "skipRowsContaining": SSR_SKIP + ["medicronis", "product name"],
    "lineParser": {
        "enabled": True,
        "mode": "rate_and_columns",
        "codePrefix": True,
        "ratePattern": r"\d+\.\d{2,5}",
        "salesQtyColumn": 11,
        "salesAmountColumn": 12,
        "minNumericColumns": 13,
        "treatDashAsZero": True,
    },
}

PDF_FORMAT_PRESETS: list[dict[str, Any]] = [
    {"code": "fmt-a-ssr-stock-return", "family": "A", "defaultConfig": FAMILY_A_DEFAULT},
    {"code": "fmt-b-medicronis-erp", "family": "B", "defaultConfig": FAMILY_B_DEFAULT},
    {"code": "fmt-c-item-desc-net-sales", "family": "C", "defaultConfig": FAMILY_C_DEFAULT},
    {"code": "fmt-d-product-name-tp-tax", "family": "D", "defaultConfig": FAMILY_D_DEFAULT},
    {"code": "fmt-e-trad-rate-net-sale", "family": "E", "defaultConfig": FAMILY_E_DEFAULT},
    {"code": "fmt-f-simple-sales", "family": "F", "defaultConfig": FAMILY_F_DEFAULT},
    {"code": "fmt-g-code-product-net-sale", "family": "G", "defaultConfig": FAMILY_G_DEFAULT},
    {"code": "fmt-h-name-price-sales", "family": "H", "defaultConfig": FAMILY_H_DEFAULT},
    {"code": "fmt-i-vertical-qty-bon", "family": "I", "defaultConfig": FAMILY_I_DEFAULT},
    {"code": "fmt-j-no-table", "family": "J", "defaultConfig": FAMILY_J_DEFAULT},
]

PRESET_BY_CODE: dict[str, dict[str, Any]] = {p["code"]: p for p in PDF_FORMAT_PRESETS}


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def _table_hints_from_pdf(pdf_bytes: bytes) -> dict[str, Any]:
    """Extract table column count and header text for scoring."""
    col_count: int | None = None
    header_text = ""
    table_count = 0
    has_product_table = False

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:2]:
            for table in page.extract_tables() or []:
                if not table:
                    continue
                table_count += 1
                width = max(len(r) for r in table)
                if col_count is None or width > col_count:
                    col_count = width
                for row in table[:2]:
                    header_text += " " + " ".join(str(c or "") for c in row)

    header_upper = _normalize_text(header_text)
    if col_count and col_count >= 5:
        product_kw = ("ITEM", "DESCRIPTION", "PRODUCT", "NAME", "CODE")
        qty_kw = ("QTY", "NET SALE", "NET SALES", "SALE VALUE")
        has_product_table = any(k in header_upper for k in product_kw) and any(
            k in header_upper for k in qty_kw
        )

    return {
        "col_count": col_count,
        "header_text": header_upper,
        "table_count": table_count,
        "has_product_table": has_product_table,
    }


def _score_preset(
    preset: dict[str, Any],
    text_upper: str,
    hints: dict[str, Any],
) -> float:
    config = preset["defaultConfig"]
    detection = config.get("detection") or {}
    score = 0.0
    header_upper = hints.get("header_text") or ""
    col_count = hints.get("col_count")
    code = preset["code"]

    erp_statement = "SALES AND STOCK STATEMENT" in text_upper or "SALES AND STOCK STATEMENT" in header_upper

    title_hits = [
        0.45
        for pattern in detection.get("titlePatterns") or []
        if pattern.upper() in text_upper or pattern.upper() in header_upper
    ]
    if title_hits and not (code == "fmt-j-no-table" and erp_statement):
        score += max(title_hits)

    keywords = detection.get("headerKeywords") or []
    if keywords:
        matched = sum(
            1 for kw in keywords if kw.upper() in text_upper or kw.upper() in header_upper
        )
        if matched >= 2:
            score += 0.15 * matched
        elif matched == 1 and len(keywords) == 1:
            score += 0.2

    if code == "fmt-a-ssr-stock-return":
        if "ITEM" in header_upper and "NET SALE" in header_upper:
            score += 0.35
        if col_count in (16, 17):
            score += 0.15

    elif code == "fmt-b-medicronis-erp":
        if erp_statement:
            score += 0.45
        if "DESCRIPTION" in header_upper and "NET SALE" in header_upper:
            score += 0.2

    elif code == "fmt-c-item-desc-net-sales":
        if "ITEM DESCRIPTION" in header_upper:
            score += 0.4
        elif "DESCRIPTION" in header_upper and ("NET SALES" in header_upper or "SALE VALUE" in header_upper):
            score += 0.25

    elif code == "fmt-d-product-name-tp-tax":
        if "PRODUCT NAME" in header_upper and col_count == 19:
            score += 0.45

    elif code == "fmt-e-trad-rate-net-sale":
        if (
            "TRAD RATE" in header_upper
            or "TRADE RATE" in header_upper
            or "TRADE RATE" in text_upper
        ) and "NET SALE" in header_upper:
            score += 0.45

    elif code == "fmt-f-simple-sales":
        if ("DESCRIPTION / PACK" in header_upper or "DESCRIPTION PACK" in header_upper) and (
            "SALES QTY" in header_upper or "SALE VALUE" in header_upper
        ):
            score += 0.45

    elif code == "fmt-g-code-product-net-sale":
        if ("PRODUCT DESC" in header_upper or "PRODUCT" in header_upper) and "NET SALE" in header_upper:
            score += 0.35

    elif code == "fmt-h-name-price-sales":
        if "OPEN STOCK" in header_upper and "NAME" in header_upper and col_count == 21:
            score += 0.45

    elif code == "fmt-i-vertical-qty-bon":
        if "QTY.BON AMOUNT" in header_upper or "QTY.BON AMOUNT" in text_upper:
            score += 0.5

    elif code == "fmt-j-no-table":
        if erp_statement:
            score = min(score, 0.15)
        elif detection.get("noTableIndicator"):
            if hints["table_count"] == 0 and not text_upper.strip():
                score += 0.55
            elif hints["table_count"] == 0 and text_upper.strip():
                score += 0.55
            elif hints.get("has_product_table"):
                score = min(score, 0.1)
            elif not hints.get("has_product_table") and text_upper.strip() and hints["table_count"] == 0:
                score += 0.4

    return min(score, 1.0)


def _pick_best_format(scores: dict[str, float], text_upper: str, hints: dict[str, Any]) -> str:
    """Prefer structural table families over J when scores are close."""
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_code, best_score = ranked[0]

    if not text_upper.strip() and hints.get("table_count", 0) == 0:
        return "fmt-j-no-table"

    if best_code == "fmt-j-no-table" and len(ranked) > 1:
        second_code, second_score = ranked[1]
        if second_score >= 0.35 and best_score - second_score <= 0.1:
            return second_code

    if best_score < 0.2:
        return "fmt-j-no-table"

    return best_code


def suggest_pdf_format(pdf_bytes: bytes) -> dict[str, Any]:
    """
    Suggest the best PdfFormat preset for raw PDF bytes.
    Returns { code, family, confidence }.
    """
    text_upper = ""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            if i >= 3:
                break
            text_upper += " " + (page.extract_text() or "")
    text_upper = _normalize_text(text_upper)

    hints = _table_hints_from_pdf(pdf_bytes)

    scores: dict[str, float] = {}
    for preset in PDF_FORMAT_PRESETS:
        scores[preset["code"]] = _score_preset(preset, text_upper, hints)

    best_code = _pick_best_format(scores, text_upper, hints)
    confidence = round(scores[best_code], 2)

    return {
        "code": best_code,
        "family": PRESET_BY_CODE[best_code]["family"],
        "confidence": confidence,
        "scores": scores,
    }


def preset_config_for_code(code: str, col_count: int | None = None) -> dict[str, Any]:
    """Return TemplateConfig dict for a PdfFormat code, applying width variants."""
    preset = PRESET_BY_CODE.get(code)
    if not preset:
        return dict(FAMILY_J_DEFAULT)
    if code == "fmt-a-ssr-stock-return" and col_count == 16:
        return dict(FAMILY_A_16COL)
    return dict(preset["defaultConfig"])
