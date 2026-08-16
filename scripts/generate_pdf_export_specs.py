"""Generate one-page PDF export specs + email drafts for Family J distributors.

Families:
  A) Text / space-aligned reports (Bukhari, Ch Medicine, Globar, Mrwa, Noor Khan, Hamza Kasur)
  B) Pipe-delimited text tables (Zafar & Sons NWS)
  C) Sr#-prefixed product lines (Life Care Gujrat)

Usage:
  python scripts/generate_pdf_export_specs.py
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "pdf-export-specs"

PRIMARY = colors.HexColor("#1A568E")
ACCENT = colors.HexColor("#0E7A6B")
DARK = colors.HexColor("#1E293B")
MUTED = colors.HexColor("#64748B")
LIGHT = colors.HexColor("#F1F5F9")
WARN = colors.HexColor("#B45309")
OK = colors.HexColor("#166534")

# Required columns for reliable extraction
REQUIRED_COLS = [
    "Product Name",
    "Rate / TP",
    "Opening Qty",
    "Purchase Qty",
    "Sales Qty",
    "Sales Value",
    "Closing Qty",
]


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "SpecTitle",
            parent=base["Heading1"],
            fontSize=14,
            leading=17,
            textColor=PRIMARY,
            spaceAfter=2 * mm,
            fontName="Helvetica-Bold",
        ),
        "subtitle": ParagraphStyle(
            "SpecSubtitle",
            parent=base["Normal"],
            fontSize=9,
            leading=11,
            textColor=MUTED,
            spaceAfter=3 * mm,
        ),
        "h2": ParagraphStyle(
            "SpecH2",
            parent=base["Heading2"],
            fontSize=10,
            leading=12,
            textColor=DARK,
            spaceBefore=2.5 * mm,
            spaceAfter=1.5 * mm,
            fontName="Helvetica-Bold",
        ),
        "body": ParagraphStyle(
            "SpecBody",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=DARK,
            spaceAfter=1.2 * mm,
        ),
        "bullet": ParagraphStyle(
            "SpecBullet",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=DARK,
            leftIndent=4 * mm,
            spaceAfter=0.8 * mm,
        ),
        "small": ParagraphStyle(
            "SpecSmall",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9.5,
            textColor=MUTED,
        ),
        "footer": ParagraphStyle(
            "SpecFooter",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "cell": ParagraphStyle(
            "SpecCell",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=DARK,
        ),
        "cellHead": ParagraphStyle(
            "SpecCellHead",
            parent=base["Normal"],
            fontSize=7.5,
            leading=9,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        ),
    }


def rule():
    return HRFlowable(width="100%", thickness=1, color=PRIMARY, spaceAfter=2 * mm)


def build_pdf(
    path: Path,
    *,
    title: str,
    audience: str,
    problem: str,
    do_items: list[str],
    dont_items: list[str],
    example_bad: str,
    example_good: str,
    recipients: str,
) -> None:
    s = styles()
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=1.4 * cm,
        rightMargin=1.4 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    story = []

    story.append(Paragraph(title, s["title"]))
    story.append(
        Paragraph(
            f"Medicronis Sales Intelligence · PDF Export Specification · One page<br/>"
            f"<b>Send to:</b> {recipients}",
            s["subtitle"],
        )
    )
    story.append(rule())

    story.append(Paragraph("Why this matters", s["h2"]))
    story.append(Paragraph(audience, s["body"]))
    story.append(Paragraph(f"<b>Current issue:</b> {problem}", s["body"]))

    story.append(Paragraph("Required columns (every month)", s["h2"]))
    col_header = [Paragraph(c, s["cellHead"]) for c in REQUIRED_COLS]
    col_row = [Paragraph("← one product per row; numbers only in numeric cells →", s["cell"])]
    # single explanatory row spanning conceptually
    t = Table(
        [col_header],
        colWidths=[2.5 * cm, 2.0 * cm, 2.2 * cm, 2.2 * cm, 2.0 * cm, 2.2 * cm, 2.2 * cm],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(t)
    story.append(
        Paragraph(
            "Extra columns (bonus, transfer, pack size, etc.) are fine if labels are clear and stable. "
            "Opening / Purchase may be omitted only if Sales Qty, Sales Value, and Closing Qty are always present.",
            s["small"],
        )
    )

    story.append(Paragraph("Please DO", s["h2"]))
    for item in do_items:
        story.append(Paragraph(f"• {item}", s["bullet"]))

    story.append(Paragraph("Please DO NOT", s["h2"]))
    for item in dont_items:
        story.append(Paragraph(f"• {item}", s["bullet"]))

    story.append(Paragraph("Example — avoid vs prefer", s["h2"]))
    eg = Table(
        [
            [
                Paragraph("<b>Avoid (current style)</b>", s["cellHead"]),
                Paragraph("<b>Prefer (reliable)</b>", s["cellHead"]),
            ],
            [
                Paragraph(example_bad.replace("\n", "<br/>"), s["cell"]),
                Paragraph(example_good.replace("\n", "<br/>"), s["cell"]),
            ],
        ],
        colWidths=[9.0 * cm, 9.0 * cm],
    )
    eg.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), WARN),
                ("BACKGROUND", (1, 0), (1, 0), OK),
                ("BACKGROUND", (0, 1), (0, 1), colors.HexColor("#FFF7ED")),
                ("BACKGROUND", (1, 1), (1, 1), colors.HexColor("#F0FDF4")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(eg)

    story.append(Paragraph("Easiest alternative", s["h2"]))
    story.append(
        Paragraph(
            "If PDF layout cannot be changed, send the same data as <b>Excel (.xlsx)</b> with one header row "
            "and the columns above. Excel is fully supported and avoids PDF layout issues.",
            s["body"],
        )
    )

    story.append(Spacer(1, 3 * mm))
    story.append(rule())
    story.append(
        Paragraph(
            "Medicronis Pharmaceutical · Automated Secondary Sales Reporting · "
            "Questions: contact your Medicronis coordinator",
            s["footer"],
        )
    )

    doc.build(story)
    print(f"wrote {path}")


def write_emails(path: Path) -> None:
    path.write_text(
        """# Email drafts — PDF export specs (Family J distributors)

