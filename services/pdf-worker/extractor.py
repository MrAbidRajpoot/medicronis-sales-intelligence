from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber

from pdf_text import normalize_header
from presets import (
    FAMILY_A_16COL,
    FAMILY_A_DEFAULT,
    FAMILY_J_DEFAULT,
    preset_config_for_code,
    suggest_pdf_format,
)
from column_resolver import label_resolution_ok
from geometry_table import extract_geometry_table
from line_parser import line_parser_confidence, parse_lines_from_text
from table_extractor import extract_rows_from_table, is_likely_data_table


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


def _is_ssr_stock_return_table(table: list[list[str | None]]) -> bool:
    """Detect Family A grouped two-row SSR layout for 16/17-col variant selection."""
    if not table or len(table) < 3:
        return False
    row0 = [normalize_header(c) for c in table[0]]
    if not row0 or row0[0] != "item":
        return False
    if "rate" not in row0:
        return False
    if len(table) > 1:
        row1_text = " ".join(normalize_header(c) for c in table[1] if c)
        if "amount" in row1_text or "qty" in row1_text:
            return True
    return "net sale" in " ".join(row0)


def _infer_ssr_preset(table: list[list[str | None]]) -> dict[str, Any]:
    col_count = max(len(r) for r in table) if table else 0
    return dict(FAMILY_A_16COL if col_count <= 16 else FAMILY_A_DEFAULT)


def _rows_have_sales(rows: list[dict[str, Any]]) -> bool:
    return any((r.get("quantity") or 0) > 0 or (r.get("gross_value") or 0) > 0 for r in rows)


def _pdfplumber_table_settings(config: dict[str, Any]) -> dict[str, Any] | None:
    settings = config.get("pdfPlumberSettings")
    return dict(settings) if isinstance(settings, dict) and settings else None


def _table_stats(
    pdf_bytes: bytes, config: dict[str, Any], table_settings: dict[str, Any] | None = None
) -> tuple[int, int, int]:
    """Return (table_count, max_cols, usable_table_count)."""
    table_count = 0
    max_cols = 0
    usable = 0
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            kwargs: dict[str, Any] = {}
            if table_settings:
                kwargs["table_settings"] = table_settings
            for table in page.extract_tables(**kwargs) or []:
                if not table:
                    continue
                table_count += 1
                width = max(len(r) for r in table)
                max_cols = max(max_cols, width)
                if is_likely_data_table(table, config):
                    usable += 1
    return table_count, max_cols, usable


def _table_extract_config(config: dict[str, Any]) -> dict[str, Any]:
    """Config for pdfplumber table pass (allow tables even when Family J disables them)."""
    cfg = dict(config)
    cfg["tableExtractionDisabled"] = False
    if cfg.get("headerStructure") == "line_fallback":
        cfg["headerStructure"] = "single_row"
    return cfg


def _geometry_extract_config(config: dict[str, Any]) -> dict[str, Any]:
    """Config for geometry grids — treat like a single-row header table when Family J."""
    cfg = _table_extract_config(config)
    cfg["_source"] = "geometry"
    return cfg


def _fields_have_col_map(config: dict[str, Any]) -> bool:
    fields = config.get("fields") or {}
    return any(isinstance(m, dict) and m.get("col") is not None for m in fields.values())


def extract_with_config(
    pdf_bytes: bytes,
    config: dict[str, Any],
    table_settings: dict[str, Any] | None = None,
    *,
    allow_disabled_tables: bool = False,
) -> tuple[list[dict[str, Any]], bool]:
    """Extract all product rows using a TemplateConfig dict. Returns (rows, label_resolution_ok)."""
    if not allow_disabled_tables and (
        config.get("tableExtractionDisabled") or config.get("headerStructure") == "line_fallback"
    ):
        return [], False

    all_rows: list[dict[str, Any]] = []
    label_ok = False
    active_config = _table_extract_config(config) if allow_disabled_tables else dict(config)
    active_config.setdefault("_source", "config_driven")

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            kwargs: dict[str, Any] = {}
            if table_settings:
                kwargs["table_settings"] = table_settings
            for table in page.extract_tables(**kwargs) or []:
                if not table:
                    continue
                table_config = active_config
                if active_config.get("headerStructure") == "grouped_two_row" and _is_ssr_stock_return_table(
                    table
                ):
                    table_config = _infer_ssr_preset(table)
                    table_config.setdefault("_source", "config_driven")
                if label_resolution_ok(table, table_config):
                    label_ok = True
                if not is_likely_data_table(table, table_config):
                    continue
                parsed = extract_rows_from_table(table, table_config)
                all_rows.extend(parsed)

    return all_rows, label_ok


