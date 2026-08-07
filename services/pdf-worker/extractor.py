from __future__ import annotations

import io
import json
import re
from pathlib import Path
from typing import Any

import pdfplumber

TEMPLATES_DIR = Path(__file__).parent / "templates"


def load_template(code: str) -> dict[str, Any]:
    path = TEMPLATES_DIR / f"{code}.json"
    if not path.exists():
        path = TEMPLATES_DIR / "generic.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_all_templates() -> list[dict[str, Any]]:
    templates = []
    for path in TEMPLATES_DIR.glob("*.json"):
        if path.stem != "generic":
            with open(path, encoding="utf-8") as f:
                templates.append(json.load(f))
    return templates


def read_pdf_text(pdf_bytes: bytes, max_pages: int = 3) -> str:
    parts: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages):
            if i >= max_pages:
                break
            parts.append(page.extract_text() or "")
    return "\n".join(parts)


def get_page_count(pdf_bytes: bytes) -> int:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return len(pdf.pages)


def extract_distributor_name(pdf_bytes: bytes) -> str | None:
    """Read distributor name from the first line of SSR-style reports."""
    text = read_pdf_text(pdf_bytes, max_pages=1)
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if "PAGE NO" in line.upper() or "PRINTED ON" in line.upper():
            # e.g. "AIM PHARMA, HYDERABAD Page No 1 Printed On: ..."
            name = re.split(r"\s+Page\s+No", line, flags=re.I)[0].strip()
            name = re.split(r"\s+Printed\s+On", name, flags=re.I)[0].strip()
            if name and len(name) > 3:
                return name
        if line.upper().startswith("GROUP:"):
            continue
        if any(k in line.upper() for k in ("SALES", "STOCK", "RETURN REPORT", "FROM:", "INSTITUTION")):
            continue
        if len(line) > 3 and not line[0].isdigit():
            return line
    return None


def detect_distributor(pdf_bytes: bytes, hint_code: str | None = None) -> tuple[str, dict[str, Any]]:
    if hint_code:
        template = load_template(hint_code)
        if template.get("distributor_code") != "generic":
            return hint_code, template

    text = read_pdf_text(pdf_bytes).upper()
    for tmpl in load_all_templates():
        for pattern in tmpl.get("detection", {}).get("title_patterns", []):
            if pattern.upper() in text:
                code = tmpl["distributor_code"]
                return code, load_template(code)

    return "generic", load_template("generic")


