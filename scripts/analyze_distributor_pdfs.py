"""Batch-analyze distributor PDFs from a folder or ZIP for format clustering."""
from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "pdf-worker"))

from extractor import extract_pdf  # noqa: E402


def norm(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def norm_headers(row: list) -> tuple[str, ...]:
    return tuple(norm(c) for c in row if norm(c))


def first_line_distributor(text: str) -> str | None:
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if "page no" in line.lower() or "printed on" in line.lower():
            name = re.split(r"\s+Page\s+No", line, flags=re.I)[0].strip()
            name = re.split(r"\s+Printed\s+On", name, flags=re.I)[0].strip()
            if len(name) > 3:
                return name
        if line.lower().startswith("group:"):
            continue
        if any(
            k in line.upper()
            for k in ("SALES, STOCK", "SALES STOCK", "FROM:", "INSTITUTION", "SECONDARY SALES")
        ):
            continue
        if len(line) > 3 and not line[0].isdigit():
            return line
    return None


def classify_table(h0n: tuple[str, ...], h1n: tuple[str, ...]) -> str:
    h0j = " ".join(h0n)
    h1j = " ".join(h1n)
    if h0n and h0n[0] == "item" and "rate" in h0j:
        if "amount" in h1j or "qty" in h1j or "net sale" in h0j:
            return "ssr_stock_return_2row"
        return "item_rate_table"
    if any(x in h0j for x in ("product name", "product", "item description", "description", "item")):
        if "qty" in h0j or "quantity" in h0j or "sold" in h0j:
            return "single_header_product_table"
    if "particular" in h0j or "medicine" in h0j:
        return "particulars_table"
    return "other_table"


def analyze_pdf(name: str, data: bytes) -> dict:
    result: dict = {
        "file": name,
        "pages": 0,
        "has_text": False,
        "distributor_hint": None,
        "detected_pattern": None,
        "tables": [],
        "family_key": None,
        "extract": None,
        "errors": [],
    }

    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            result["pages"] = len(pdf.pages)
            texts: list[str] = []
            for pi, page in enumerate(pdf.pages[:3]):
                t = page.extract_text() or ""
                texts.append(t)
                for ti, table in enumerate(page.extract_tables() or []):
                    if not table or len(table) < 2:
                        continue
                    h0 = [str(c or "") for c in table[0]]
                    h1 = [str(c or "") for c in table[1]] if len(table) > 1 else []
                    h0n = norm_headers(h0)
                    h1n = norm_headers(h1)
                    table_type = classify_table(h0n, h1n)
                    result["tables"].append(
                        {
                            "page": pi + 1,
                            "table_index": ti,
                            "rows": len(table),
                            "cols": max(len(r) for r in table),
                            "type": table_type,
                            "header0": h0[:16],
                            "header1": h1[:16] if h1 else [],
                            "header0_norm": list(h0n[:10]),
                            "header1_norm": list(h1n[:10]) if h1n else [],
                        }
                    )

            full = "\n".join(texts)
            result["has_text"] = len(full.strip()) > 50
            up = full.upper()
            for pat in (
                "SALES, STOCK & RETURN",
                "SALES STOCK & RETURN",
                "SALES, STOCK AND RETURN",
                "SECONDARY SALES",
                "STOCK STATEMENT",
                "SALES REPORT",
            ):
                if pat in up:
                    result["detected_pattern"] = pat
                    break
            result["distributor_hint"] = first_line_distributor(full)

        if result["tables"]:
            t0 = result["tables"][0]
            result["family_key"] = (
                t0["type"],
                t0["cols"],
                tuple(t0["header0_norm"][:6]),
                tuple(t0["header1_norm"][:6]) if t0.get("header1_norm") else (),
            )
        elif result["detected_pattern"]:
            result["family_key"] = ("text_pattern", result["detected_pattern"], result["pages"])
        else:
            result["family_key"] = ("no_table", result["has_text"], result["pages"])

        ext = extract_pdf(data)
        rows = ext.get("rows") or []
        with_sales = [r for r in rows if (r.get("quantity") or 0) > 0]
        result["extract"] = {
            "template_used": ext.get("template_used"),
            "distributor_hint": ext.get("distributor_hint"),
            "distributor_name_hint": ext.get("distributor_name_hint"),
            "row_count": len(rows),
            "rows_with_sales": len(with_sales),
            "confidence": ext.get("confidence"),
            "sample_products": [r.get("raw_product_text") for r in with_sales[:3]],
        }
    except Exception as exc:
        result["errors"].append(str(exc))

    return result


def load_pdfs(source: Path) -> list[tuple[str, bytes]]:
    items: list[tuple[str, bytes]] = []
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as zf:
            for name in sorted(zf.namelist()):
                if name.lower().endswith(".pdf"):
                    items.append((Path(name).name, zf.read(name)))
    elif source.is_dir():
        for path in sorted(source.rglob("*.pdf")):
            items.append((path.name, path.read_bytes()))
        for path in sorted(source.rglob("*.PDF")):
            if path.name not in {n for n, _ in items}:
                items.append((path.name, path.read_bytes()))
    else:
        raise SystemExit(f"Unsupported source: {source}")
    return items


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"d:\Downloads\July Closing.zip")
    out_dir = ROOT / "samples" / "pdf-analysis"
    out_dir.mkdir(parents=True, exist_ok=True)

    pdfs = load_pdfs(source)
    results = [analyze_pdf(name, data) for name, data in pdfs]

    families: dict = defaultdict(list)
    for r in results:
        families[str(r.get("family_key"))].append(r)

    family_list = sorted(
        [
            {
                "family_key": k,
                "count": len(v),
                "files": [x["file"] for x in v],
                "sample_headers": v[0]["tables"][0] if v[0]["tables"] else None,
                "extract_stats": {
                    "templates": list({x["extract"]["template_used"] for x in v if x.get("extract")}),
                    "avg_rows": round(
                        sum(x["extract"]["row_count"] for x in v if x.get("extract")) / max(len(v), 1), 1
                    ),
                    "avg_sales_rows": round(
                        sum(x["extract"]["rows_with_sales"] for x in v if x.get("extract")) / max(len(v), 1), 1
                    ),
                    "zero_extraction": sum(
                        1 for x in v if x.get("extract") and x["extract"]["rows_with_sales"] == 0
                    ),
                },
            }
            for k, v in families.items()
        ],
        key=lambda x: -x["count"],
    )

    report = {
        "source": str(source),
        "total_pdfs": len(results),
        "with_tables": sum(1 for r in results if r["tables"]),
        "with_text": sum(1 for r in results if r["has_text"]),
        "extraction_ok": sum(1 for r in results if r.get("extract") and r["extract"]["rows_with_sales"] > 0),
        "extraction_failed": sum(
            1 for r in results if r.get("extract") and r["extract"]["rows_with_sales"] == 0
        ),
        "family_count": len(family_list),
        "families": family_list,
        "pdfs": results,
    }

    json_path = out_dir / "july-closing-analysis.json"
    json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")

    md_lines = [
        "# July Closing PDF Analysis",
        "",
        f"- **Source:** `{source}`",
        f"- **PDFs analyzed:** {report['total_pdfs']}",
        f"- **With extractable tables:** {report['with_tables']}",
        f"- **Current worker extracts sales (qty>0):** {report['extraction_ok']}/{report['total_pdfs']}",
        f"- **Layout families detected:** {report['family_count']}",
        "",
        "## Format families (by layout cluster)",
        "",
    ]

    for i, fam in enumerate(family_list, 1):
        md_lines.append(f"### Family {i} — {fam['count']} PDF(s)")
        md_lines.append(f"- **Key:** `{fam['family_key']}`")
        stats = fam["extract_stats"]
        md_lines.append(f"- **Templates used today:** {', '.join(stats['templates']) or 'n/a'}")
        md_lines.append(
            f"- **Avg rows / avg sales rows:** {stats['avg_rows']} / {stats['avg_sales_rows']} "
            f"({stats['zero_extraction']} with zero sales)"
        )
        if fam.get("sample_headers"):
            h = fam["sample_headers"]
            md_lines.append(f"- **Type:** `{h['type']}` | **Cols:** {h['cols']}")
            md_lines.append(f"- **Header 0:** `{h['header0'][:8]}`")
            if h.get("header1"):
                md_lines.append(f"- **Header 1:** `{h['header1'][:8]}`")
        md_lines.append("- **Files:**")
        for f in fam["files"]:
            md_lines.append(f"  - {f}")
        md_lines.append("")

    md_path = out_dir / "july-closing-report.md"
    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    print(json.dumps({k: report[k] for k in ("total_pdfs", "with_tables", "extraction_ok", "extraction_failed", "family_count")}, indent=2))
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")


if __name__ == "__main__":
    main()
