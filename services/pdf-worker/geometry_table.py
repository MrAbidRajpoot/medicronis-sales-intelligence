"""Free geometry (x/y) PDF table builder from pdfplumber chars/lines.

Builds cell grids for text PDFs where extract_tables() fails or returns
header-only / collapsed tables (Family J style). No paid APIs.
"""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any

Y_TOL = 3.0
LINE_X_MERGE_TOL = 3.0
TOKEN_GAP = 4.0
X_CLUSTER_TOL = 12.0
CHAR_SPACE_GAP = 1.5


def _cluster_1d(values: list[float], tol: float) -> list[float]:
    if not values:
        return []
    values = sorted(values)
    clusters: list[list[float]] = [[values[0]]]
    for v in values[1:]:
        if abs(v - clusters[-1][-1]) <= tol:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [sum(c) / len(c) for c in clusters]


def _merge_sorted(values: list[float], tol: float) -> list[float]:
    if not values:
        return []
    values = sorted(values)
    out = [values[0]]
    for v in values[1:]:
        if abs(v - out[-1]) <= tol:
            out[-1] = (out[-1] + v) / 2.0
        else:
            out.append(v)
    return out


def _vertical_separator_xs(page: Any) -> list[float]:
    """X positions of vertical ruling lines (column bands).

    Uses page.lines only — page.edges often includes glyph stems and over-splits cells.
    Short per-cell rulings still vote for the same X and merge into column bands.
    """
    xs: list[float] = []
    for line in page.lines or []:
        x0 = float(line.get("x0", 0))
        x1 = float(line.get("x1", 0))
        if abs(x0 - x1) < 2.0:
            xs.append((x0 + x1) / 2.0)
    return _merge_sorted(xs, LINE_X_MERGE_TOL)


def _column_edges_from_chars(chars: list[dict[str, Any]], row_ys: list[float]) -> list[float]:
    """Infer column band edges by clustering token-start X across dense rows."""
    starts: list[float] = []
    for ry in row_ys:
        row_chars = sorted(
            (c for c in chars if abs(float(c["top"]) - ry) <= Y_TOL),
            key=lambda c: float(c["x0"]),
        )
        if not row_chars:
            continue
        tokens: list[list[dict[str, Any]]] = [[row_chars[0]]]
        for c in row_chars[1:]:
            gap = float(c["x0"]) - float(tokens[-1][-1].get("x1", tokens[-1][-1]["x0"]))
            if gap > TOKEN_GAP:
                tokens.append([c])
            else:
                tokens[-1].append(c)
        if len(tokens) < 3:
            continue
        for tok in tokens:
            starts.append(float(tok[0]["x0"]))

    centers = _cluster_1d(starts, X_CLUSTER_TOL)
    if len(centers) < 3:
        return []
    edges = [centers[0] - 8.0]
    for i in range(len(centers) - 1):
        edges.append((centers[i] + centers[i + 1]) / 2.0)
    edges.append(centers[-1] + 40.0)
    return edges


def _join_cell_chars(chars: list[dict[str, Any]]) -> str:
    if not chars:
        return ""
    ordered = sorted(chars, key=lambda c: (float(c["x0"]), float(c.get("top", 0))))
    parts: list[str] = []
    prev_x1: float | None = None
    for c in ordered:
        text = c.get("text") or ""
        if not text:
            continue
        x0 = float(c["x0"])
        if (
            prev_x1 is not None
            and text != " "
            and parts
            and not str(parts[-1]).endswith(" ")
            and (x0 - prev_x1) > CHAR_SPACE_GAP
        ):
            parts.append(" ")
        parts.append(text)
        prev_x1 = float(c.get("x1", x0))
    return re.sub(r"[ \t]+", " ", "".join(parts)).strip()


def _col_index(x0: float, edges: list[float]) -> int:
    """Map x0 into column index given sorted left→right band edges (len = n_cols + 1)."""
    n_cols = len(edges) - 1
    if n_cols <= 0:
        return 0
    for i in range(n_cols):
        if edges[i] <= x0 < edges[i + 1]:
            return i
    if x0 < edges[0]:
        return 0
    return n_cols - 1


def _trim_empty_columns(table: list[list[str | None]]) -> list[list[str | None]]:
    if not table:
        return table
    width = max(len(r) for r in table)
    keep = [
        i
        for i in range(width)
        if any((r[i] if i < len(r) else None) not in (None, "") for r in table)
    ]
    if not keep or len(keep) == width:
        return table
    return [[(r[i] if i < len(r) else "") for i in keep] for r in table]


def extract_geometry_table(page: Any) -> list[list[str | None]]:
    """
    Build a cell grid from page.chars (and optional vertical page.lines).

    Returns list[list[str|None]] like pdfplumber extract_tables().
    Returns [] when len(chars)==0 (scanned / image-only page).
    """
    chars = list(page.chars or [])
    if len(chars) == 0:
        return []

    usable = [c for c in chars if c.get("text")]
    if not usable:
        return []

    row_ys = _cluster_1d([float(c["top"]) for c in usable], Y_TOL)
    if len(row_ys) < 2:
        return []

    line_xs = _vertical_separator_xs(page)
    if len(line_xs) >= 4:
        edges = line_xs
    else:
        edges = _column_edges_from_chars(usable, row_ys)

    if len(edges) < 4:
        return []

    n_cols = len(edges) - 1
    buckets: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for c in usable:
        top = float(c["top"])
        ri = min(range(len(row_ys)), key=lambda i: abs(row_ys[i] - top))
        if abs(row_ys[ri] - top) > Y_TOL:
            continue
        ci = _col_index(float(c["x0"]), edges)
        buckets[(ri, ci)].append(c)

    table: list[list[str | None]] = []
    for ri in range(len(row_ys)):
        row: list[str | None] = []
        for ci in range(n_cols):
            text = _join_cell_chars(buckets.get((ri, ci), []))
            row.append(text if text else "")
        if any(cell for cell in row):
            table.append(row)

    return _trim_empty_columns(table)


def extract_geometry_tables(pdf: Any) -> list[list[list[str | None]]]:
    """Extract geometry tables from every page of an open pdfplumber PDF."""
    tables: list[list[list[str | None]]] = []
    for page in pdf.pages:
        table = extract_geometry_table(page)
        if table:
            tables.append(table)
    return tables
