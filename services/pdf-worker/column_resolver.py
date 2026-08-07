"""Config-driven column resolution via grouped header label paths."""

from __future__ import annotations

from typing import Any

from pdf_text import labels_match, normalize_header

REQUIRED_FIELDS = ("product_name", "sales_qty", "sales_amount")
PRODUCT_KEYWORDS = ("product", "description", "item", "name")
QTY_KEYWORDS = ("qty", "quantity", "net sales", "net sale")
VALUE_KEYWORDS = ("value", "amount")


def forward_fill_groups(row0: list[str | None]) -> list[str]:
    """Forward-fill grouped header labels from row 0 (normalized)."""
    groups: list[str] = []
    current = ""
    for cell in row0:
        norm = normalize_header(cell)
        if norm:
            current = norm
        groups.append(current)
    return groups


def _forward_fill_groups(row0: list[str | None]) -> list[str]:
    return forward_fill_groups(row0)


def build_detected_groups(row0: list[str | None]) -> list[str]:
    """Unique non-empty group labels in column order."""
    seen: set[str] = set()
    groups: list[str] = []
    for label in forward_fill_groups(row0):
        if label and label not in seen:
            seen.add(label)
            groups.append(label)
    return groups


def build_leaf_columns(
    row0: list[str | None],
    row1: list[str | None] | None = None,
) -> list[dict[str, Any]]:
    """Per-column group + leaf labels for the mapping wizard."""
    groups = forward_fill_groups(row0)
    width = max(len(row0), len(row1 or []), len(groups))
    columns: list[dict[str, Any]] = []
    for i in range(width):
        group = groups[i] if i < len(groups) else ""
        leaf_cell = row1[i] if row1 and i < len(row1) else None
        leaf = normalize_header(leaf_cell)
        if not group and not leaf:
            continue
        columns.append({"col": i, "group": group, "leaf": leaf})
    return columns


def _fallback_columns(fields: dict[str, Any]) -> dict[str, int]:
    resolved: dict[str, int] = {}
    for field, mapping in fields.items():
        col = mapping.get("col") if isinstance(mapping, dict) else None
        if col is not None:
            resolved[field] = int(col)
    return resolved


def _apply_col_fallbacks(resolved: dict[str, int], fields: dict[str, Any]) -> dict[str, int]:
    out = dict(resolved)
    for field, mapping in fields.items():
        if field in out:
            continue
        if isinstance(mapping, dict) and mapping.get("col") is not None:
            out[field] = int(mapping["col"])
    return out


def _match_grouped_two_row(
    row0: list[str | None],
    row1: list[str | None],
    fields: dict[str, Any],
) -> dict[str, int]:
    groups = _forward_fill_groups(row0)
    width = max(len(row0), len(row1), len(groups))
    resolved: dict[str, int] = {}

    for field, mapping in fields.items():
        if not isinstance(mapping, dict):
            continue
        group_label = mapping.get("group")
        leaf_label = mapping.get("leaf")
        if not group_label:
            continue

        for i in range(width):
            group_cell = groups[i] if i < len(groups) else ""
            if not labels_match(group_cell, group_label, strict=True):
                continue
            if leaf_label:
                leaf = row1[i] if i < len(row1) else None
                if labels_match(leaf, leaf_label):
                    resolved[field] = i
                    break
            else:
                resolved[field] = i
                break

    return resolved


def _match_single_row(row0: list[str | None], fields: dict[str, Any]) -> dict[str, int]:
    resolved: dict[str, int] = {}
    for field, mapping in fields.items():
        if not isinstance(mapping, dict):
            continue
        target = mapping.get("leaf") or mapping.get("group")
        if not target:
            continue
        for i, cell in enumerate(row0):
            if labels_match(cell, target, strict=bool(mapping.get("leaf"))):
                resolved[field] = i
                break
    return resolved


def _row_has_product_header(row: list[str | None]) -> bool:
    text = " ".join(normalize_header(c) for c in row if c)
    return any(kw in text for kw in PRODUCT_KEYWORDS)


def _row_has_qty_value_pattern(row: list[str | None]) -> bool:
    text = " ".join(normalize_header(c) for c in row if c)
    has_qty = any(kw in text for kw in QTY_KEYWORDS)
    has_value = any(kw in text for kw in VALUE_KEYWORDS)
    return has_qty and has_value


def _is_grouped_ssr_header(row0: list[str | None], row1: list[str | None]) -> bool:
    g0 = _forward_fill_groups(row0)
    if not g0 or normalize_header(row0[0] if row0 else None) != "item":
        return False
    row1_text = " ".join(normalize_header(c) for c in row1 if c)
    return "qty" in row1_text or "amount" in row1_text