Copy one block per distributor (or BCC a family group). Attach the matching PDF from this folder.

---

## Email A — Text / space-aligned reports

**To:** Bukhari Traders MBD; Ch Medicine MWL; Globar Enterprises SKP; Mrwa Enterprises BWP; Noor Khan Mingora; The Hamza Traders Kasur  
**Attach:** `01-PDF-Export-Spec-Text-Table.pdf`

**Subject:** Action required: monthly stock/sales PDF format (Medicronis automation)

Dear Partner,

Medicronis is automating secondary sales reporting. Your current PDF is a **text printout** (space-aligned lines), so our system cannot reliably read product, sales qty, sales value, and closing stock.

Please change your monthly export using the attached one-page specification, **or** send the same data as **Excel (.xlsx)**.

We need a real table with clear columns (Product, Rate/TP, Sales Qty, Sales Value, Closing Qty) — one product per row — and the same layout every month.

Thank you for helping us process your reports accurately and faster.

Regards,  
[Your Name]  
Medicronis

---

## Email B — Pipe-delimited text table

**To:** Zafar & Sons NWS  
**Attach:** `02-PDF-Export-Spec-Pipe-Table.pdf`

**Subject:** Action required: replace pipe (|) text table in monthly PDF

Dear Partner,

Your monthly stock/sales PDF uses a **text table with pipe characters (|)** between columns. That format looks like a table to people, but automated extraction often misreads product names and quantities.

Please export a **real PDF table** (or Excel) with separate columns for Product, Rate, Sales Qty, Sales Value, and Closing Qty — **without** using `|` as column separators. See the attached one-page guide.

Regards,  
[Your Name]  
Medicronis

---

## Email C — Sr# prefixed product lines

**To:** Life Care Distributor Gujrat  
**Attach:** `03-PDF-Export-Spec-Sr-Prefix.pdf`

**Subject:** Action required: separate Sr# and product columns in monthly PDF

Dear Partner,

Your monthly PDF lists products as text lines starting with **Sr#** (serial number) mixed into the product name, and the file often has no usable product table for automation.

Please export a real table where **Sr#**, **Product Name**, **Sales Qty**, **Sales Value**, and **Closing Qty** are **separate columns**. Do not put the serial number inside the product name cell. Excel (.xlsx) with the same columns is also fine.

See the attached one-page specification.

