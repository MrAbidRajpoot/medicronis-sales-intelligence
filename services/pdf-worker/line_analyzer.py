"""Sample product-line analysis for Family J wizard token mapping."""

from __future__ import annotations

import io
import re
from typing import Any

import pdfplumber

from line_parser import (
    DEFAULT_RATE_PATTERN,
    _is_header_line,
    _parse_numeric_tokens,
    resolve_field_mappings,
    suggest_line_field_mappings,
    tokenize_line,
)
from pdf_text import should_skip_row

RATE_TOKEN = re.compile(DEFAULT_RATE_PATTERN)


def _extract_pdf_text(pdf_bytes: bytes, max_pages: int = 3) -> str:
    chunks: list[str] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            if text.strip():
                chunks.append(text)
    return "\n".join(chunks)


def _is_candidate_product_line(line: str, line_cfg: dict[str, Any], skip_terms: list[str]) -> bool:
    if not line or len(line) < 8:
        return False
    if should_skip_row([line], skip_terms):
        return False
    if _is_header_line(line):
        return False
    if re.fullmatch(r"[\d,\.\s\-]+", line):
        return False

    mode = line_cfg.get("mode", "rate_and_columns")
    if mode == "pipe_table":
        return line.strip().startswith("|") and line.count("|") >= 6

    pattern = str(line_cfg.get("ratePattern") or DEFAULT_RATE_PATTERN)
    if mode == "trailing_integers":
        parts = line.split()
        trailing = int(line_cfg.get("trailingNumericCount", 8))
        return len(parts) > trailing

    if not re.search(pattern, line):
        return False
    # Prefer lines with enough numeric tokens after the rate
    match = re.search(pattern, line)
    if not match:
        return False
    remainder = line[match.end() :].strip()
    nums = _parse_numeric_tokens(remainder, treat_dash_as_zero=True)
    min_cols = int(line_cfg.get("minNumericColumns", 3))
    return len(nums) >= min(min_cols, 3)


def build_line_parser_preview(
    pdf_bytes: bytes,
    config: dict[str, Any] | None = None,
    *,
    max_samples: int = 5,
) -> dict[str, Any] | None:
    """
    Extract representative product lines + tokenized samples for the wizard.
    Returns None when the PDF is not a line-fallback layout / no samples found.
    """
    cfg = dict(config or {})
    header_structure = cfg.get("headerStructure", "")
    line_cfg = dict(cfg.get("lineParser") or {})
    if not line_cfg.get("enabled") and header_structure != "line_fallback":
        return None
    if header_structure and header_structure != "line_fallback" and not line_cfg.get("enabled"):
        return None

    text = _extract_pdf_text(pdf_bytes)
    if not text.strip():
        return {
            "sampleLines": [],
            "tokenizedSamples": [],
            "suggestedMappings": resolve_field_mappings(line_cfg) if line_cfg else {},
        }

    skip_terms: list[str] = list(cfg.get("skipRowsContaining") or [])
    samples: list[str] = []
    tokenized: list[list[str]] = []

    for raw in text.splitlines():
        line = raw.strip()
        if not _is_candidate_product_line(line, line_cfg or {"mode": "rate_and_columns"}, skip_terms):
            continue
        # Deduplicate near-identical lines
        if line in samples:
            continue
        tokens = tokenize_line(line, line_cfg)
        if len(tokens) < 3:
            continue
        samples.append(line)
        tokenized.append(tokens)
        if len(samples) >= max_samples:
            break

    suggested: dict[str, Any] = {}
    if tokenized:
        suggested = suggest_line_field_mappings(tokenized[0], line_cfg)
        # Overlay known absolute mappings from config when present
        existing = line_cfg.get("fieldMappings")
        if isinstance(existing, dict) and existing:
            suggested = {**suggested, **existing}
        else:
            # Keep legacy relative sources as suggestions when absolute conversion incomplete
            legacy = resolve_field_mappings(line_cfg)
            for key, val in legacy.items():
                if key not in suggested:
                    suggested[key] = val

    return {
        "sampleLines": samples,
        "tokenizedSamples": tokenized,
        "suggestedMappings": suggested,
    }