def find_header_span(
    table: list[list[str | None]], config: dict[str, Any]
) -> tuple[int, int] | None:
    """Return (header_start_row, data_start_row) or None if no header in this table."""
    structure = config.get("headerStructure", "single_row")
    skip_before = int(config.get("skipRowsBeforeHeader") or 0)

    if structure == "grouped_two_row":
        for i in range(len(table) - 1):
            if _is_grouped_ssr_header(table[i], table[i + 1]):
                return i, i + 2
        fields = config.get("fields", {})
        product_group = fields.get("product_name", {}).get("group")
        for i in range(len(table) - 1):
            if product_group and labels_match(table[i][0] if table[i] else None, product_group):
                return i, i + 2
        for i, row in enumerate(table):
            row_text = " ".join(normalize_header(c) for c in row if c)
            has_code = "code" in row_text
            has_product = any(k in row_text for k in ("product desc", "product"))
            if has_code and has_product and _row_has_qty_value_pattern(row):
                return i, i + 1
        return None

    if structure == "single_row":
        fields = config.get("fields", {})
        for i, row in enumerate(table):
            for mapping in fields.values():
                target = mapping.get("leaf") or mapping.get("group")
                if target and any(labels_match(c, target) for c in row):
                    return i, i + 1
        return None

    if structure == "title_block_then_table":
        start = skip_before
        for i in range(start, min(len(table), start + 12)):
            row = table[i]
            if _row_has_product_header(row) and _row_has_qty_value_pattern(row):
                return i, i + 1
            if i + 1 < len(table):
                next_row = table[i + 1]
                if _row_has_product_header(row) and _row_has_qty_value_pattern(next_row):
                    return i, i + 2
            if i > 0:
                prev_row = table[i - 1]
                if _row_has_product_header(row) and (
                    "net sale" in " ".join(normalize_header(c) for c in prev_row if c)
                    or _row_has_qty_value_pattern(row)
                ):
                    return i - 1, i + 1
        return None

    return None


def resolve_field_columns(table: list[list[str | None]], config: dict[str, Any]) -> dict[str, int]:
    """
    Resolve canonical field names to column indices using headerStructure rules.
    Falls back to config.fields[].col when label-path matching fails.
    """
    fields: dict[str, Any] = config.get("fields") or {}
    if not fields:
        return {}

    structure = config.get("headerStructure", "single_row")
    header_span = find_header_span(table, config)

    if header_span is None:
        return _fallback_columns(fields)

    header_start, _ = header_span
    resolved: dict[str, int] = {}

    if structure == "grouped_two_row":
        if header_start + 1 < len(table):
            resolved = _match_grouped_two_row(table[header_start], table[header_start + 1], fields)
    elif structure == "single_row":
        resolved = _match_single_row(table[header_start], fields)
    elif structure == "title_block_then_table":
        header_start, data_start = header_span
        if data_start - header_start >= 2 and header_start + 1 < len(table):
            resolved = _match_grouped_two_row(
                table[header_start], table[header_start + 1], fields
            )
        else:
            resolved = _match_single_row(table[header_start], fields)

    return _apply_col_fallbacks(resolved, fields)


def resolve_label_columns(table: list[list[str | None]], config: dict[str, Any]) -> dict[str, int]:
    """Resolve columns via header label paths only (no col-index fallback)."""
    fields: dict[str, Any] = config.get("fields") or {}
    if not fields:
        return {}

    structure = config.get("headerStructure", "single_row")
    header_span = find_header_span(table, config)
    if header_span is None:
        return {}

    header_start, _ = header_span
    if structure == "grouped_two_row":
        if header_start + 1 < len(table):
            return _match_grouped_two_row(table[header_start], table[header_start + 1], fields)
        return {}
    if structure == "single_row":
        return _match_single_row(table[header_start], fields)
    if structure == "title_block_then_table":
        if header_start + 1 < len(table) and header_span[1] - header_start >= 2:
            return _match_grouped_two_row(table[header_start], table[header_start + 1], fields)
        return _match_single_row(table[header_start], fields)
    return {}


def label_resolution_ok(table: list[list[str | None]], config: dict[str, Any]) -> bool:
    """True when header label paths resolve all required canonical fields."""
    if find_header_span(table, config) is None:
        return False
    cols = resolve_label_columns(table, config)
    return all(field in cols for field in REQUIRED_FIELDS)


def resolve_with_data_start(
    table: list[list[str | None]], config: dict[str, Any]
) -> tuple[dict[str, int], int]:
    """Resolve columns and return the row index where data begins."""
    fields: dict[str, Any] = config.get("fields") or {}
    header_span = find_header_span(table, config)

    if header_span is None:
        cols = _fallback_columns(fields)
        return cols, 0

    header_start, data_start = header_span
    cols = resolve_field_columns(table, config)
    return cols, data_start