def _normalize_header(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _find_column_index(headers: list[str], aliases: list[str]) -> int | None:
    normalized_headers = [_normalize_header(h) for h in headers]
    for alias in aliases:
        alias_norm = _normalize_header(alias)
        for i, header in enumerate(normalized_headers):
            if alias_norm == header:
                return i
    for alias in aliases:
        alias_norm = _normalize_header(alias)
        if len(alias_norm) < 4:
            continue
        for i, header in enumerate(normalized_headers):
            if alias_norm in header:
                return i
    return None


def _parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in ("-", "—", "–"):
        return None
    # "146 -" / "48 -" → treat trailing dash as part of stock notation, keep leading number
    m = re.match(r"^([\d,]+(?:\.\d+)?)\s*[-–—]?\s*$", text)
    if m:
        text = m.group(1)
    cleaned = re.sub(r"[^\d.\-]", "", text.replace(",", ""))
    if not cleaned or cleaned in (".", "-", "-."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _should_skip_row(row: list[str | None], skip_terms: list[str]) -> bool:
    joined = " ".join(str(c or "") for c in row).lower()
    if not joined.strip():
        return True
    return any(term.lower() in joined for term in skip_terms)


def _extract_cell(row: list[str | None], index: int | None) -> str | None:
    if index is None or index >= len(row):
        return None
    val = row[index]
    if val is None:
        return None
    text = str(val).strip()
    return text or None


def _is_ssr_stock_return_table(table: list[list[str | None]]) -> bool:
    if not table or len(table) < 3:
        return False
    row0 = [_normalize_header(c) for c in table[0]]
    if not row0 or row0[0] != "item":
        return False
    if "rate" not in row0:
        return False
    # Second header row contains NET SALE / AMOUNT sub-columns
    if len(table) > 1:
        row1_text = " ".join(_normalize_header(c) for c in table[1] if c)
        if "amount" in row1_text or "qty" in row1_text:
            return True
    return "net sale" in " ".join(row0)


def _ssr_template_for_table(table: list[list[str | None]]) -> dict[str, Any]:
    col_count = max(len(r) for r in table) if table else 0
    if col_count <= 16:
        return load_template("ssr-stock-return-16col")
    return load_template("ssr-stock-return")


def _is_medicronis_erp_statement_table(table: list[list[str | None]]) -> bool:
    if not table or len(table) < 2:
        return False
    for row in table[:4]:
        joined = " ".join(_normalize_header(c) for c in row if c)
        if "sales and stock statement" in joined:
            return True
    if _find_erp_header_row(table) is not None:
        return True
    return _is_erp_data_table(table)


def _find_erp_header_row(table: list[list[str | None]]) -> int | None:
    for i, row in enumerate(table[:8]):
        if not row:
            continue
        c0 = _normalize_header(row[0])
        c1 = _normalize_header(row[1] if len(row) > 1 else None)
        if c0 in ("pr.id", "pr id", "id") and ("product" in c1 or "description" in c1):
            return i
    return None


def _is_erp_data_table(table: list[list[str | None]]) -> bool:
    if not table or len(table) < 1:
        return False
    row0 = table[0]
    if not row0:
        return False
    c0 = str(row0[0] or "").strip()
    c1 = str(row0[1] or "").strip() if len(row0) > 1 else ""
    if not c0 or not c1:
        return False
    if _normalize_header(c0) in ("pr.id", "pr id", "id", "sales and stock statement"):
        return False
    if _normalize_header(c1) in ("product", "product name", "description"):
        return False
    # First col is numeric product id only (not "100011 PRODUCT NAME" combined cells)
    return bool(re.fullmatch(r"\d+\*?", c0)) and len(c1) > 3


def _find_erp_net_sale_columns(
    table: list[list[str | None]], header_idx: int
) -> tuple[int | None, int | None, int | None]:
    """Return (product_col, qty_col, value_col) for Medicronis ERP statement tables."""
    header = [str(c or "") for c in table[header_idx]]
    group = [str(c or "") for c in table[header_idx - 1]] if header_idx > 0 else []

    product_col = _find_column_index(header, ["product name", "product"])
    if product_col is None:
        product_col = 1

    net_sale_start = 0
    for i, cell in enumerate(group):
        if "net sale" in _normalize_header(cell):
            net_sale_start = i
            break

    qty_col: int | None = None
    value_col: int | None = None
    bns_col: int | None = None
    for i, cell in enumerate(header):
        norm = _normalize_header(cell)
        if i < net_sale_start:
            continue
        if norm in ("qty", "qty+bns") and qty_col is None:
            qty_col = i
        elif norm == "bns" and qty_col is not None:
            bns_col = i
        elif norm == "value" and value_col is None:
            value_col = i
            break

    if qty_col is None or value_col is None:
        # Fixed fallback: NET SALE QTY at 10/11, VALUE at 12/13 depending on width
        width = len(header)
        if width >= 18:
            qty_col, value_col = 10, 13
        elif width >= 16:
            qty_col, value_col = 11, 13
        else:
            qty_col, value_col = 10, 12

    return product_col, qty_col, value_col


def parse_medicronis_erp_statement_table(
    table: list[list[str | None]],
    template: dict[str, Any],
    column_override: tuple[int | None, int | None, int | None] | None = None,
) -> list[dict[str, Any]]:
    if column_override:
        product_col, qty_col, value_col = column_override
        header_idx = 0
    else:
        header_idx = _find_erp_header_row(table)
        if header_idx is None:
            if _is_erp_data_table(table):
                width = max(len(r) for r in table)
                if width >= 18:
                    product_col, qty_col, value_col = 1, 10, 13
                elif width >= 16:
                    product_col, qty_col, value_col = 1, 11, 13
                else:
                    product_col, qty_col, value_col = 1, 10, 12
                header_idx = -1
            else:
                return []
        else:
            product_col, qty_col, value_col = _find_erp_net_sale_columns(table, header_idx)
    skip_terms: list[str] = template.get("table_settings", {}).get("skip_rows_containing", [])
    rows: list[dict[str, Any]] = []
    start = 0 if header_idx < 0 else header_idx + 1

    for raw_row in table[start:]:
        if _should_skip_row(raw_row, skip_terms):
            continue

        product_text = _extract_cell(raw_row, product_col)
        if not product_text:
            continue
        if product_text.lower().startswith("group:"):
            continue
        if re.fullmatch(r"[\d,\.\s\-]+", product_text):
            continue

        qty = _parse_number(_extract_cell(raw_row, qty_col))
        gross = _parse_number(_extract_cell(raw_row, value_col))
        product_code = _extract_cell(raw_row, 0)

        if qty is None:
            qty = 0.0
        if qty <= 0 and (gross is None or gross <= 0):
            continue

        rows.append(
            {
                "raw_product_text": product_text,
                "raw_product_code": product_code if product_code != product_text else None,
                "quantity": qty,
                "unit_price": (gross / qty) if gross and qty else None,
                "gross_value": gross if gross is not None else 0,
                "returns_qty": None,
                "transaction_date": None,
                "customer_name": None,
                "metadata": {"source": "medicronis_erp_statement"},
            }
        )

    return rows


def _is_item_desc_net_sales_header_table(table: list[list[str | None]]) -> bool:
    if not table or len(table) < 2:
        return False
    row0_text = " ".join(_normalize_header(c) for c in table[0] if c)
    row1_text = " ".join(_normalize_header(c) for c in table[1] if c)
    return "item description" in row0_text and ("net sales" in row1_text or "sale" in row1_text)


def _is_item_desc_net_sales_data_table(table: list[list[str | None]]) -> bool:
    if not table or len(table) < 2:
        return False
    if _is_item_desc_net_sales_header_table(table):
        return False
    row0 = table[0]
    if not row0:
        return False
    product = str(row0[0] or "").strip()
    if not product or len(product) < 4:
        return False
    if _normalize_header(product) in ("item description", "item", "product"):
        return False
    # Data rows: col0 is product text, col1 is rate (number or '-')
    rate_cell = _extract_cell(row0, 1)
    if rate_cell and rate_cell != "-":
        if _parse_number(rate_cell) is None and not re.match(r"^\d", rate_cell):
            return False
    # Confirm at least one row has net-sales-like numeric in cols 7-9
    for raw_row in table[:5]:
        for col in (7, 8, 9):
            val = _parse_number(_extract_cell(raw_row, col))
            if val is not None and val > 0:
                return True
    return False


def _resolve_item_desc_columns(
    table: list[list[str | None]], template: dict[str, Any]
) -> tuple[int, int, int, int]:
    """Return (product_col, rate_col, qty_col, value_col)."""
    if _is_item_desc_net_sales_header_table(table):
        row0 = [_normalize_header(c) for c in table[0]]
        row1 = [_normalize_header(c) for c in table[1]]
        width = max(len(table[0]), len(table[1]))

        qty_col: int | None = None
        value_col: int | None = None
        sale_start = 0
        for i, cell in enumerate(row0):
            if cell == "sale":
                sale_start = i
                break

        for i in range(sale_start, width):
            sub = row1[i] if i < len(row1) else ""
            if sub == "net sales" and qty_col is None:
                qty_col = i
            elif sub == "total" and qty_col is None and "net sales" not in row1:
                qty_col = i
            elif sub == "value" and i > sale_start and value_col is None:
                value_col = i

        if qty_col is None:
            qty_col = 7
        if value_col is None:
            value_col = 9
        return 0, 1, qty_col, value_col

    # Data-only table: use template defaults
    return 0, 1, 7, 9


def parse_item_desc_net_sales_table(
    table: list[list[str | None]],
    template: dict[str, Any],
    column_override: tuple[int, int, int, int] | None = None,
) -> list[dict[str, Any]]:
    if _is_item_desc_net_sales_header_table(table):
        return []

    product_col, rate_col, qty_col, value_col = (
        column_override if column_override else _resolve_item_desc_columns(table, template)
    )
    skip_terms: list[str] = template.get("table_settings", {}).get("skip_rows_containing", [])
    rows: list[dict[str, Any]] = []

    for raw_row in table:
        if _should_skip_row(raw_row, skip_terms):
            continue

        product_text = _extract_cell(raw_row, product_col)
        if not product_text:
            continue
        if _normalize_header(product_text) in ("item description", "item", "product"):
            continue
        if product_text.lower().startswith("group:"):
            continue

        rate = _parse_number(_extract_cell(raw_row, rate_col))
        qty = _parse_number(_extract_cell(raw_row, qty_col))
        gross = _parse_number(_extract_cell(raw_row, value_col))

        if qty is None:
            qty = 0.0
        if gross is None and rate is not None and qty:
            gross = qty * rate

        if qty <= 0 and (gross is None or gross <= 0):
            continue

        rows.append(
            {
                "raw_product_text": product_text,
                "raw_product_code": None,
                "quantity": qty,
                "unit_price": rate,
                "gross_value": gross if gross is not None else (qty * rate if rate else 0),
                "returns_qty": None,
                "transaction_date": None,
                "customer_name": None,
                "metadata": {"source": "item_desc_net_sales"},
            }
        )

    return rows


def parse_ssr_stock_return_table(
    table: list[list[str | None]], template: dict[str, Any]
) -> list[dict[str, Any]]:
    cols: dict[str, int] = template.get("column_indices", {})
    skip_terms: list[str] = template.get("table_settings", {}).get("skip_rows_containing", [])

    item_col = cols.get("raw_product_text", 0)
    rate_col = cols.get("unit_price", 1)
    qty_col = cols.get("quantity", 12)
    amount_col = cols.get("gross_value", 14)
    returns_col = cols.get("returns_qty", 10)

    rows: list[dict[str, Any]] = []
    # Data begins after the two-row header
    start_idx = 2 if len(table) > 1 and _normalize_header(table[1][0]) in ("", "item") else 1

    for raw_row in table[start_idx:]:
        if _should_skip_row(raw_row, skip_terms):
            continue

        product_text = _extract_cell(raw_row, item_col)
        if not product_text:
            continue
        if product_text.lower().startswith("group:"):
            continue
        # Skip numeric-only "products" (summary rows)
        if re.fullmatch(r"[\d,\.\s]+", product_text):
            continue

        qty = _parse_number(_extract_cell(raw_row, qty_col))
        unit_price = _parse_number(_extract_cell(raw_row, rate_col))
        gross = _parse_number(_extract_cell(raw_row, amount_col))
        returns = _parse_number(_extract_cell(raw_row, returns_col))

        if qty is None:
            qty = 0.0
        if gross is None and unit_price is not None and qty:
            gross = qty * unit_price

        # Skip lines with no net sales activity
        if qty <= 0 and (gross is None or gross <= 0):
            continue

        rows.append(
            {
                "raw_product_text": product_text,
                "raw_product_code": None,
                "quantity": qty,
                "unit_price": unit_price,
                "gross_value": gross if gross is not None else (qty * unit_price if unit_price else 0),
                "returns_qty": returns,
                "transaction_date": None,
                "customer_name": None,
                "metadata": {"source": "ssr_stock_return"},
            }
        )

    return rows


def parse_table_rows(
    table: list[list[str | None]],
    template: dict[str, Any],
    item_desc_columns: tuple[int, int, int, int] | None = None,
    erp_columns: tuple[int | None, int | None, int | None] | None = None,
) -> list[dict[str, Any]]:
    table_format = template.get("table_format")

    if table_format == "ssr_stock_return" or _is_ssr_stock_return_table(table):
        tmpl = (
            template
            if table_format == "ssr_stock_return"
            else _ssr_template_for_table(table)
        )
        return parse_ssr_stock_return_table(table, tmpl)

    if table_format == "medicronis_erp_statement" or _is_medicronis_erp_statement_table(table):
        tmpl = (
            template
            if table_format == "medicronis_erp_statement"
            else load_template("fmt-medicronis-erp-statement")
        )
        return parse_medicronis_erp_statement_table(table, tmpl, erp_columns)

    if (
        table_format == "item_desc_net_sales"
        or _is_item_desc_net_sales_header_table(table)
        or _is_item_desc_net_sales_data_table(table)
    ):
        tmpl = (
            template
            if table_format == "item_desc_net_sales"
            else load_template("fmt-item-desc-net-sales")
        )
        return parse_item_desc_net_sales_table(table, tmpl, item_desc_columns)

    if not table or len(table) < 2:
        return []

    headers = [str(c or "") for c in table[0]]
    field_mapping: dict[str, list[str]] = template.get("field_mapping", {})
    skip_terms: list[str] = template.get("table_settings", {}).get("skip_rows_containing", [])

    col_map: dict[str, int | None] = {}
    for field, aliases in field_mapping.items():
        col_map[field] = _find_column_index(headers, aliases if isinstance(aliases, list) else [aliases])

    if col_map.get("raw_product_text") is None:
        return []

    rows: list[dict[str, Any]] = []
    for raw_row in table[1:]:
        if _should_skip_row(raw_row, skip_terms):
            continue

        product_text = _extract_cell(raw_row, col_map["raw_product_text"])
        if not product_text:
            continue

        qty = _parse_number(_extract_cell(raw_row, col_map.get("quantity")))
        unit_price = _parse_number(_extract_cell(raw_row, col_map.get("unit_price")))
        gross = _parse_number(_extract_cell(raw_row, col_map.get("gross_value")))

        if qty is None:
            qty = 0.0
        if gross is None and unit_price is not None:
            gross = qty * unit_price

        rows.append(
            {
                "raw_product_text": product_text,
                "raw_product_code": _extract_cell(raw_row, col_map.get("raw_product_code")),
                "quantity": qty,
                "unit_price": unit_price,
                "gross_value": gross,
                "returns_qty": _parse_number(_extract_cell(raw_row, col_map.get("returns_qty"))),
                "transaction_date": _extract_cell(raw_row, col_map.get("transaction_date")),
                "customer_name": _extract_cell(raw_row, col_map.get("customer_name")),
                "metadata": {"source": "table"},
            }
        )

    return rows


def extract_with_template(pdf_bytes: bytes, template: dict[str, Any]) -> list[dict[str, Any]]:
    all_rows: list[dict[str, Any]] = []
    active_template = template.get("distributor_code", "generic")

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables() or []
            item_desc_columns: tuple[int, int, int, int] | None = None
            erp_columns: tuple[int | None, int | None, int | None] | None = None

            for table in tables:
                if _is_item_desc_net_sales_header_table(table):
                    item_desc_columns = _resolve_item_desc_columns(table, template)
                    active_template = "fmt-item-desc-net-sales"
                    if len(table) <= 2:
                        continue

                header_idx = _find_erp_header_row(table)
                if header_idx is not None:
                    erp_columns = _find_erp_net_sale_columns(table, header_idx)
                    active_template = "fmt-medicronis-erp-statement"
                    if len(table) <= header_idx + 2:
                        continue

                if _is_ssr_stock_return_table(table):
                    active_template = _ssr_template_for_table(table).get("distributor_code", active_template)

                parsed = parse_table_rows(table, template, item_desc_columns, erp_columns)
                all_rows.extend(parsed)

    template["_resolved_code"] = active_template
    return all_rows


def _parse_lines_fallback(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    line_pattern = re.compile(
        r"^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$"
    )
    for line in text.splitlines():
        line = line.strip()
        if not line or any(x in line.lower() for x in ("total", "product name", "page")):
            continue
        m = line_pattern.match(line)
        if m:
            qty = float(m.group(2))
            price = float(m.group(3))
            gross = float(m.group(4))
            rows.append(
                {
                    "raw_product_text": m.group(1).strip(),
                    "raw_product_code": None,
                    "quantity": qty,
                    "unit_price": price,
                    "gross_value": gross,
                    "returns_qty": None,
                    "transaction_date": None,
                    "customer_name": None,
                    "metadata": {"source": "line_fallback"},
                }
            )
    return rows


def extract_pdf(
    pdf_bytes: bytes,
    distributor_code: str | None = None,
    use_ocr: bool = False,
) -> dict[str, Any]:
    page_count = get_page_count(pdf_bytes)
    detected_code, template = detect_distributor(pdf_bytes, distributor_code)
    rows = extract_with_template(pdf_bytes, template)

    if not rows and use_ocr:
        try:
            import pytesseract
            from PIL import Image

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                ocr_text_parts: list[str] = []
                for page in pdf.pages:
                    img = page.to_image(resolution=200).original
                    ocr_text_parts.append(pytesseract.image_to_string(img))
            rows = _parse_lines_fallback("\n".join(ocr_text_parts))
            template = load_template("generic")
            detected_code = "generic"
        except ImportError:
            pass

    if not rows:
        text = read_pdf_text(pdf_bytes, max_pages=page_count)
        rows = _parse_lines_fallback(text)

    confidence = 0.95 if template.get("distributor_code") != "generic" and rows else (0.7 if rows else 0.2)
    distributor_name = extract_distributor_name(pdf_bytes)
    template_used = template.get("_resolved_code") or template.get("distributor_code", "generic")

    return {
        "distributor_hint": detected_code,
        "distributor_name_hint": distributor_name,
        "rows": rows,
        "confidence": confidence,
        "template_used": template_used,
        "page_count": page_count,
    }
