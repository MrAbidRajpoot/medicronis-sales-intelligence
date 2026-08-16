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

REQUIRED_LINE_FIELDS = ("product_name", "sales_qty", "sales_amount")
OPTIONAL_LINE_FIELDS = ("unit_price", "returns_qty", "closing_stock")
ALL_MAPPABLE_FIELDS = REQUIRED_LINE_FIELDS + OPTIONAL_LINE_FIELDS

ExtractMethod = str  # "table" | "line_fallback" | "alternate_settings" | "geometry"


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


def _strip_code_prefix(line: str, line_cfg: dict[str, Any]) -> str:
    working = line.strip()
    if line_cfg.get("codePrefix"):
        working = re.sub(r"^\d{2,3}\s*", "", working)
    return working


def tokenize_line(line: str, config: dict[str, Any] | None = None) -> list[str]:
    """
    Split a product line into ordered tokens (words and numbers).
    Optionally strips a leading 2–3 digit code prefix when configured.
    """
    line_cfg = config or {}
    working = _strip_code_prefix(line, line_cfg)
    mode = line_cfg.get("mode", "rate_and_columns")
    if mode == "pipe_table":
        stripped = working if working.startswith("|") else f"|{working}"
        return [p.strip() for p in stripped.split("|") if p.strip()]
    return working.split()


def resolve_field_mappings(line_cfg: dict[str, Any]) -> dict[str, Any]:
    """
    Return fieldMappings, deriving from legacy salesQtyColumn / salesAmountColumn
    when fieldMappings is absent so existing presets keep working.
    """
    existing = line_cfg.get("fieldMappings")
    if isinstance(existing, dict) and existing:
        return dict(existing)

    mode = line_cfg.get("mode", "rate_and_columns")
    mappings: dict[str, Any] = {}

    if mode == "pipe_table":
        if line_cfg.get("productColumn") is not None:
            mappings["product_name"] = {"kind": "token_index", "index": int(line_cfg["productColumn"])}
        if line_cfg.get("rateColumn") is not None:
            mappings["unit_price"] = {"kind": "token_index", "index": int(line_cfg["rateColumn"])}
        if line_cfg.get("salesQtyColumn") is not None:
            mappings["sales_qty"] = {"kind": "token_index", "index": int(line_cfg["salesQtyColumn"])}
        if line_cfg.get("salesAmountColumn") is not None:
            mappings["sales_amount"] = {
                "kind": "token_index",
                "index": int(line_cfg["salesAmountColumn"]),
            }
        return mappings

    if mode == "trailing_integers":
        # Product = text before trailing block; qty/amount = indices into trailing nums
        mappings["product_name"] = {"kind": "before_rate"}
        if line_cfg.get("salesQtyColumn") is not None:
            mappings["sales_qty"] = {
                "kind": "after_rate_index",
                "index": int(line_cfg["salesQtyColumn"]),
            }
        if line_cfg.get("salesAmountColumn") is not None:
            mappings["sales_amount"] = {
                "kind": "after_rate_index",
                "index": int(line_cfg["salesAmountColumn"]),
            }
        return mappings

    # rate_and_columns default
    mappings["product_name"] = {"kind": "before_rate"}
    rate_src: dict[str, Any] = {"kind": "rate_pattern"}
    if line_cfg.get("ratePattern"):
        rate_src["pattern"] = line_cfg["ratePattern"]
    mappings["unit_price"] = rate_src
    if line_cfg.get("salesQtyColumn") is not None:
        mappings["sales_qty"] = {
            "kind": "after_rate_index",
            "index": int(line_cfg["salesQtyColumn"]),
        }
    if line_cfg.get("salesAmountColumn") is not None:
        mappings["sales_amount"] = {
            "kind": "after_rate_index",
            "index": int(line_cfg["salesAmountColumn"]),
        }
    return mappings


def _rate_pattern(source: dict[str, Any] | None, line_cfg: dict[str, Any]) -> str:
    if source and source.get("pattern"):
        return str(source["pattern"])
    return str(line_cfg.get("ratePattern") or DEFAULT_RATE_PATTERN)


