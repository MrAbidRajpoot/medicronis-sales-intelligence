#!/usr/bin/env python3
"""Generate sample distributor PDFs for extraction testing."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "samples" / "pdfs"


def build_medsupply_pdf(path: Path) -> None:
    doc = SimpleDocTemplate(str(path), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("MedSupply Karachi — Sales Report July 2026", styles["Title"]),
        Paragraph("DIST-001 | Period: 01-Jul-2026 to 31-Jul-2026", styles["Normal"]),
        Spacer(1, 12),
    ]
    data = [
        ["Product Name", "Code", "Qty", "Unit Price", "Amount"],
        ["AMOXICILLIN 500MG CAPS", "AMX500", "1200", "18.00", "21600.00"],
        ["PARACETAMOL TAB 500", "PCM500", "5000", "3.00", "15000.00"],
        ["Omeprazole 20mg Cap", "OMP20", "800", "22.00", "17600.00"],
        ["Metformin HCl 500", "MET500", "2400", "8.00", "19200.00"],
        ["Atorvastatin-10", "ATV10", "600", "35.00", "21000.00"],
        ["UNKNOWN PROD XYZ", "???", "100", "0.00", "0.00"],
    ]
    table = Table(data, colWidths=[70 * mm, 25 * mm, 20 * mm, 25 * mm, 25 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1A568E")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    story.append(table)
    doc.build(story)


def build_pharmalink_pdf(path: Path) -> None:
    doc = SimpleDocTemplate(str(path), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("PharmaLink Lahore — Monthly Statement", styles["Title"]),
        Paragraph("DIST-002 | July 2026", styles["Normal"]),
        Spacer(1, 12),
    ]
    data = [
        ["Item Description", "SKU", "Sold", "Rate", "Value"],
        ["Omeprazole 20mg", "OMP-20", "1500", "22.00", "33000.00"],
        ["Metformin HCl 500", "MET-500", "3200", "8.00", "25600.00"],
        ["Cetrizine 10mg (typo)", "CTZ10", "900", "5.00", "4500.00"],
        ["IBUPROFEN 400 TAB", "IBU400", "1800", "6.00", "10800.00"],
        ["PANTO 40MG TAB", "PNT40", "650", "28.00", "18200.00"],
    ]
    table = Table(data, colWidths=[75 * mm, 25 * mm, 20 * mm, 25 * mm, 25 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0E7A6B")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        )
    )
    story.append(table)
    doc.build(story)


def build_generic_pdf(path: Path) -> None:
    doc = SimpleDocTemplate(str(path), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("CarePlus Peshawar — Sales Summary", styles["Title"]),
        Spacer(1, 12),
    ]
    data = [
        ["Description", "Code", "Quantity", "Price", "Total"],
        ["Azithro 250mg", "AZ250", "750", "45.00", "33750.00"],
        ["Ciprofloxacin HCl 500", "CIP500", "420", "38.00", "15960.00"],
    ]
    table = Table(data, colWidths=[70 * mm, 25 * mm, 25 * mm, 25 * mm, 25 * mm])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.grey)]))
    story.append(table)
    doc.build(story)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    samples = {
        "medsupply_jul2026.pdf": build_medsupply_pdf,
        "pharmalink_jul2026.pdf": build_pharmalink_pdf,
        "careplus_generic_jul2026.pdf": build_generic_pdf,
    }
    for name, builder in samples.items():
        out = OUT_DIR / name
        builder(out)
        print(f"Created {out}")


if __name__ == "__main__":
    main()
