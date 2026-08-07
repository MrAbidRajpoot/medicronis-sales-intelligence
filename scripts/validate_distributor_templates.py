"""Batch validation of July Closing distributor PDF templates (Phase 10)."""
from __future__ import annotations

import io
import json
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "pdf-worker"))

from extractor import extract_pdf  # noqa: E402
from july_closing_assignments import (  # noqa: E402
    JULY_CLOSING_DISTRIBUTORS,
    PDF_ASSIGNMENTS,
    lookup_pdf_assignment,
    resolve_template_config,
)

WARN_FAMILIES = frozenset({"J", "Z"})
TARGET_MIN_PASS = 44


def load_pdfs(source: Path) -> list[tuple[str, bytes]]:
    items: list[tuple[str, bytes]] = []
    if source.suffix.lower() == ".zip":
        with zipfile.ZipFile(source) as zf:
            for name in sorted(zf.namelist()):
                if name.lower().endswith(".pdf"):
                    items.append((Path(name).name, zf.read(name)))
    elif source.is_dir():
        seen: set[str] = set()
        for path in sorted(source.rglob("*.pdf")):
            items.append((path.name, path.read_bytes()))
            seen.add(path.name.lower())
        for path in sorted(source.rglob("*.PDF")):
            if path.name.lower() not in seen:
                items.append((path.name, path.read_bytes()))
    else:
        raise SystemExit(f"Unsupported source: {source} (expected folder or .zip)")
    return items


def _normalize_method(method: str) -> str:
    if method in ("table", "alternate_settings"):
        return "table"
    if method == "line_fallback":
        return "line_fallback"
    return method


def _suggest_fix(entry: dict, result: dict) -> str:
    family = entry.get("family", "?")
    row_count = result["row_count"]
    sales_rows = result["sales_rows"]
    method = result["method"]
    errors = result.get("errors") or []

    if errors:
        return f"Fix extraction error: {errors[0][:120]}"

    if row_count == 0:
        if family == "J":
            return "Re-map to alternate lineParser preset or inspect text layout; OCR if image-only"
        if family == "Z":
            return "Add distributor templateConfig override (line_parser or pdfPlumberSettings)"
        return "Re-map format family or add templateConfig override with pdfPlumberSettings"

    if sales_rows == 0:
        if method == "line_fallback":
            return "Tune lineParser salesQtyColumn / salesAmountColumn in templateConfig"
        if method == "table":
            return "Verify column group/leaf mapping; try pdfPlumberSettings alternate_settings"
        return "Review field mapping — rows extracted but sales qty column may be wrong"

    if result.get("needs_template_remap"):
        return "Low confidence / label resolution failed — verify format assignment"

    return ""


def _classify_status(entry: dict, result: dict) -> str:
    family = entry.get("family", "")
    row_count = result["row_count"]
    sales_rows = result["sales_rows"]
    errors = result.get("errors") or []

    if errors:
        return "fail" if family not in WARN_FAMILIES else "warn"

    if row_count == 0:
        return "warn" if family in WARN_FAMILIES else "fail"

    if sales_rows == 0:
        return "warn"

    if result.get("needs_template_remap"):
        return "warn"

    return "pass"


def validate_pdf(filename: str, data: bytes) -> dict:
    entry = lookup_pdf_assignment(filename)
    errors: list[str] = []

    if not entry:
        return {
            "file": filename,
            "status": "fail",
            "distributor_code": None,
            "distributor_name": None,
            "format_code": None,
            "family": None,
            "row_count": 0,
            "sales_rows": 0,
            "method": None,
            "confidence": 0.0,
            "errors": [f"No distributor assignment for filename: {filename}"],
            "suggested_fix": "Add entry to prisma/july-closing-distributors.ts and july_closing_assignments.py",
        }

    config = resolve_template_config(entry)
    format_code = entry["formatCode"]

    try:
        ext = extract_pdf(
            data,
            template_config=config,
            format_code=format_code,
            distributor_code=entry["code"],
        )
        rows = ext.get("rows") or []
        sales_rows = sum(1 for r in rows if (r.get("quantity") or 0) > 0)
        result = {
            "file": filename,
            "distributor_code": entry["code"],
            "distributor_name": entry["name"],
            "format_code": format_code,
            "family": entry.get("family") or format_code[-1:].upper(),
            "row_count": len(rows),
            "sales_rows": sales_rows,
            "method": _normalize_method(ext.get("extract_method") or "table"),
            "confidence": ext.get("confidence"),
            "needs_template_remap": ext.get("needs_template_remap"),
            "errors": errors,
        }
        result["status"] = _classify_status(entry, result)
        result["suggested_fix"] = _suggest_fix(entry, result) if result["status"] != "pass" else ""
        return result
    except Exception as exc:
        errors.append(str(exc))
        result = {
            "file": filename,
            "distributor_code": entry["code"],
            "distributor_name": entry["name"],
            "format_code": format_code,
            "family": entry.get("family"),
            "row_count": 0,
            "sales_rows": 0,
            "method": None,
            "confidence": 0.0,
            "errors": errors,
        }
        result["status"] = _classify_status(entry, result)
        result["suggested_fix"] = _suggest_fix(entry, result)
        return result