def _token_as_number(token: str, treat_dash_as_zero: bool) -> float | None:
    if token == "-":
        return 0.0 if treat_dash_as_zero else None
    if not NUMERIC_TOKEN.fullmatch(token):
        return None
    return parse_number(token)


def _trailing_numeric_block(
    parts: list[str],
    trailing_count: int,
) -> tuple[str, list[float]] | None:
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
    return product, nums


def resolve_field(
    tokens: list[str],
    source: dict[str, Any] | None,
    config: dict[str, Any] | None = None,
    *,
    working_line: str | None = None,
    as_number: bool = False,
) -> str | float | None:
    """
    Resolve a single field from tokens / working line using a LineFieldSource.
    When as_number=True, coerce the result with parse_number (dash→0 when configured).
    """
    if not source:
        return None

    line_cfg = config or {}
    treat_dash = bool(line_cfg.get("treatDashAsZero", True))
    kind = source.get("kind")
    working = working_line if working_line is not None else " ".join(tokens)
    mode = line_cfg.get("mode", "rate_and_columns")

    raw: str | float | None = None

    if kind == "token_index":
        idx = int(source.get("index", -1))
        if idx < 0 or idx >= len(tokens):
            return None
        raw = tokens[idx]

    elif kind == "token_range":
        start = int(source.get("start", -1))
        end = int(source.get("end", -1))
        if start < 0 or end < start or end >= len(tokens):
            return None
        raw = " ".join(tokens[start : end + 1]).strip()

    elif kind == "rate_pattern":
        pattern = _rate_pattern(source, line_cfg)
        match = re.search(pattern, working)
        if not match:
            return None
        raw = match.group(0)

    elif kind == "before_rate":
        if mode == "trailing_integers":
            trailing_count = int(line_cfg.get("trailingNumericCount", 9))
            block = _trailing_numeric_block(tokens, trailing_count)
            if not block:
                return None
            raw = block[0]
        else:
            pattern = _rate_pattern(None, line_cfg)
            match = re.search(pattern, working)
            if not match:
                return None
            raw = working[: match.start()].strip()

    elif kind == "after_rate_index":
        idx = int(source.get("index", 0))
        if mode == "trailing_integers":
            trailing_count = int(line_cfg.get("trailingNumericCount", 9))
            block = _trailing_numeric_block(tokens, trailing_count)
            if not block:
                return None
            return _column_value(block[1], idx)
        pattern = _rate_pattern(None, line_cfg)
        match = re.search(pattern, working)
        if not match:
            return None
        remainder = working[match.end() :].strip()
        nums = _parse_numeric_tokens(remainder, treat_dash_as_zero=treat_dash)
        return _column_value(nums, idx)

    else:
        return None

    if raw is None:
        return None
    if as_number:
        if isinstance(raw, (int, float)):
            return float(raw)
        return _token_as_number(str(raw), treat_dash)
    return str(raw) if not isinstance(raw, str) else raw


def _min_tokens_required(mappings: dict[str, Any]) -> int:
    """Minimum absolute token count implied by token_index / token_range mappings."""
    needed = 0
    for source in mappings.values():
        if not isinstance(source, dict):
            continue
        kind = source.get("kind")
        if kind == "token_index":
            needed = max(needed, int(source.get("index", -1)) + 1)
        elif kind == "token_range":
            needed = max(needed, int(source.get("end", -1)) + 1)
    return needed


