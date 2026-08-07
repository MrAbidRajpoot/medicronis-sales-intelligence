"""Line/regex parser fallback for text-only PDFs (Family J) and collapsed tables (Family Z)."""

from __future__ import annotations

import re
from typing import Any

from pdf_text import parse_number, should_skip_row

DEFAULT_RATE_PATTERN = r"\d+\.\d{2}"
NUMERIC_TOKEN = re.compile(r"-?\d[\d,]*(?:\.\d+)?")
HEADER_SKIP_PHRASES = (
    "product name",
    "name of product",
    "description / pack",
    "description pack",
    "opening sales",
    "page ",
    "----",
    "stock statement",
    "sales picture",
    "company:",
    "print date",
    "from date",
    "group:",
    "trade group",
    "medicronics pharma",
    "qty. qty",
)

ExtractMethod = str  # "table" | "line_fallback" | "alternate_settings"


def _is_header_line(line: str) -> bool:
    lower = line.lower()
    return any(phrase in lower for phrase in HEADER_SKIP_PHRASES)


def _parse_numeric_tokens(text: str, treat_dash_as_zero: bool = True) -> list[float]:
    tokens: list[float] = []
    for part in text.split():
        if part == "-":
            if treat_dash_as_zero:
                tokens.append(0.0)
            continue
        if not NUMERIC_TOKEN.fullmatch(part):
            continue
        val = parse_number(part)
        if val is not None:
            tokens.append(val)
    return tokens


def _column_value(nums: list[float], index: int) -> float | None:
    if not nums:
        return None
    if index >= 0:
        return nums[index] if index < len(nums) else None
    return nums[index] if abs(index) <= len(nums) else None


def _build_row(
    product: str,
    qty: float | None,
    unit_price: float | None,
    gross: float | None,
    source: str = "line_fallback",
) -> dict[str, Any]:
    quantity = 0.0 if qty is None else qty
    gross_value = gross
    if gross_value is None and unit_price is not None and quantity:
        gross_value = quantity * unit_price
    if gross_value is None:
        gross_value = 0.0
    return {
        "raw_product_text": product,
        "raw_product_code": None,
        "quantity": quantity,
        "unit_price": unit_price,
        "gross_value": gross_value,
        "returns_qty": None,
        "transaction_date": None,
        "customer_name": None,
        "metadata": {"source": source},
    }


def _parse_regex_line(line: str, line_cfg: dict[str, Any]) -> dict[str, Any] | None:
    pattern_str = line_cfg.get("pattern")
    if not pattern_str:
        return None
    match = re.match(pattern_str, line)
    if not match:
        return None

    groups_cfg: dict[str, int] = line_cfg.get("groups") or {
        "product": 1,
        "unit_price": 2,
        "sales_qty": 3,
        "sales_amount": 4,
    }
    product = match.group(groups_cfg["product"]).strip()
    if len(product) < 2:
        return None

    unit_price = parse_number(match.group(groups_cfg.get("unit_price", 2)))
    qty = parse_number(match.group(groups_cfg.get("sales_qty", 3)))
    gross = parse_number(match.group(groups_cfg.get("sales_amount", 4)))
    return _build_row(product, qty, unit_price, gross)


def _parse_trailing_integers(line: str, line_cfg: dict[str, Any]) -> dict[str, Any] | None:
    trailing_count = int(line_cfg.get("trailingNumericCount", 9))
    parts = line.split()
    if len(parts) <= trailing_count:
        return None

    tail = parts[-trailing_count:]
    nums: list[float] = []
    for token in tail:
        if token == "-":
            nums.append(0.0)
            continue
        val = parse_number(token)
        if val is None:
            return None
        nums.append(val)

    product = " ".join(parts[:-trailing_count]).strip()
    if len(product) < 3:
        return None

    qty_col = int(line_cfg.get("salesQtyColumn", 4))
    amt_col = int(line_cfg.get("salesAmountColumn", len(nums) - 1))
    qty = _column_value(nums, qty_col)
    gross = _column_value(nums, amt_col)
    return _build_row(product, qty, None, gross)


