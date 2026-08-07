from __future__ import annotations

from rapidfuzz import fuzz, process


def _normalize(text: str) -> str:
    return " ".join(text.upper().split())


def match_rows(
    rows: list[dict],
    distributor_id: str | None,
    mappings: list[dict],
    products: list[dict],
    aliases: list[dict],
    fuzzy_threshold: int = 85,
    review_threshold: int = 70,
) -> list[dict]:
    mapping_index = {
        _normalize(m["raw_product_text"]): m for m in mappings if m.get("raw_product_text")
    }

    alias_index: dict[str, dict] = {}
    product_by_id = {p["id"]: p for p in products}
    for a in aliases:
        alias_index[_normalize(a["alias"])] = product_by_id.get(a["product_id"], {})

    product_names = [(p["id"], _normalize(p["name"])) for p in products]

    results: list[dict] = []
    for row in rows:
        raw = row.get("raw_product_text") or ""
        norm = _normalize(raw)

        # 1. Exact distributor mapping
        if norm in mapping_index:
            m = mapping_index[norm]
            product = product_by_id.get(m["product_id"], {})
            results.append(
                {
                    **row,
                    "match_status": "matched",
                    "confidence": float(m.get("confidence", 1.0)),
                    "suggested_product_id": m["product_id"],
                    "suggested_product_sku": product.get("sku"),
                    "suggested_product_name": product.get("name"),
                    "match_method": "distributor_mapping",
                }
            )
            continue

        # 2. Exact alias match
        if norm in alias_index and alias_index[norm]:
            p = alias_index[norm]
            results.append(
                {
                    **row,
                    "match_status": "matched",
                    "confidence": 0.98,
                    "suggested_product_id": p["id"],
                    "suggested_product_sku": p.get("sku"),
                    "suggested_product_name": p.get("name"),
                    "match_method": "alias_exact",
                }
            )
            continue

        # 3. Fuzzy alias / product name
        alias_keys = list(alias_index.keys())
        if alias_keys:
            alias_match = process.extractOne(norm, alias_keys, scorer=fuzz.token_sort_ratio)
            if alias_match and alias_match[1] >= fuzzy_threshold:
                p = alias_index[alias_match[0]]
                results.append(
                    {
                        **row,
                        "match_status": "matched",
                        "confidence": alias_match[1] / 100,
                        "suggested_product_id": p["id"],
                        "suggested_product_sku": p.get("sku"),
                        "suggested_product_name": p.get("name"),
                        "match_method": "alias_fuzzy",
                    }
                )
                continue
            if alias_match and alias_match[1] >= review_threshold:
                p = alias_index[alias_match[0]]
                results.append(
                    {
                        **row,
                        "match_status": "review",
                        "confidence": alias_match[1] / 100,
                        "suggested_product_id": p["id"],
                        "suggested_product_sku": p.get("sku"),
                        "suggested_product_name": p.get("name"),
                        "match_method": "alias_fuzzy",
                    }
                )
                continue

        if product_names:
            name_match = process.extractOne(
                norm,
                [n for _, n in product_names],
                scorer=fuzz.token_sort_ratio,
            )
            if name_match and name_match[1] >= fuzzy_threshold:
                pid = next(pid for pid, n in product_names if n == name_match[0])
                p = product_by_id[pid]
                results.append(
                    {
                        **row,
                        "match_status": "matched",
                        "confidence": name_match[1] / 100,
                        "suggested_product_id": pid,
                        "suggested_product_sku": p.get("sku"),
                        "suggested_product_name": p.get("name"),
                        "match_method": "product_fuzzy",
                    }
                )
                continue
            if name_match and name_match[1] >= review_threshold:
                pid = next(pid for pid, n in product_names if n == name_match[0])
                p = product_by_id[pid]
                results.append(
                    {
                        **row,
                        "match_status": "review",
                        "confidence": name_match[1] / 100,
                        "suggested_product_id": pid,
                        "suggested_product_sku": p.get("sku"),
                        "suggested_product_name": p.get("name"),
                        "match_method": "product_fuzzy",
                    }
                )
                continue

        results.append(
            {
                **row,
                "match_status": "unknown",
                "confidence": 0.0,
                "suggested_product_id": None,
                "suggested_product_sku": None,
                "suggested_product_name": None,
                "match_method": None,
            }
        )

    return results