def _extract_line_fallback(
    pdf_bytes: bytes, config: dict[str, Any], page_count: int
) -> tuple[list[dict[str, Any]], float]:
    text = read_pdf_text(pdf_bytes, max_pages=page_count)
    rows = parse_lines_from_text(text, config)
    confidence = line_parser_confidence(rows, config)
    return rows, confidence


def _extract_geometry(
    pdf_bytes: bytes, config: dict[str, Any]
) -> tuple[list[dict[str, Any]], bool]:
    """
    Build geometry tables across pages; use when ≥2 rows and ≥3 cols.
    Returns (product rows, label_resolution_ok).
    """
    geo_config = _geometry_extract_config(config)
    all_rows: list[dict[str, Any]] = []
    label_ok = False

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            table = extract_geometry_table(page)
            if not table or len(table) < 2:
                continue
            max_cols = max(len(r) for r in table)
            if max_cols < 3:
                continue
            if label_resolution_ok(table, geo_config):
                label_ok = True
            if not is_likely_data_table(table, geo_config) and not _fields_have_col_map(geo_config):
                continue
            parsed = extract_rows_from_table(table, geo_config)
            all_rows.extend(parsed)

    return all_rows, label_ok


def extract_with_config_pipeline(
    pdf_bytes: bytes, config: dict[str, Any], page_count: int
) -> tuple[list[dict[str, Any]], bool, str, float]:
    """
    Tiered extraction: table → alternate pdfplumber → geometry → line parser.
    When tableExtractionDisabled / line_fallback / weak tables, geometry runs
    before line_fallback. Returns (rows, template_resolution_ok, extract_method, confidence).
    """
    force_line = config.get("tableExtractionDisabled") or config.get("headerStructure") == "line_fallback"
    alt_settings = _pdfplumber_table_settings(config)
    line_cfg = config.get("lineParser") or {}

    if force_line:
        # 1) pdfplumber tables (even when Family J disables them by default)
        rows, label_ok = extract_with_config(pdf_bytes, config, allow_disabled_tables=True)
        table_count, max_cols, usable = _table_stats(pdf_bytes, _table_extract_config(config))
        collapsed = max_cols <= 1 and table_count > 0
        if rows and not collapsed and _rows_have_sales(rows):
            confidence = 0.95 if label_ok else 0.85
            return rows, label_ok, "table", confidence

        # 2) alternate pdfplumber settings
        if alt_settings:
            alt_rows, alt_label_ok = extract_with_config(
                pdf_bytes, config, table_settings=alt_settings, allow_disabled_tables=True
            )
            _, alt_max_cols, _ = _table_stats(pdf_bytes, _table_extract_config(config), alt_settings)
            if alt_rows and alt_max_cols > 1 and _rows_have_sales(alt_rows):
                confidence = 0.9 if alt_label_ok else 0.75
                return alt_rows, alt_label_ok, "alternate_settings", confidence

        # 3) geometry cell grid
        geo_rows, geo_label_ok = _extract_geometry(pdf_bytes, config)
        if geo_rows:
            confidence = 0.9 if geo_label_ok else 0.8
            return geo_rows, geo_label_ok or True, "geometry", confidence

        # 4) line parser last resort
        line_rows, confidence = _extract_line_fallback(pdf_bytes, config, page_count)
        return line_rows, bool(line_rows), "line_fallback", confidence

    table_count, max_cols, usable = _table_stats(pdf_bytes, config)
    collapsed = max_cols <= 1 and table_count > 0

    rows, label_ok = extract_with_config(pdf_bytes, config)
    if rows and not collapsed:
        if alt_settings:
            alt_rows, alt_label_ok = extract_with_config(pdf_bytes, config, table_settings=alt_settings)
            _, alt_max_cols, _ = _table_stats(pdf_bytes, config, alt_settings)
            if alt_rows and len(alt_rows) > len(rows) and alt_max_cols > 1:
                confidence = 0.9 if alt_label_ok else 0.75
                return alt_rows, alt_label_ok, "alternate_settings", confidence
            if alt_rows and not _rows_have_sales(rows) and _rows_have_sales(alt_rows) and alt_max_cols > 1:
                confidence = 0.9 if alt_label_ok else 0.75
                return alt_rows, alt_label_ok, "alternate_settings", confidence
        if not _rows_have_sales(rows):
            geo_rows, geo_label_ok = _extract_geometry(pdf_bytes, config)
            if geo_rows and _rows_have_sales(geo_rows):
                confidence = 0.9 if geo_label_ok else 0.8
                return geo_rows, geo_label_ok or True, "geometry", confidence
            if line_cfg.get("enabled"):
                line_rows, confidence = _extract_line_fallback(pdf_bytes, config, page_count)
                if _rows_have_sales(line_rows):
                    return line_rows, False, "line_fallback", confidence
        confidence = 0.95 if label_ok else 0.85
        return rows, label_ok, "table", confidence

    if collapsed:
        rows = []
        label_ok = False

    if alt_settings and (collapsed or usable == 0 or not rows):
        alt_rows, alt_label_ok = extract_with_config(pdf_bytes, config, table_settings=alt_settings)
        _, alt_max_cols, _ = _table_stats(pdf_bytes, config, alt_settings)
        if alt_rows and alt_max_cols > 1:
            confidence = 0.9 if alt_label_ok else 0.75
            return alt_rows, alt_label_ok, "alternate_settings", confidence
        if alt_rows and collapsed:
            confidence = 0.7 if alt_label_ok else 0.6
            return alt_rows, alt_label_ok, "alternate_settings", confidence

    # Geometry before line fallback when tables are weak / missing
    if collapsed or usable == 0 or not rows or config.get("preferGeometry"):
        geo_rows, geo_label_ok = _extract_geometry(pdf_bytes, config)
        if geo_rows:
            confidence = 0.9 if geo_label_ok else 0.8
            return geo_rows, geo_label_ok or True, "geometry", confidence

    if collapsed or usable == 0 or not rows or line_cfg.get("enabled"):
        rows, confidence = _extract_line_fallback(pdf_bytes, config, page_count)
        if rows:
            return rows, False, "line_fallback", confidence

    return [], False, "table", 0.25


