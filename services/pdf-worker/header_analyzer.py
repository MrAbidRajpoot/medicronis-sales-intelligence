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
from line_analyzer import build_line_parser_preview
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


def _pick_best_header_table(
    pdf_bytes: bytes,
    config: dict[str, Any],
) -> tuple[list[list[str | None]] | None, tuple[int, int] | None, int]:
    """Return (table, header_span, col_count) for the best product table in the PDF."""
    best_table: list[list[str | None]] | None = None
    best_span: tuple[int, int] | None = None
    best_score = -1
    best_cols = 0

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:3]:
            for table in page.extract_tables() or []:
                if not table or len(table) < 1:
                    continue
                span = find_header_span(table, config)
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

    return best_table, best_span, best_cols


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

    table, header_span, col_count = _pick_best_header_table(
        pdf_bytes,
        template_config or preset_config_for_code(suggested_code),
    )

    if template_config:
        config = dict(template_config)
        suggested_code = config.get("_formatCode") or suggested_code
    else:
        config = preset_config_for_code(suggested_code, col_count or None)

    if template_config:
        config = dict(template_config)
        suggested_code = config.get("_formatCode") or suggested_code
    else:
        config = preset_config_for_code(suggested_code, col_count or None)

    header_structure = config.get("headerStructure", "single_row")
    if header_structure == "line_fallback" or suggested_code == "fmt-j-no-table":
        header_structure = "line_fallback"
        config = dict(config)
        config["headerStructure"] = "line_fallback"
        config.setdefault("tableExtractionDisabled", True)

    header_grid: list[list[str]] = []
    detected_groups: list[str] = []
    leaf_columns: list[dict[str, Any]] = []

    if header_structure != "line_fallback" and table and header_span is not None:
        header_start, data_start = header_span
        header_grid = _header_grid_from_table(
            table, header_start, header_structure, max(1, data_start - header_start)
        )
        row0 = table[header_start]
        row1 = table[header_start + 1] if len(header_grid) >= 2 else None
        detected_groups = build_detected_groups(row0)
        leaf_columns = build_leaf_columns(row0, row1)

    suggested_mappings = dict(config.get("fields") or {})
    unresolved = _unresolved_fields(table, config)

    line_parser_preview = None
    if header_structure == "line_fallback" or (config.get("lineParser") or {}).get("enabled"):
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
        "usesLineParser": header_structure == "line_fallback",
        "lineParserPreview": line_parser_preview,
    }
