"""Header grid analysis for the distributor template mapping wizard."""

from __future__ import annotations

import io
from typing import Any

import pdfplumber

from column_resolver import (
    REQUIRED_FIELDS,
    build_detected_groups,
    build_leaf_columns,
    find_header_span,
    resolve_label_columns,
)
from geometry_table import extract_geometry_table
from line_analyzer import build_line_parser_preview
from pdf_text import normalize_header, parse_number
from presets import preset_config_for_code, suggest_pdf_format
from table_extractor import is_likely_data_table


def _cell_str(value: str | None) -> str:
    return str(value or "").strip()


def _is_two_row_header(structure: str, header_row_count: int) -> bool:
    if structure == "grouped_two_row":
        return True
    return structure == "title_block_then_table" and header_row_count >= 2


def _header_grid_from_table(
    table: list[list[str | None]],
    header_start: int,
    structure: str,
    header_row_count: int = 1,
) -> list[list[str]]:
    if _is_two_row_header(structure, header_row_count) and header_start + 1 < len(table):
        row0 = table[header_start]
        row1 = table[header_start + 1]
        width = max(len(row0), len(row1))
        return [
            [_cell_str(row0[i] if i < len(row0) else None) for i in range(width)],
            [_cell_str(row1[i] if i < len(row1) else None) for i in range(width)],
        ]

    row = table[header_start]
    return [[_cell_str(cell) for cell in row]]


def _looks_like_data_row(row: list[str | None], product_col: int = 0) -> bool:
    product = _cell_str(row[product_col] if product_col < len(row) else None)
    if not product or normalize_header(product) in ("item", "product", "description"):
        return False
    numeric_cells = sum(1 for cell in row if parse_number(_cell_str(cell)) is not None)
    return numeric_cells >= 2


def _first_geometry_data_row(
    table: list[list[str | None]], start: int, config: dict[str, Any]
) -> int | None:
    product_col = int((config.get("fields") or {}).get("product_name", {}).get("col", 0))
    for i in range(start, len(table)):
        if _looks_like_data_row(table[i], product_col):
            return i
    return None


def _merge_leaf_rows(rows: list[list[str | None]], width: int) -> list[str]:
    merged: list[str] = []
    for col in range(width):
        parts: list[str] = []
        for row in rows:
            value = _cell_str(row[col] if col < len(row) else None)
            if value and value not in parts:
                parts.append(value)
        merged.append(" ".join(parts))
    return merged


def _geometry_header_layout(
    table: list[list[str | None]], config: dict[str, Any]
) -> tuple[tuple[int, int], str, list[list[str]]] | None:
    """Detect a normal header layout in a geometry grid, including wrapped leaf rows."""
    if not table or len(table) < 3:
        return None

    width = max(len(row) for row in table)
    header_start: int | None = None

    for structure in ("grouped_two_row", "single_row", "title_block_then_table"):
        probe = {
            **config,
            "headerStructure": structure,
            "tableExtractionDisabled": False,
        }
        span = find_header_span(table, probe)
        if span is not None:
            header_start = span[0]
            break

    if header_start is None:
        for i, row in enumerate(table[:-2]):
            text = " ".join(normalize_header(cell) for cell in row if cell)
            if any(keyword in text for keyword in ("description", "product", "item")):
                header_start = i
                break

    if header_start is None:
        return None

    data_start = _first_geometry_data_row(table, header_start + 1, config)
    if data_start is None or len(table) - data_start < 2:
        return None

    header_rows = data_start - header_start
    if header_rows >= 2:
        grid = [
            [_cell_str(table[header_start][i] if i < len(table[header_start]) else None) for i in range(width)],
            _merge_leaf_rows(table[header_start + 1 : data_start], width),
        ]
        return (header_start, data_start), "grouped_two_row", grid

    grid = [[_cell_str(table[header_start][i] if i < len(table[header_start]) else None) for i in range(width)]]
    return (header_start, data_start), "single_row", grid


def _pick_best_geometry_table(
    pdf_bytes: bytes, config: dict[str, Any]
) -> tuple[list[list[str | None]] | None, tuple[int, int] | None, str | None, list[list[str]]]:
    best: tuple[list[list[str | None]], tuple[int, int], str, list[list[str]]] | None = None
    best_score = -1
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:3]:
            table = extract_geometry_table(page)
            if not table or max((len(row) for row in table), default=0) < 3:
                continue
            layout = _geometry_header_layout(table, config)
            if layout is None:
                continue
            span, structure, grid = layout
            score = (len(table) - span[1]) * 100 + max(len(row) for row in table)
            if score > best_score:
                best = (table, span, structure, grid)
                best_score = score
    if best is None:
        return None, None, None, []
    return best