Regards,  
[Your Name]  
Medicronis
""",
        encoding="utf-8",
    )
    print(f"wrote {path}")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    build_pdf(
        OUTPUT_DIR / "01-PDF-Export-Spec-Text-Table.pdf",
        title="PDF Export Spec — Text / Space-Aligned Reports",
        audience=(
            "Applies to distributors whose PDF looks like a stock statement but is exported as "
            "<b>plain text lines</b> (spaces used to align columns), not a real table grid."
        ),
        problem=(
            "No reliable table is detected. Automation falls back to fragile line reading, "
            "which breaks when product names have multiple words or blanks are missing."
        ),
        do_items=[
            "Export from ERP as a <b>tabular PDF</b> or print-to-PDF from Excel with a real table.",
            "Put <b>Rate/TP in its own column</b> (decimal), then Sales Qty, Sales Value, Closing Qty.",
            "Keep <b>one product per row</b>; wrap long names only inside the Product cell.",
            "Use <b>0</b> for empty quantities — avoid blank gaps between numbers.",
            "Keep the <b>same column order every month</b>.",
            "Ensure text is selectable (not a scanned image).",
        ],
        dont_items=[
            "Do not send a text “print report” that only looks aligned on screen.",
            "Do not put company titles or “Total Sale Value …” as the only table on the page.",
            "Do not merge product name + pack size into the numeric columns.",
            "Do not change column order between months without notice.",
        ],
        example_bad=(
            "AMINAL SYP 120ML  90.00  55  0  4  360  0  0  51  4590<br/>"
            "(spaces only — product and numbers run together when names vary)"
        ),
        example_good=(
            "Real table cells:<br/>"
            "Product: AMINAL SYP 120ML | Rate: 90.00 | Sales Qty: 4 | "
            "Sales Value: 360 | Closing: 51"
        ),
        recipients=(
            "Bukhari Traders MBD · Ch Medicine MWL · Globar Enterprises SKP · "
            "Mrwa Enterprises BWP · Noor Khan Mingora · The Hamza Traders Kasur"
        ),
    )

    build_pdf(
        OUTPUT_DIR / "02-PDF-Export-Spec-Pipe-Table.pdf",
        title="PDF Export Spec — Pipe-Delimited Text Tables",
        audience=(
            "Applies when the PDF draws a “table” using <b>pipe characters (|)</b> in plain text, "
            "instead of real table cells or borders."
        ),
        problem=(
            "Pipe characters are treated as text, not columns. Geometry and table extractors "
            "cannot split product vs qty reliably."
        ),
        do_items=[
            "Export a <b>real table</b> (PDF table object or Excel → PDF).",
            "Use separate cells for Product, Rate, Sales Qty, Sales Value, Closing Qty.",
            "Remove all <b>|</b> column separators from the body of the report.",
            "Keep headers on one row (or a clear two-row header) with stable labels.",
            "Prefer Excel (.xlsx) if the ERP only offers text/pipe reports.",
        ],
        dont_items=[
            "Do not format rows like: <font face='Courier'>| Product | Rate | Qty | Value |</font>",
            "Do not put pipes inside product names.",
            "Do not rely on monospace alignment alone.",
        ],
        example_bad=(
            "| MEDICINE NAME | RATE | SALE QTY | SALE VALUE | CLOSING |<br/>"
            "| AMINAL SYP | 90.00 | 4 | 360 | 51 |"
        ),
        example_good=(
            "Grid table (no pipes):<br/>"
            "Product | Rate | Sales Qty | Sales Value | Closing<br/>"
            "as real columns/cells — not ASCII art"
        ),
        recipients="Zafar & Sons NWS",
    )

    build_pdf(
        OUTPUT_DIR / "03-PDF-Export-Spec-Sr-Prefix.pdf",
        title="PDF Export Spec — Sr# Prefixed Product Lines",
        audience=(
            "Applies when each product line starts with a <b>serial number (Sr#)</b> glued to the "
            "product name, and the PDF has little or no usable product table."
        ),
        problem=(
            "Serial numbers mixed into the product field break matching. Summary-only “tables” "
            "(e.g. Total Sale Value) hide the product grid from automation."
        ),
        do_items=[
            "Export the <b>product grid</b> as the main table (not only totals).",
            "Use a dedicated <b>Sr#</b> column — never inside Product Name.",
            "Columns: Sr# | Product Name | Rate | Sales Qty | Sales Value | Closing Qty.",
            "One product per row; dashes for empty values should be replaced with <b>0</b>.",
            "Excel (.xlsx) with the same columns is preferred if PDF cannot change.",
        ],
        dont_items=[
            "Do not write lines like: <b>12 KhaajGo Lotion 60ml 110 5 550 …</b>",
            "Do not put Sr# / “Medicine Name” only in a title row with data as free text.",
            "Do not export a page whose only detected table is Total Sale / Closing Stock Value.",
        ],
        example_bad=(
            "12  KhaajGo Lotion 60ml  110  5  550  20<br/>"
            "(Sr# + product + numbers on one text line)"
        ),
        example_good=(
            "Sr#: 12 | Product: KhaajGo Lotion 60ml | Rate: 110 | "
            "Sales Qty: 5 | Sales Value: 550 | Closing: 20<br/>"
            "(separate columns)"
        ),
        recipients="Life Care Distributor Gujrat",
    )

    write_emails(OUTPUT_DIR / "EMAIL-DRAFTS.md")

    readme = OUTPUT_DIR / "README.md"
    readme.write_text(
        """# PDF export specs — Family J distributors

One-page PDFs + email drafts for distributors that still fall back to the line parser.

| File | Audience |
|------|----------|
| `01-PDF-Export-Spec-Text-Table.pdf` | Bukhari, Ch Medicine, Globar, Mrwa, Noor Khan, Hamza Kasur |
| `02-PDF-Export-Spec-Pipe-Table.pdf` | Zafar & Sons NWS |
| `03-PDF-Export-Spec-Sr-Prefix.pdf` | Life Care Gujrat |
| `EMAIL-DRAFTS.md` | Copy-paste email bodies |

Regenerate:

```bash
python scripts/generate_pdf_export_specs.py
```
""",
        encoding="utf-8",
    )
    print(f"wrote {readme}")


if __name__ == "__main__":
    main()