def _parse_pipe_table(line: str, line_cfg: dict[str, Any]) -> dict[str, Any] | None:
    """Parse pipe-delimited report rows (e.g. Zafar & Sons NWS)."""
    stripped = line.strip()
    if not stripped.startswith("|"):
        return None
    upper = stripped.upper()
    if "====" in stripped or "DESCRIPTION" in upper or "PACKING" in upper:
        return None

    parts = [p.strip() for p in stripped.split("|") if p.strip()]
    if len(parts) < 8:
        return None

    product_idx = int(line_cfg.get("productColumn", 1))
    rate_idx = int(line_cfg.get("rateColumn", 3))
    if product_idx >= len(parts):
        return None

    product = parts[product_idx]
    if len(product) < 2 or product.isdigit():
        return None

    unit_price = parse_number(parts[rate_idx]) if rate_idx < len(parts) else None
    qty_col = int(line_cfg.get("salesQtyColumn", 9))
    amt_col = int(line_cfg.get("salesAmountColumn", 11))
    qty = parse_number(parts[qty_col]) if qty_col < len(parts) else None
    gross = parse_number(parts[amt_col]) if amt_col < len(parts) else None
    return _build_row(product, qty, unit_price, gross)


def _parse_rate_and_columns(line: str, line_cfg: dict[str, Any]) -> dict[str, Any] | None:
    working = line.strip()
    if line_cfg.get("codePrefix"):
        working = re.sub(r"^\d{2,3}\s*", "", working)

    rate_pattern = line_cfg.get("ratePattern", DEFAULT_RATE_PATTERN)
    rate_match = re.search(rate_pattern, working)
    if not rate_match:
        return None

    product = working[: rate_match.start()].strip()
    if len(product) < 3:
        return None

    unit_price = parse_number(rate_match.group(0))
    remainder = working[rate_match.end() :].strip()
    nums = _parse_numeric_tokens(remainder, treat_dash_as_zero=line_cfg.get("treatDashAsZero", True))

    qty_col = int(line_cfg.get("salesQtyColumn", 4))
    amt_col = int(line_cfg.get("salesAmountColumn", 5))
    min_cols = int(line_cfg.get("minNumericColumns", max(qty_col, amt_col) + 1))
    if len(nums) < min_cols:
        return None

    qty = _column_value(nums, qty_col)
    gross = _column_value(nums, amt_col)
    return _build_row(product, qty, unit_price, gross)


def parse_lines_from_text(text: str, config: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse product rows from plain PDF text using TemplateConfig.lineParser rules.
    """
    line_cfg = config.get("lineParser") or {}
    if line_cfg.get("enabled") is False:
        return []

    skip_terms: list[str] = list(config.get("skipRowsContaining") or [])
    mode = line_cfg.get("mode", "rate_and_columns")
    rows: list[dict[str, Any]] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if should_skip_row([line], skip_terms):
            continue
        if _is_header_line(line):
            continue
        if re.fullmatch(r"[\d,\.\s\-]+", line):
            continue

        parsed: dict[str, Any] | None = None
        if line_cfg.get("pattern"):
            parsed = _parse_regex_line(line, line_cfg)
        elif mode == "pipe_table":
            parsed = _parse_pipe_table(line, line_cfg)
        elif mode == "trailing_integers":
            parsed = _parse_trailing_integers(line, line_cfg)
        else:
            parsed = _parse_rate_and_columns(line, line_cfg)

        if parsed:
            rows.append(parsed)

    return rows


def line_parser_confidence(rows: list[dict[str, Any]], config: dict[str, Any]) -> float:
    """Heuristic confidence for line-parser output (0–1)."""
    if not rows:
        return 0.25
    with_sales = sum(1 for r in rows if (r.get("quantity") or 0) > 0 or (r.get("gross_value") or 0) > 0)
    ratio = with_sales / len(rows)
    if ratio >= 0.3:
        return 0.65
    if ratio >= 0.05:
        return 0.5
    return 0.35