def _build_row(
    product: str,
    qty: float | None,
    unit_price: float | None,
    gross: float | None,
    returns_qty: float | None = None,
    closing_stock: float | None = None,
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
        "returns_qty": returns_qty,
        "closing_stock": closing_stock,
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


def _legacy_min_numeric_ok(
    working: str,
    line_cfg: dict[str, Any],
    mappings: dict[str, Any],
) -> bool:
    """Enforce minNumericColumns against numeric tokens after rate (legacy semantics)."""
    qty_src = mappings.get("sales_qty") or {}
    amt_src = mappings.get("sales_amount") or {}
    uses_after_rate = (
        qty_src.get("kind") == "after_rate_index" or amt_src.get("kind") == "after_rate_index"
    )
    if not uses_after_rate:
        parts = working.split()
        min_tokens = _min_tokens_required(mappings)
        if min_tokens and len(parts) < min_tokens:
            return False
        override = line_cfg.get("minNumericColumns")
        if override is not None and len(parts) < int(override):
            return False
        return True

    pattern = _rate_pattern(mappings.get("unit_price"), line_cfg)
    match = re.search(pattern, working)
    if not match:
        return False
    remainder = working[match.end() :].strip()
    nums = _parse_numeric_tokens(remainder, treat_dash_as_zero=line_cfg.get("treatDashAsZero", True))
    qty_col = int(qty_src.get("index", 0)) if qty_src.get("kind") == "after_rate_index" else 0
    amt_col = int(amt_src.get("index", 0)) if amt_src.get("kind") == "after_rate_index" else 0
    min_cols = int(line_cfg.get("minNumericColumns", max(qty_col, amt_col) + 1))
    return len(nums) >= min_cols


def _parse_mapped_line(line: str, line_cfg: dict[str, Any]) -> dict[str, Any] | None:
    """Unified field-mapping parse for rate_and_columns / trailing_integers / pipe_table."""
    mode = line_cfg.get("mode", "rate_and_columns")
    mappings = resolve_field_mappings(line_cfg)

    if mode == "pipe_table":
        stripped = line.strip()
        if not stripped.startswith("|"):
            return None
        upper = stripped.upper()
        if "====" in stripped or "DESCRIPTION" in upper or "PACKING" in upper:
            return None
        tokens = tokenize_line(stripped, line_cfg)
        if len(tokens) < 8 and not line_cfg.get("fieldMappings"):
            return None
        working = stripped
    else:
        working = _strip_code_prefix(line, line_cfg)
        tokens = working.split()
        if mode == "rate_and_columns" and not _legacy_min_numeric_ok(working, line_cfg, mappings):
            return None
        if mode == "trailing_integers":
            trailing_count = int(line_cfg.get("trailingNumericCount", 9))
            if len(tokens) <= trailing_count:
                return None

    # Absolute token length check when mappings use token_index/range
    min_abs = _min_tokens_required(mappings)
    if min_abs and len(tokens) < min_abs:
        return None
    override_min = line_cfg.get("minNumericColumns")
    if (
        override_min is not None
        and any(
            isinstance(s, dict) and s.get("kind") in ("token_index", "token_range")
            for s in mappings.values()
        )
        and len(tokens) < int(override_min)
    ):
        return None

    product_raw = resolve_field(
        tokens,
        mappings.get("product_name"),
        line_cfg,
        working_line=working,
        as_number=False,
    )
    if product_raw is None:
        return None
    product = str(product_raw).strip()
    min_product_len = 2 if mode == "pipe_table" else 3
    if len(product) < min_product_len:
        return None
    if mode == "pipe_table" and product.isdigit():
        return None

    qty = resolve_field(
        tokens,
        mappings.get("sales_qty"),
        line_cfg,
        working_line=working,
        as_number=True,
    )
    gross = resolve_field(
        tokens,
        mappings.get("sales_amount"),
        line_cfg,
        working_line=working,
        as_number=True,
    )
    # Required fields must resolve (index in range / match found)
    if qty is None or gross is None:
        return None
    if not isinstance(qty, (int, float)) or not isinstance(gross, (int, float)):
        return None

    unit_price = None
    if mappings.get("unit_price"):
        unit_price = resolve_field(
            tokens,
            mappings["unit_price"],
            line_cfg,
            working_line=working,
            as_number=True,
        )
        if unit_price is not None and not isinstance(unit_price, (int, float)):
            unit_price = None

    returns_qty = None
    if mappings.get("returns_qty"):
        returns_qty = resolve_field(
            tokens,
            mappings["returns_qty"],
            line_cfg,
            working_line=working,
            as_number=True,
        )
        if returns_qty is not None and not isinstance(returns_qty, (int, float)):
            returns_qty = None

    closing_stock = None
    if mappings.get("closing_stock"):
        closing_stock = resolve_field(
            tokens,
            mappings["closing_stock"],
            line_cfg,
            working_line=working,
            as_number=True,
        )
        if closing_stock is not None and not isinstance(closing_stock, (int, float)):
            closing_stock = None

    return _build_row(
        product,
        float(qty),
        float(unit_price) if unit_price is not None else None,
        float(gross),
        returns_qty=float(returns_qty) if returns_qty is not None else None,
        closing_stock=float(closing_stock) if closing_stock is not None else None,
    )


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
        if line_cfg.get("pattern") or mode == "regex":
            parsed = _parse_regex_line(line, line_cfg)
        else:
            parsed = _parse_mapped_line(line, line_cfg)

        if parsed:
            rows.append(parsed)

    return rows


def suggest_line_field_mappings(
    tokens: list[str],
    line_cfg: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Best-effort auto-suggest for the wizard token picker."""
    cfg = line_cfg or {}
    pattern = str(cfg.get("ratePattern") or DEFAULT_RATE_PATTERN)
    rate_idx: int | None = None
    for i, tok in enumerate(tokens):
        if re.fullmatch(pattern, tok):
            rate_idx = i
            break

    suggestions: dict[str, Any] = {}
    if rate_idx is not None and rate_idx > 0:
        suggestions["product_name"] = {"kind": "token_range", "start": 0, "end": rate_idx - 1}
        suggestions["unit_price"] = {"kind": "token_index", "index": rate_idx}
    elif rate_idx == 0:
        suggestions["unit_price"] = {"kind": "token_index", "index": 0}

    # Prefer legacy after_rate columns when present, converted to absolute indices
    if rate_idx is not None:
        qty_col = cfg.get("salesQtyColumn")
        amt_col = cfg.get("salesAmountColumn")
        if qty_col is not None:
            abs_qty = rate_idx + 1 + int(qty_col)
            # after_rate_index counts numeric tokens after rate, not all tokens —
            # walk tokens after rate and pick the Nth numeric
            numeric_after: list[int] = []
            for i in range(rate_idx + 1, len(tokens)):
                if NUMERIC_TOKEN.fullmatch(tokens[i]) or tokens[i] == "-":
                    numeric_after.append(i)
            if int(qty_col) < len(numeric_after):
                suggestions["sales_qty"] = {
                    "kind": "token_index",
                    "index": numeric_after[int(qty_col)],
                }
            elif abs_qty < len(tokens):
                suggestions["sales_qty"] = {"kind": "token_index", "index": abs_qty}
        if amt_col is not None:
            numeric_after = []
            for i in range(rate_idx + 1, len(tokens)):
                if NUMERIC_TOKEN.fullmatch(tokens[i]) or tokens[i] == "-":
                    numeric_after.append(i)
            if int(amt_col) < len(numeric_after):
                suggestions["sales_amount"] = {
                    "kind": "token_index",
                    "index": numeric_after[int(amt_col)],
                }

        # Heuristic: last-but-one integer-ish token often closing stock on Family J lines
        if len(tokens) >= 2 and "closing_stock" not in suggestions:
            for i in range(len(tokens) - 2, rate_idx, -1):
                if NUMERIC_TOKEN.fullmatch(tokens[i]) and "." not in tokens[i]:
                    # Prefer a token that isn't the amount we already mapped
                    amt = suggestions.get("sales_amount", {})
                    if amt.get("index") == i:
                        continue
                    suggestions["closing_stock"] = {"kind": "token_index", "index": i}
                    break

    return suggestions


def line_parser_confidence(rows: list[dict[str, Any]], config: dict[str, Any]) -> float:
    """Heuristic confidence for line-parser output (0–1)."""
    if not rows:
        return 0.25
    with_sales = sum(
        1 for r in rows if (r.get("quantity") or 0) > 0 or (r.get("gross_value") or 0) > 0
    )
    ratio = with_sales / len(rows)
    if ratio >= 0.3:
        return 0.65
    if ratio >= 0.05:
        return 0.5
    return 0.35