def _pick_best_header_table(
    pdf_bytes: bytes,
    config: dict[str, Any],
) -> tuple[list[list[str | None]] | None, tuple[int, int] | None, int, int]:
    """Return (table, header_span, col_count, data_row_count) for the best product table."""
    best_table: list[list[str | None]] | None = None
    best_span: tuple[int, int] | None = None
    best_score = -1
    best_cols = 0
    best_data_rows = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:3]:
            for table in page.extract_tables() or []:
                if not table or len(table) < 1:
                    continue
                span = find_header_span(table, config)
                if span is None:
                    fallback_layout = _geometry_header_layout(table, config)
                    span = fallback_layout[0] if fallback_layout is not None else None
                if span is None:
                    continue
                width = max(len(r) for r in table)
                score = width
                if is_likely_data_table(table, config):
                    score += 1000
                if score > best_score:
                    best_score = score
                    best_table = table
                    best_span = span
                    best_cols = width
                    best_data_rows = max(0, len(table) - span[1])

    return best_table, best_span, best_cols, best_data_rows


def _unresolved_fields(table: list[list[str | None]] | None, config: dict[str, Any]) -> list[str]:
    if config.get("headerStructure") == "line_fallback":
        line_cfg = config.get("lineParser") or {}
        if line_cfg.get("enabled") and line_cfg.get("mode"):
            return []
        return list(REQUIRED_FIELDS)

    if not table:
        return list(REQUIRED_FIELDS)
    resolved = resolve_label_columns(table, config)
    return [field for field in REQUIRED_FIELDS if field not in resolved]


def analyze_headers(
    pdf_bytes: bytes,
    template_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Analyze PDF header layout for the mapping wizard.
    Returns header grid, detected groups, leaf columns, and preset suggested mappings.
    Does not run full row extraction.
    """
    suggestion = suggest_pdf_format(pdf_bytes)
    suggested_code = suggestion["code"]
    confidence = suggestion["confidence"]

    if template_config:
        config = dict(template_config)
        suggested_code = config.get("_formatCode") or suggested_code
    else:
        config = preset_config_for_code(suggested_code)

    table, header_span, col_count, table_data_rows = _pick_best_header_table(
        pdf_bytes, config
    )

    if not template_config:
        config = preset_config_for_code(suggested_code, col_count or None)

    header_structure = config.get("headerStructure", "single_row")
    header_grid_override: list[list[str]] | None = None
    geometry_ok = False

    if config.get("preferGeometry") or table_data_rows < 2:
        geo_table, geo_span, geo_structure, geo_grid = _pick_best_geometry_table(
            pdf_bytes, config
        )
        if geo_table is not None and geo_span is not None and geo_structure is not None:
            table = geo_table
            header_span = geo_span
            col_count = max(len(row) for row in geo_table)
            header_structure = geo_structure
            header_grid_override = geo_grid
            geometry_ok = True

    # A usable pdfplumber table also gets the normal mapping UI, even when the
    # family preset historically defaulted to line_fallback.
    if not geometry_ok and table is not None and header_span is not None:
        if header_structure == "line_fallback":
            table_layout = _geometry_header_layout(table, config)
            if table_layout is not None:
                header_span, header_structure, header_grid_override = table_layout

    uses_line_parser = table is None or header_span is None
    if uses_line_parser:
        header_structure = "line_fallback"
        config = {
            **config,
            "headerStructure": "line_fallback",
            "tableExtractionDisabled": True,
        }
    else:
        config = {
            **config,
            "headerStructure": header_structure,
            "tableExtractionDisabled": False,
        }

    header_grid: list[list[str]] = []
    detected_groups: list[str] = []
    leaf_columns: list[dict[str, Any]] = []

    if not uses_line_parser and table and header_span is not None:
        header_start, data_start = header_span
        header_grid = header_grid_override or _header_grid_from_table(
            table, header_start, header_structure, max(1, data_start - header_start)
        )
        row0 = table[header_start]
        row1 = header_grid[1] if len(header_grid) >= 2 else None
        detected_groups = build_detected_groups(row0)
        leaf_columns = build_leaf_columns(row0, row1)

    suggested_mappings = dict(config.get("fields") or {})
    unresolved = _unresolved_fields(table, config)
    if geometry_ok:
        unresolved = [
            field
            for field in unresolved
            if not isinstance(suggested_mappings.get(field), dict)
            or suggested_mappings[field].get("col") is None
        ]

    line_parser_preview = None
    if uses_line_parser:
        line_parser_preview = build_line_parser_preview(pdf_bytes, config)

    return {
        "suggestedFormatCode": suggested_code,
        "confidence": confidence,
        "family": suggestion["family"],
        "headerStructure": header_structure,
        "headerGrid": header_grid,
        "detectedGroups": detected_groups,
        "leafColumns": leaf_columns,
        "suggestedMappings": suggested_mappings,
        "unresolvedFields": unresolved,
        "colCount": col_count or None,
        "usesLineParser": uses_line_parser,
        "lineParserPreview": line_parser_preview,
    }
