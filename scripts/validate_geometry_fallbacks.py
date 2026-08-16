"""Revalidate the PDFs that previously required line_fallback against geometry extraction."""

from __future__ import annotations

import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from validate_distributor_templates import load_pdfs, validate_pdf  # noqa: E402


PREVIOUS_LINE_FALLBACK_PDFS = {
    "Al Makkah Trading Buner.PDF",
    "Ayan Pharma Taunsa.pdf",
    "Bukhari Traders MBD.pdf",
    "Ch Medicine MWL.pdf",
    "Evergreen Enterprises DI Khan.pdf",
    "Faiz Enterprises Rajanpur.pdf",
    "Globar Enterprises SKP.PDF",
    "Hamed Pharma Bannu Promotion.pdf",
    "Hamed Pharma Bannu Trade.pdf",
    "Hashmani Health Care Karachi.pdf",
    "Life Care Distributor Gujrat.pdf",
    "Mrwa Enterprises BWP.pdf",
    "New Tawakal Enterprises ABBT.pdf",
    "Noor KHan minogra promotion30.pdf",
    "Noor Khan Mingora.pdf",
    "The Hamza Traders Kasur.pdf",
    "Zafar & Sons NWS.pdf",
    "Zavion Pharma Jhang.pdf",
}


def normalized_method(result: dict) -> str:
    if result.get("errors") or result.get("row_count", 0) == 0:
        return "fail"
    method = result.get("method")
    if method in ("table", "alternate_settings"):
        return "table"
    if method in ("geometry", "line_fallback"):
        return method
    return "fail"


def build_markdown(source: Path, results: list[dict], counts: Counter[str]) -> str:
    lines = [
        "# Geometry Validation — Previous Line Fallback PDFs",
        "",
        f"- Source: `{source}`",
        f"- Validated: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
        f"- PDFs revalidated: **{len(results)}**",
        (
            "- Exact method counts: "
            f"**geometry {counts['geometry']} | table {counts['table']} | "
            f"line_fallback {counts['line_fallback']} | fail {counts['fail']}**"
        ),
        "",
        "## Results",
        "",
    ]
    for result in results:
        method = normalized_method(result)
        lines.append(
            f"- `{result['file']}` — **{method}**; "
            f"rows {result.get('row_count', 0)}, sales rows {result.get('sales_rows', 0)}"
        )
    lines.extend(
        [
            "",
            "## Notes",
            "",
            "- `table` includes the alternate pdfplumber settings path.",
            "- `fail` means no extracted rows or an extraction error.",
            "- Line fallback is only reached after both pdfplumber tables and geometry fail.",
            "- New Tawakal is image-only and remains at 0 rows without OCR.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\Downloads\July Closing.zip")
    pdfs = {name: data for name, data in load_pdfs(source)}
    missing = sorted(PREVIOUS_LINE_FALLBACK_PDFS - pdfs.keys())
    if missing:
        raise SystemExit(f"Missing expected PDFs: {missing}")

    results = [
        validate_pdf(name, pdfs[name])
        for name in sorted(PREVIOUS_LINE_FALLBACK_PDFS, key=str.lower)
    ]
    counts = Counter(normalized_method(result) for result in results)
    for method in ("geometry", "table", "line_fallback", "fail"):
        counts.setdefault(method, 0)

    output = ROOT / "samples" / "pdf-analysis" / "geometry-validation.md"
    output.write_text(build_markdown(source, results, counts), encoding="utf-8")
    print(
        f"geometry={counts['geometry']} table={counts['table']} "
        f"line_fallback={counts['line_fallback']} fail={counts['fail']}"
    )
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