def build_markdown(report: dict) -> str:
    lines = [
        "# July Closing Template Validation",
        "",
        f"- **Source:** `{report['source']}`",
        f"- **Validated:** {report['validated_at']}",
        f"- **PDFs:** {report['total_pdfs']}",
        f"- **Pass:** {report['pass_count']} | **Warn:** {report['warn_count']} | **Fail:** {report['fail_count']}",
        f"- **Row count > 0:** {report['with_rows']}/{report['total_pdfs']} "
        f"(target ≥ {report['target_min_pass']})",
        f"- **Sales rows > 0:** {report['with_sales']}/{report['total_pdfs']}",
        "",
        "## Results",
        "",
        "| Status | File | Distributor | Family | Format | Rows | Sales | Method | Fix |",
        "|--------|------|-------------|--------|--------|------|-------|--------|-----|",
    ]

    status_icon = {"pass": "✅", "warn": "⚠️", "fail": "❌"}

    for row in report["results"]:
        icon = status_icon.get(row["status"], row["status"])
        fix = (row.get("suggested_fix") or "").replace("|", "\\|")[:80]
        lines.append(
            f"| {icon} {row['status']} | {row['file']} | {row.get('distributor_name') or '—'} "
            f"| {row.get('family') or '—'} | `{row.get('format_code') or '—'}` "
            f"| {row['row_count']} | {row['sales_rows']} | {row.get('method') or '—'} | {fix} |"
        )

    failures = [r for r in report["results"] if r["status"] in ("fail", "warn")]
    if failures:
        lines.extend(["", "## Remaining issues", ""])
        for row in failures:
            lines.append(f"### {row['file']} ({row['status'].upper()})")
            lines.append(f"- **Family:** {row.get('family')} | **Format:** `{row.get('format_code')}`")
            lines.append(f"- **Rows / sales:** {row['row_count']} / {row['sales_rows']} | **Method:** {row.get('method')}")
            if row.get("suggested_fix"):
                lines.append(f"- **Suggested fix:** {row['suggested_fix']}")
            if row.get("errors"):
                lines.append(f"- **Errors:** {'; '.join(row['errors'])}")
            lines.append("")

    lines.extend(
        [
            "",
            "## Family coverage (A–I target)",
            "",
            "| Family | Assigned | Pass | Warn | Fail |",
            "|--------|----------|------|------|------|",
        ]
    )
    for fam in "ABCDEFGHI":
        assigned = [r for r in report["results"] if r.get("family") == fam]
        if not assigned:
            continue
        lines.append(
            f"| {fam} | {len(assigned)} | "
            f"{sum(1 for r in assigned if r['status'] == 'pass')} | "
            f"{sum(1 for r in assigned if r['status'] == 'warn')} | "
            f"{sum(1 for r in assigned if r['status'] == 'fail')} |"
        )

    jz = [r for r in report["results"] if r.get("family") in ("J", "Z")]
    if jz:
        lines.append(
            f"| J/Z | {len(jz)} | "
            f"{sum(1 for r in jz if r['status'] == 'pass')} | "
            f"{sum(1 for r in jz if r['status'] == 'warn')} | "
            f"{sum(1 for r in jz if r['status'] == 'fail')} |"
        )

    return "\n".join(lines)


def main() -> None:
    default_source = Path(r"d:\Downloads\July Closing.zip")
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else default_source
    out_dir = ROOT / "samples" / "pdf-analysis"
    out_dir.mkdir(parents=True, exist_ok=True)

    pdfs = load_pdfs(source)
    results = [validate_pdf(name, data) for name, data in pdfs]

    unassigned = [name for name, _ in pdfs if name not in PDF_ASSIGNMENTS and lookup_pdf_assignment(name) is None]
    if unassigned:
        print(f"Warning: {len(unassigned)} PDF(s) without distributor assignment: {unassigned[:5]}")

    pass_count = sum(1 for r in results if r["status"] == "pass")
    warn_count = sum(1 for r in results if r["status"] == "warn")
    fail_count = sum(1 for r in results if r["status"] == "fail")
    with_rows = sum(1 for r in results if r["row_count"] > 0)
    with_sales = sum(1 for r in results if r["sales_rows"] > 0)

    report = {
        "source": str(source),
        "validated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_pdfs": len(results),
        "distributors_configured": len(JULY_CLOSING_DISTRIBUTORS),
        "assignments_expected": 46,
        "target_min_pass": TARGET_MIN_PASS,
        "pass_count": pass_count,
        "warn_count": warn_count,
        "fail_count": fail_count,
        "with_rows": with_rows,
        "with_sales": with_sales,
        "target_met": with_rows >= TARGET_MIN_PASS,
        "results": results,
    }

    json_path = out_dir / "july-closing-validation.json"
    md_path = out_dir / "july-closing-validation.md"
    json_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    md_path.write_text(build_markdown(report), encoding="utf-8")

    summary = {
        "total_pdfs": report["total_pdfs"],
        "pass": pass_count,
        "warn": warn_count,
        "fail": fail_count,
        "with_rows": with_rows,
        "with_sales": with_sales,
        "target_met": report["target_met"],
    }
    print(json.dumps(summary, indent=2))
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")

    if not report["target_met"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
