"""Shared text/cell helpers for PDF table extraction."""

from __future__ import annotations

import re


def normalize_header(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def labels_match(label: str | None, target: str | None, *, strict: bool = False) -> bool:
    """Case-insensitive label match. Use strict=True for grouped header names."""
    a = normalize_header(label)
    b = normalize_header(target)
    if not a or not b:
        return False
    if a == b:
        return True
    if strict:
        return False
    if len(b) >= 3 and b in a:
        return True
    if len(a) >= 3 and a in b:
        return True
    return False


def parse_number(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in ("-", "—", "–"):
        return None
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


def extract_cell(row: list[str | None], index: int | None) -> str | None:
    if index is None or index < 0 or index >= len(row):
        return None
    val = row[index]
    if val is None:
        return None
    text = str(val).strip()
    return text or None


def should_skip_row(row: list[str | None], skip_terms: list[str]) -> bool:
    joined = " ".join(str(c or "") for c in row).lower()
    if not joined.strip():
        return True
    return any(term.lower() in joined for term in skip_terms)