def _first_table_col_count(pdf_bytes: bytes) -> int | None:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:1]:
            for table in page.extract_tables() or []:
                if table:
                    return max(len(r) for r in table)
    return None


def resolve_extraction_config(
    pdf_bytes: bytes,
    template_config: dict[str, Any] | None = None,
    format_code: str | None = None,
) -> tuple[dict[str, Any], str, float]:
    """
    Resolve TemplateConfig for extraction.
    Caller-supplied template_config wins; otherwise auto-suggest via PdfFormat detection hints.
    """
    if template_config:
        config = dict(template_config)
        code = format_code or config.get("_formatCode") or "config"
        return config, code, 1.0

    suggestion = suggest_pdf_format(pdf_bytes)
    code = format_code or suggestion["code"]
    col_count = _first_table_col_count(pdf_bytes)
    config = preset_config_for_code(code, col_count)
    config.setdefault("_formatCode", code)
    return config, code, suggestion["confidence"]


def extract_pdf(
    pdf_bytes: bytes,
    template_config: dict[str, Any] | None = None,
    distributor_code: str | None = None,
    format_code: str | None = None,
    use_ocr: bool = False,
) -> dict[str, Any]:
    page_count = get_page_count(pdf_bytes)
    extract_method = "table"
    template_resolution_ok = True
    confidence = 0.3

    config, suggested_format_code, suggest_confidence = resolve_extraction_config(
        pdf_bytes,
        template_config=template_config,
        format_code=format_code,
    )

    rows, template_resolution_ok, extract_method, confidence = extract_with_config_pipeline(
        pdf_bytes, config, page_count
    )

    if not template_config:
        confidence = max(confidence, suggest_confidence * 0.5)

    template_used = extract_method if extract_method != "table" else "config"
    if template_config:
        template_used = extract_method if extract_method != "table" else "config"

    if not rows and use_ocr:
        try:
            import pytesseract
            from PIL import Image

            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                ocr_text_parts: list[str] = []
                for page in pdf.pages:
                    img = page.to_image(resolution=200).original
                    ocr_text_parts.append(pytesseract.image_to_string(img))
            ocr_config = template_config or config or FAMILY_J_DEFAULT
            rows = parse_lines_from_text("\n".join(ocr_text_parts), ocr_config)
            suggested_format_code = "fmt-j-no-table"
            template_used = "line_fallback"
            extract_method = "line_fallback"
            confidence = line_parser_confidence(rows, ocr_config)
            template_resolution_ok = bool(rows)
        except ImportError:
            pass

    if not rows and not template_config:
        text = read_pdf_text(pdf_bytes, max_pages=page_count)
        rows = parse_lines_from_text(text, config)
        extract_method = "line_fallback"
        confidence = line_parser_confidence(rows, config)
        template_resolution_ok = bool(rows)

    if rows and extract_method in ("line_fallback", "alternate_settings", "geometry"):
        template_resolution_ok = True
        needs_template_remap = False
    else:
        needs_template_remap = not rows or (
            not template_resolution_ok and confidence < 0.5
        )

    distributor_name = extract_distributor_name(pdf_bytes)

    return {
        "distributor_hint": distributor_code or suggested_format_code,
        "distributor_name_hint": distributor_name,
        "suggested_format_code": suggested_format_code,
        "rows": rows,
        "confidence": confidence,
        "template_used": template_used,
        "template_resolution_ok": template_resolution_ok and not needs_template_remap,
        "extract_method": extract_method,
        "needs_template_remap": needs_template_remap,
        "page_count": page_count,
    }
