#!/usr/bin/env python3
"""Generate Medicronis Sales Intelligence User Manual as a Word document."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "Medicronis-User-Manual.docx"
MANUAL_VERSION = "1.2"


@dataclass
class TocEntry:
    level: int
    text: str
    bookmark: str


@dataclass
class ManualBuilder:
    doc: Document
    toc: list[TocEntry] = field(default_factory=list)
    _bookmark_seq: int = 0

    def __post_init__(self) -> None:
        style = self.doc.styles["Normal"]
        style.font.name = "Calibri"
        style.font.size = Pt(11)

    def heading(self, text: str, level: int = 1) -> None:
        self._bookmark_seq += 1
        bookmark = f"toc_{self._bookmark_seq}"
        self.toc.append(TocEntry(level=level, text=text, bookmark=bookmark))

        heading = self.doc.add_heading(text, level=level)
        start = OxmlElement("w:bookmarkStart")
        start.set(qn("w:id"), str(self._bookmark_seq))
        start.set(qn("w:name"), bookmark)
        heading._p.insert(0, start)
        end = OxmlElement("w:bookmarkEnd")
        end.set(qn("w:id"), str(self._bookmark_seq))
        heading._p.append(end)

    def paragraph(self, text: str) -> None:
        self.doc.add_paragraph(text)

    def bullets(self, items: list[str]) -> None:
        for item in items:
            self.doc.add_paragraph(item, style="List Bullet")

    def steps(self, items: list[str]) -> None:
        for item in items:
            self.doc.add_paragraph(item, style="List Number")

    def code_line(self, text: str) -> None:
        p = self.doc.add_paragraph()
        run = p.add_run(text)
        run.font.name = "Consolas"
        run.font.size = Pt(10)

    def table(self, headers: list[str], rows: list[list[str]]) -> None:
        doc = self.doc
        table = doc.add_table(rows=1 + len(rows), cols=len(headers))
        table.style = "Table Grid"
        hdr = table.rows[0].cells
        for i, header in enumerate(headers):
            hdr[i].text = header
            set_cell_shading(hdr[i], "1F4E79")
            for p in hdr[i].paragraphs:
                for run in p.runs:
                    run.bold = True
                    run.font.size = Pt(10)
                    run.font.color.rgb = RGBColor(255, 255, 255)
        for r_idx, row in enumerate(rows):
            for c_idx, val in enumerate(row):
                cell = table.rows[r_idx + 1].cells[c_idx]
                cell.text = val
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.size = Pt(10)
        doc.add_paragraph()

    def page_break(self) -> None:
        p = self.doc.add_paragraph()
        p.add_run().add_break(WD_BREAK.PAGE)


def set_cell_shading(cell, color_hex: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), color_hex)
    shading.set(qn("w:val"), "clear")
    cell._tc.get_or_add_tcPr().append(shading)


def add_hyperlink(paragraph, text: str, bookmark: str) -> None:
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("w:anchor"), bookmark)
    new_run = OxmlElement("w:r")
    r_pr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    r_pr.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    r_pr.append(underline)
    new_run.append(r_pr)
    text_el = OxmlElement("w:t")
    text_el.text = text
    new_run.append(text_el)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def build_toc_elements(doc: Document, toc: list[TocEntry]) -> list:
    """Build TOC section as detached XML elements (hyperlinks, no Word field required)."""
    elements: list = []

    title = doc.add_heading("Table of Contents", level=1)
    elements.append(title._element)

    for entry in toc:
        p = doc.add_paragraph()
        indent = max(0, entry.level - 1) * 0.35
        p.paragraph_format.left_indent = Inches(indent)
        add_hyperlink(p, entry.text, entry.bookmark)
        elements.append(p._element)

    intro = doc.add_paragraph(
        "Click any section name above to jump to that topic. "
        "Section numbers match the headings throughout this manual."
    )
    intro.runs[0].italic = True
    intro.runs[0].font.size = Pt(9)
    intro.runs[0].font.color.rgb = RGBColor(100, 100, 100)
    elements.append(intro._element)

    pb = doc.add_paragraph()
    pb.add_run().add_break(WD_BREAK.PAGE)
    elements.append(pb._element)

    body = doc.element.body
    for el in elements:
        body.remove(el)
    return elements


def add_title_page(doc: Document):
    """Add title page and return the page-break element (TOC inserts after it)."""
    for _ in range(6):
        doc.add_paragraph()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("Medicronis Sales Intelligence")
    run.bold = True
    run.font.size = Pt(28)
    run.font.color.rgb = RGBColor(31, 78, 121)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run("User Manual")
    run.font.size = Pt(22)
    run.font.color.rgb = RGBColor(68, 114, 196)

    doc.add_paragraph()
    desc = doc.add_paragraph()
    desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = desc.add_run(
        "Pharma Distributor Secondary Sales Reporting\n"
        "PDF Upload → Product Matching → Review → SSR Excel Export"
    )
    run.font.size = Pt(12)

    doc.add_paragraph()
    doc.add_paragraph()
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = meta.add_run(
        f"Version {MANUAL_VERSION}  |  {date.today().strftime('%B %d, %Y')}"
    )
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(100, 100, 100)

    pb = doc.add_paragraph()
    pb.add_run().add_break(WD_BREAK.PAGE)
    return pb._element


def write_content(m: ManualBuilder) -> None:
    # --- 1. Introduction ---
    m.heading("1. Introduction", 1)
    m.paragraph(
        "Medicronis Sales Intelligence is a sales reporting automation platform designed for "
        "pharmaceutical distributors and sales operations teams. The application converts "
        "distributor PDF sales reports into structured data and generates Secondary Sales "
        "Report (SSR) Excel exports."
    )
    m.heading("1.1 Purpose", 2)
    m.paragraph(
        "The system eliminates manual re-keying of distributor PDF reports into spreadsheets. "
        "It supports automated PDF extraction, intelligent product catalog matching, human "
        "review of exceptions, and consolidated SSR report generation."
    )
    m.heading("1.2 Target Users", 2)
    m.bullets(
        [
            "Medicronis sales operations teams managing distributor networks",
            "Sales managers reviewing distributor performance and sales data",
            "Data entry staff uploading and approving distributor reports",
            "Administrators configuring distributors, products, and PDF templates",
        ]
    )
    m.heading("1.3 Key Capabilities", 2)
    m.bullets(
        [
            "Upload single PDFs, multiple PDFs, or ZIP archives of distributor sales reports",
            "Auto-detect distributor from PDF header text (with optional manual override)",
            "Automatic extraction of product rows from 10 PDF layout families (A–J), including Family J line-parser mode",
            "Multiple extraction strategies: table parsing, line parser fallback, alternate pdfplumber settings",
            "Fuzzy matching against product catalog with distributor-specific mappings",
            "Product groups (Medicronis | Transformer) required on every catalog product for SSR grouping",
            "Review queue for unmatched or ambiguous product rows",
            "Approve data and promote to daily sales facts",
            "Generate Medicronis-format SSR Excel (DATA sheet) for day, week, or month views",
            "Manage distributors, products, and per-distributor PDF templates",
            "Bulk import distributors and products from Excel (.xlsx) templates",
        ]
    )
    m.heading("1.4 End-to-End Workflow Overview", 2)
    m.paragraph("The typical workflow follows these stages:")
    m.steps(
        [
            "Log in to the application",
            "Upload a distributor PDF sales report (distributor auto-detected from PDF header)",
            "System extracts product rows and matches them to the catalog",
            "Resolve any unmatched rows in the Review Queue (if required)",
            "Approve the document and promote data to sales facts",
            "Generate an SSR report and download the Excel file",
        ]
    )

    # --- 2. Getting Started ---
    m.heading("2. Getting Started", 1)
    m.heading("2.1 System Requirements", 2)
    m.bullets(
        [
            "Web browser (Chrome, Edge, Firefox, or Safari — latest version recommended)",
            "Network access to the Medicronis application URL",
            "Valid login password (provided by your administrator)",
        ]
    )
    m.paragraph(
        "Note: System administrators also need Node.js, PostgreSQL, and Python 3.11+ "
        "for local development. End users only need a browser."
    )
    m.heading("2.2 Accessing the Application", 2)
    m.paragraph(
        "Open your web browser and navigate to the application URL provided by your administrator."
    )
    m.table(
        ["Environment", "URL"],
        [
            ["Local development", "http://localhost:3000"],
            ["Production / trial demo", "URL provided by your administrator"],
        ],
    )
    m.paragraph(
        "When you first visit the application, you will be redirected to the login page."
    )

    # --- 3. Logging In ---
    m.heading("3. Logging In", 1)
    m.heading("3.1 Login Steps", 2)
    m.steps(
        [
            "Navigate to the application URL in your browser",
            "You will be redirected to the Login page (/login)",
            "Enter your password in the password field",
            'Click the "Sign In" button',
            "Upon successful login, you will be taken to the Dashboard",
        ]
    )
    m.heading("3.2 Login Credentials", 2)
    m.table(
        ["Field", "Value"],
        [
            ["Username", "Not required (single shared password authentication)"],
            ["Password", "Provided by administrator (default demo password: demo)"],
            ["Session duration", "7 days (HTTP-only secure cookie)"],
        ],
    )
    m.heading("3.3 Logging Out", 2)
    m.paragraph(
        "To log out, click the Logout option in the application navigation. "
        "This clears your session cookie and returns you to the login page."
    )

    # --- 4. Dashboard ---
    m.heading("4. Dashboard", 1)
    m.paragraph(
        "The Dashboard (/dashboard) is your home screen after login. It provides an "
        "at-a-glance view of sales data and processing activity."
    )
    m.heading("4.1 Dashboard Sections", 2)
    m.table(
        ["Section", "Description"],
        [
            ["Key Performance Indicators (KPIs)", "Summary metrics including total sales, document counts, and match rates"],
            ["Sales Chart", "Visual trend of approved sales data over time"],
            ["Processing Summary", "Count of documents by status (uploaded, processing, extracted, review required, approved)"],
            ["Template Coverage", "Percentage of distributors with configured PDF templates"],
            ["Recent Activity", "Latest document uploads and processing events"],
        ],
    )
    m.heading("4.2 Using the Dashboard", 2)
    m.bullets(
        [
            "Review KPIs to monitor overall sales performance",
            "Check the processing summary for documents awaiting action",
            "Use recent activity links to jump directly to document details",
            "If the sales chart appears empty, approve at least one document first",
        ]
    )

    # --- 5. Uploading Documents ---
    m.heading("5. Uploading Documents", 1)
    m.paragraph(
        "The Upload page (/upload) is where you submit distributor PDF sales reports "
        "for extraction and SSR generation."
    )
    m.heading("5.1 Before You Upload", 2)
    m.bullets(
        [
            "Have the PDF sales report ready (single .pdf, multiple PDFs, or a .zip archive)",
            "Set the correct report date (the business date the PDF represents)",
            "Ensure the matched distributor has a configured PDF template",
            "For auto-detect to work, the distributor name must appear in the PDF header",
            "Confirm the PDF worker service is running (administrator responsibility)",
        ]
    )
    m.heading("5.2 Supported Upload Formats", 2)
    m.table(
        ["Format", "Description"],
        [
            ["Single PDF", "One distributor sales report; distributor auto-detected from PDF header"],
            ["Multiple PDFs", "Select or drag several PDF files; each is processed individually"],
            ["ZIP archive", "One .zip file containing multiple PDFs; all PDFs inside are extracted and processed"],
        ],
    )
    m.heading("5.3 Distributor Selection", 2)
    m.paragraph(
        "By default, the system reads the distributor name from each PDF header and matches it "
        "to a registered distributor. Manual selection is optional."
    )
    m.heading("5.3.1 Single PDF Upload", 3)
    m.bullets(
        [
            'Leave the distributor dropdown on "Auto-detect from PDF header" (recommended)',
            "Optionally choose a distributor override if the header match is wrong or missing",
            "Distributors without a configured template are disabled in the dropdown",
            'If override is selected and template is missing, click "Configure PDF template" to set one up',
        ]
    )
    m.heading("5.3.2 Bulk Upload (Multiple PDFs or ZIP)", 3)
    m.bullets(
        [
            "Each PDF is matched to its own distributor from the PDF header automatically",
            "No manual distributor selection is required for bulk uploads",
            'Optional: check "Apply same distributor to all files" to force one distributor for every PDF',
            "Use the override only when all files belong to the same distributor but headers differ",
        ]
    )
    m.heading("5.4 Upload Steps", 2)
    m.steps(
        [
            "Click Upload in the sidebar navigation",
            "Drag and drop PDF or ZIP files onto the upload area, or click Browse Files",
            "Remove unwanted files using the X button next to each file name",
            "Set the report date (Business date this PDF represents) — cannot be in the future",
            "Optionally set a distributor override (single file) or apply-to-all (bulk upload)",
            'Click "Upload Document(s)" to start processing',
            "Watch the Processing Pipeline stepper on the right: Upload → Extract → Match Products → Review Exceptions",
            "For a single successful upload, you are automatically redirected to the document detail page",
            "For bulk uploads, review the Upload Results card and click Open document for each file",
        ]
    )
    m.heading("5.5 What Happens During Processing", 2)
    m.paragraph(
        "When you upload, the system performs these steps automatically for each PDF:"
    )
    m.steps(
        [
            "Detects or applies the distributor and loads its saved PDF template configuration",
            "Saves the uploaded file to secure storage",
            "Sends the PDF to the extraction service (PDF worker on port 8000)",
            "Extracts product rows using table parsing or fallback methods",
            "Matches extracted rows against the product catalog using fuzzy matching",
            "Saves extracted rows and match results to the database",
            "Sets document status based on extraction and match results",
        ]
    )
    m.heading("5.6 Extraction Methods", 2)
    m.paragraph(
        "After processing, a toast notification shows which extraction method was used. "
        "The system tries methods automatically — no user action is required."
    )
    m.table(
        ["Method", "Display Label", "When Used"],
        [
            ["table", "Table extraction", "Default — PDF has a parseable table grid"],
            ["line_fallback", "Line parser", "Fallback when table extraction yields poor results"],
            ["alternate_settings", "Alternate pdfplumber", "Retry with alternate pdfplumber parsing settings"],
        ],
    )
    m.heading("5.7 Document Status After Upload", 2)
    m.table(
        ["Status", "Meaning", "Your Next Action"],
        [
            ["EXTRACTED", "All rows matched successfully", "Approve & Promote to Sales"],
            ["REVIEW_REQUIRED", "Some rows could not be matched", "Resolve in Review Queue"],
            ["TEMPLATE_MISMATCH", "PDF layout differs from saved template", "Re-map PDF Template on document detail"],
            ["FAILED", "Extraction error or distributor not detected", "Check error message; retry upload or fix template"],
            ["PROCESSING", "Upload is still being processed", "Wait for completion"],
        ],
    )
    m.heading("5.8 Upload Results Panel", 2)
    m.paragraph(
        "When uploading multiple files, an Upload Results card appears listing each file with:"
    )
    m.bullets(
        [
            "File name and status badge (EXTRACTED, REVIEW_REQUIRED, TEMPLATE_MISMATCH, FAILED)",
            "Matched distributor name (or suggested distributor if detection failed)",
            "Error message for failed files",
            "Open document link for successfully processed files",
        ]
    )
    m.heading("5.9 Warnings and Notifications", 2)
    m.bullets(
        [
            "Duplicate warning if an approved document already exists for the same distributor and report date",
            "Template mismatch toast when one or more documents need template re-mapping",
            "Extraction method toast showing table, line parser, or alternate pdfplumber usage",
            "Per-file warnings displayed as error toasts for partial batch failures",
        ]
    )

    # --- 6. Document Management ---
    m.heading("6. Document Management", 1)
    m.heading("6.1 Documents List", 2)
    m.paragraph(
        "The Documents page (/documents) shows all uploaded PDFs with their current status, "
        "distributor, report date, row counts, and match rates."
    )
    m.bullets(
        [
            "Click any document row to open its detail page",
            "Use status filters to find documents needing attention",
            "Sort by date to see the most recent uploads first",
        ]
    )
    m.heading("6.2 Document Detail Page", 2)
    m.paragraph(
        "The document detail page (/documents/[id]) provides full information about a "
        "single uploaded report."
    )
    m.heading("6.2.1 Page Sections", 3)
    m.table(
        ["Section", "Description"],
        [
            ["Header", "File name, distributor, report date, status badge, and action buttons"],
            ["Processing Timeline", "Stepper showing Uploaded → Extracted → Product Match → Review → Approved"],
            ["Summary Metrics", "Total rows extracted, match rate, unmatched count"],
            ["Extracted Rows Table", "All product rows with extracted values and match status"],
        ],
    )
    m.heading("6.2.2 Available Actions", 3)
    m.table(
        ["Action", "When Available", "Result"],
        [
            ["Approve & Promote to Sales", "Status is EXTRACTED with no unresolved rows", "Creates DailySalesFact records; status becomes APPROVED"],
            ["Resolve in Review Queue", "Status is REVIEW_REQUIRED", "Opens Review Queue to resolve unmatched rows"],
            ["Re-map PDF Template", "Status is TEMPLATE_MISMATCH", "Opens Template Wizard to fix column mapping"],
            ["Retry Upload", "Status is FAILED", "Returns to Upload page to submit a new file"],
            ["Generate SSR", "Status is APPROVED", "Creates an SSR report for this document's report date"],
        ],
    )
    m.heading("6.3 Document Status Lifecycle", 2)
    m.paragraph("Documents progress through the following statuses:")
    m.paragraph(
        "UPLOADED → PROCESSING → EXTRACTED | REVIEW_REQUIRED | TEMPLATE_MISMATCH | FAILED"
    )
    m.paragraph("After review (if needed): EXTRACTED → APPROVED → SSR Generated")

    # --- 7. Review Queue ---
    m.heading("7. Review Queue", 1)
    m.paragraph(
        "The Review Queue (/review) is where you resolve product rows that could not be "
        "automatically matched to the catalog. A badge on the sidebar shows the count of "
        "pending review items."
    )
    m.heading("7.1 When Review Is Required", 2)
    m.bullets(
        [
            "Product name in the PDF does not match any catalog entry",
            "Multiple possible matches exist and confidence is too low",
            "Product is new and not yet in the catalog",
            "Distributor uses a non-standard product name or abbreviation",
        ]
    )
    m.heading("7.2 Resolving Review Items", 2)
    m.steps(
        [
            "Navigate to Review Queue from the sidebar (note the badge count)",
            "Review each unmatched row showing the extracted product name and suggested matches",
            "Choose one of the resolution options for each row (see table below)",
            "After resolving all rows, return to the document detail page",
            "Document status will update to EXTRACTED when all rows are resolved",
            "Proceed to Approve & Promote to Sales",
        ]
    )
    m.heading("7.3 Resolution Options", 2)
    m.table(
        ["Option", "When to Use", "Effect"],
        [
            ["Approve with Suggested Product", "System suggestion is correct", "Maps row to suggested catalog product; saves mapping for future uploads"],
            ["Select from Dropdown", "Correct product is in catalog but not top suggestion", "Maps row to selected product; saves mapping for future uploads"],
            ["Create New Product", "Product is genuinely new", "Creates catalog entry (Group required) and maps the row"],
            ["Reject Row", "Row is invalid, duplicate, or not a real product", "Excludes row from approved sales data"],
        ],
    )
    m.paragraph(
        "When creating a new product from Review, you must select a product group "
        "(Medicronis or Transformer). The form defaults to Medicronis when available. "
        "Quantity on review cards is labeled Sales Units to match SSR terminology."
    )
    m.paragraph(
        "Important: Approved mappings are saved as DistributorProductMapping records. "
        "Future uploads from the same distributor will automatically match these product names."
    )
    m.heading("7.4 Example Workflow with Review", 2)
    m.paragraph(
        "Sample file: pharmalink_jul2026.pdf (in samples/pdfs/ after running the sample generator)"
    )
    m.steps(
        [
            "Upload pharmalink_jul2026.pdf with auto-detect enabled",
            "Document status becomes REVIEW_REQUIRED",
            "Open Review Queue and resolve each exception",
            "Return to document detail — status becomes EXTRACTED",
            'Click "Approve & Promote to Sales"',
            "Generate SSR and download Excel",
        ]
    )

    # --- 8. SSR Reports ---
    m.heading("8. SSR Reports", 1)
    m.paragraph(
        "SSR (Secondary Sales Report) reports consolidate approved sales data into "
        "Medicronis-format Excel workbooks. The on-screen preview and downloaded file "
        "both use the same DATA sheet column layout."
    )
    m.heading("8.1 Generating Reports from the Reports Page", 2)
    m.steps(
        [
            "Navigate to SSR Reports (/reports) from the sidebar",
            "Select the report view: Day, Week, or Month",
            "Set the as-of date for the reporting period",
            "Review the coverage indicator showing how many distributors have approved data",
            'Click "Generate SSR" to create the consolidated report',
            "You will be redirected to the report detail page",
        ]
    )
    m.heading("8.2 Generating Reports from a Document", 2)
    m.steps(
        [
            "Open an approved document's detail page",
            'Click "Generate SSR"',
            "A day-view SSR report is created for that document's report date",
        ]
    )
    m.heading("8.3 Report Detail and Download", 2)
    m.paragraph(
        "The report detail page (/reports/[id]) shows a full DATA-sheet preview titled "
        '"Updated Sales Till DD-MM-YY", with the same columns as the Excel download. '
        "Product Name and Sales Value are emphasized for quick scanning."
    )
    m.steps(
        [
            "Open the report from the Reports list or after generation",
            "Scroll horizontally through the preview grid to review all metrics",
            'Click "Download Excel" to save the .xlsx file (DATA sheet)',
            "Open the downloaded file in Microsoft Excel or compatible spreadsheet software",
        ]
    )
    m.heading("8.4 Report Views and Date Ranges", 2)
    m.table(
        ["View", "Period Covered", "Prior Comparison (\"Yesterday\" columns)"],
        [
            ["Day", "Single as-of date", "Previous calendar day"],
            ["Week", "Week containing the as-of date", "Prior week window"],
            ["Month", "Month containing the as-of date", "Prior month matching window"],
        ],
    )
    m.paragraph(
        "LMTD (Last Month To Date) columns always compare against the same calendar day "
        "in the prior month, regardless of Day/Week/Month view."
    )
    m.heading("8.5 SSR DATA Sheet Columns", 2)
    m.paragraph(
        "Each row is one distributor × product combination from the active master grid. "
        "Products without sales in the period still appear with zero units where applicable."
    )
    m.table(
        ["Column", "Description"],
        [
            ["Distributor Name, City, Region, Country", "Distributor master data"],
            ["Category", "Always \"Distributor\" for this grid"],
            ["Group", "Product group: Medicronis or Transformer"],
            ["Manager", "Assigned sales manager for the distributor"],
            ["Product Name", "Catalog product name"],
            ["S.P", "Selling price used for value calculations"],
            ["Sales Units", "Units sold in the selected period"],
            ["Closing Stock", "Latest closing stock on/before as-of date (— if missing)"],
            ["Sales Value", "Sales Units × S.P"],
            ["Stock Value", "Closing Stock × S.P (0 when stock missing in Excel)"],
            ["Yesterday / Yesterday Sale Value", "Prior-period units and value (label kept for Medicronis workbook parity)"],
            ["Difference", "Current Sales Value − prior-period sale value"],
            ["LMTD Sales Unit / Value", "Same-day-prior-month units and value"],
            ["LMTD Difference (units / value)", "Current − LMTD for units and value"],
            ["LMTD %age", "(Sales Value / LMTD Sales Value − 1), or \"-\" if LMTD value is zero"],
            ["Inventory", "Sales Units × 1.5 (target stock heuristic)"],
            ["Order / Order Value", "Units (and value) needed when Inventory > Closing Stock"],
            ["Excess Stock / Excess Stock Value", "Units (and value) when Closing Stock > Inventory"],
            ["Inventory Value", "Inventory × S.P"],
        ],
    )
    m.heading("8.6 Related Export Layouts", 2)
    m.paragraph(
        "The primary user download from SSR Reports is the DATA sheet workbook described above. "
        "The platform also supports a Wholeseller (Direct Party) line layout used in related "
        "exports: Party Name, Product, Quatity, S.P, Value, with Total Direct Sale and Total Sales rows."
    )

    # --- 9. Distributors ---
    m.heading("9. Managing Distributors", 1)
    m.paragraph(
        "The Distributors page (/distributors) lets you view and manage your distributor network."
    )
    m.heading("9.1 Distributor List", 2)
    m.bullets(
        [
            "View all registered distributors with code, name, region, country, city, manager, and template status",
            "Search by code, name, city, manager, region, or country",
            "Filter visually by Active / Inactive status badges",
            "See Template Ready vs Template required badges (template required before upload)",
            "Document and mapping counts per distributor",
        ]
    )
    m.heading("9.2 Adding a Distributor", 2)
    m.steps(
        [
            "Navigate to Distributors",
            'Click "Add Distributor"',
            "Enter distributor details: code, name, region, country, city, and assigned manager",
            "Save the new distributor record",
            "Configure the PDF template before uploading documents (see Section 10)",
        ]
    )
    m.heading("9.3 Bulk Upload", 2)
    m.steps(
        [
            "On the Distributors page, click the bulk upload option",
            "Download the Excel (.xlsx) template if needed",
            "Fill in distributor details following the template columns",
            "Upload the completed .xlsx file",
            "Review imported records and configure templates as needed",
        ]
    )
    m.heading("9.4 Distributor Fields", 2)
    m.table(
        ["Field", "Description", "Required"],
        [
            ["Code", "Unique distributor identifier", "Yes"],
            ["Name", "Full distributor business name (used for PDF header matching)", "Yes"],
            ["Region", "Geographic region", "Yes"],
            ["Country", "Country of operation", "Yes"],
            ["City", "City location", "Optional"],
            ["Manager", "Assigned sales manager", "Optional"],
            ["Active", "Whether distributor is active for uploads", "Yes"],
        ],
    )

    # --- 10. PDF Template Configuration ---
    m.heading("10. PDF Template Configuration", 1)
    m.paragraph(
        "Each distributor's PDF reports have a unique layout. Before uploading documents "
        "for a distributor, you must configure a PDF template that maps the PDF columns "
        "to the system's data fields."
    )
    m.heading("10.1 When Template Configuration Is Required", 2)
    m.bullets(
        [
            "Adding a new distributor to the system",
            "Distributor's PDF layout has changed",
            "Upload results in TEMPLATE_MISMATCH status",
            "Template Required badge appears on the Upload or Distributors page",
        ]
    )
    m.heading("10.2 Template Mismatch Triggers", 2)
    m.paragraph(
        "The system flags TEMPLATE_MISMATCH when any of the following occur:"
    )
    m.bullets(
        [
            "PDF layout cannot be parsed with the saved template mapping",
            "Column headers cannot be resolved from the saved template mapping",
            "Extracted row count drops more than 30% compared to the last successful upload",
        ]
    )
    m.heading("10.3 Template Wizard Steps", 2)
    m.paragraph(
        "Access the template wizard from Distributors → select distributor → "
        "Configure PDF Template (/distributors/[id]/template), or from the "
        "Re-map PDF Template button on a mismatched document."
    )
    m.steps(
        [
            "Upload a sample PDF from the distributor",
            "Review the auto-suggested PDF format family (A through J)",
            "Map header columns to system fields (product name, quantity, net sale, closing stock, etc.)",
            "Preview extraction results to verify row data is correct",
            "Adjust advanced settings if needed (skip rows, extraction mode, line-fallback)",
            "Save the template configuration",
            "Return to Upload and process PDFs for this distributor",
        ]
    )
    m.heading("10.4 PDF Format Families", 2)
    m.paragraph(
        "The system supports 10 PDF layout families (A–J) covering 46 real distributor "
        "report formats from July Closing analysis. Each family has a preset column structure."
    )
    m.table(
        ["Family", "Description", "Example Distributors"],
        [
            ["A", "SSR Stock & Return — grouped two-row header", "AIM Pharma HYD, Reliable Pharma MPK"],
            ["B", "Medicronis ERP Sales and Stock Statement", "AQ Enterprises Sargodha, N&G Enterprises SWL"],
            ["C", "Item Description / Net Sales", "Bashir Pharma Gujranwala, M&C RWP"],
            ["D", "Product Name T.P. Tax — 19-column", "Al Makkah Trading Buner, Umar Medicine Swabi"],
            ["E", "TRAD RATE / NET SALE", "Hamed Pharma Bannu, Mehran Traders Mardan"],
            ["F", "Simple Description / Sales Qty / Sale Value", "Simple single-row header layouts"],
            ["G–J", "Additional layout variants", "See docs/pdf-families.md for full list"],
        ],
    )
    m.heading("10.5 Field Mapping Reference", 2)
    m.table(
        ["System Field", "Typical PDF Column Names", "Required"],
        [
            ["Product Name", "ITEM, DESCRIPTION, Product Name, Item Description", "Yes"],
            ["Quantity", "QTY, SALE, Sales Qty, Quantity Sold", "Yes"],
            ["Net Sale", "NET SALE, Net Sales, Sale Value, AMOUNT", "Yes"],
            ["Closing Stock", "CLOSING, Closing Balance, Stock", "Optional"],
            ["Rate / TP", "RATE, TP, TRAD RATE, T.P.", "Optional"],
        ],
    )

    # --- 11. Products ---
    m.heading("11. Managing Products", 1)
    m.paragraph(
        "The Products page (/products) manages the product catalog used for matching "
        "extracted PDF rows."
    )
    m.heading("11.1 Product Catalog", 2)
    m.bullets(
        [
            "View all products with SKU, name, manufacturer, and pricing fields",
            "Search and filter products by name or SKU",
            "See product aliases used for fuzzy matching",
        ]
    )
    m.heading("11.2 Adding a Product", 2)
    m.steps(
        [
            "Navigate to Products",
            'Click "Add Product"',
            "Enter SKU, product name, manufacturer, and pricing fields",
            "Add aliases if the product is known by alternate names",
            "Save the product",
        ]
    )
    m.heading("11.3 Bulk Product Upload", 2)
    m.steps(
        [
            "Download the CSV template from the Products page",
            "Fill in product details following the template format",
            "Upload the completed CSV file",
            "Verify imported products appear in the catalog",
        ]
    )
    m.heading("11.4 Product Aliases", 2)
    m.paragraph(
        "Aliases are alternate names for a product used during fuzzy matching. "
        "For example, a product might appear in distributor PDFs as an abbreviated name "
        "or regional spelling variant. Adding aliases improves automatic match rates."
    )

    # --- 12. Complete Workflows ---
    m.heading("12. Complete Workflows", 1)
    m.heading("12.1 Quick Demo Path (No Review Required)", 2)
    m.paragraph(
        "Use sample file medsupply_jul2026.pdf for the fastest end-to-end demonstration."
    )
    m.steps(
        [
            "Log in with password: demo",
            "Go to Upload",
            "Set report date and upload medsupply_jul2026.pdf (auto-detect distributor from header)",
            "You are redirected to document detail — verify 6 extracted rows with high match rate",
            'Click "Approve & Promote to Sales"',
            "Go to Reports or click Generate SSR on the document",
            'Click "Download Excel" and open the .xlsx file',
        ]
    )
    m.heading("12.2 Full Workflow with Review", 2)
    m.steps(
        [
            "Log in to the application",
            "Upload pharmalink_jul2026.pdf with auto-detect enabled",
            "Document status becomes REVIEW_REQUIRED",
            "Open Review Queue from sidebar (check badge count)",
            "Resolve each unmatched row (approve, select, create, or reject)",
            "Return to document detail — status becomes EXTRACTED",
            'Click "Approve & Promote to Sales"',
            "Generate SSR report",
            "Download and verify Excel output",
        ]
    )
    m.heading("12.3 Bulk Upload Workflow", 2)
    m.steps(
        [
            "Collect PDF sales reports from multiple distributors",
            "Go to Upload and drag all PDF files (or a ZIP) into the upload area",
            "Set the shared report date for all files",
            "Leave distributor on auto-detect (each PDF matched from its header)",
            'Click "Upload Documents"',
            "Review the Upload Results card for each file's status",
            "Resolve review items, approve each document, then generate consolidated SSR",
        ]
    )
    m.heading("12.4 Setting Up a New Distributor", 2)
    m.steps(
        [
            "Add the distributor on the Distributors page (or bulk CSV upload)",
            "Open the distributor and launch the Template Wizard",
            "Upload a sample PDF and configure column mapping",
            "Save the template and verify Template Ready shows true",
            "Upload the first real sales report PDF with auto-detect or override",
            "Complete review if needed, then approve and generate SSR",
        ]
    )
    m.heading("12.5 Monthly Reporting Cycle", 2)
    m.steps(
        [
            "Collect PDF sales reports from all active distributors for the month",
            "Upload PDFs individually or in bulk with the correct report date",
            "Resolve all review queue items across all documents",
            "Approve all extracted documents",
            "Go to Reports, select Month view, set the month-end date",
            "Generate consolidated SSR and download Excel",
            "Distribute the SSR report to stakeholders",
        ]
    )

    # --- 13. Troubleshooting ---
    m.heading("13. Troubleshooting", 1)
    m.heading("13.1 Common Issues and Solutions", 2)
    m.table(
        ["Issue", "Possible Cause", "Solution"],
        [
            ["Upload fails or 'Extraction failed'", "PDF worker service not running", "Ask administrator to start PDF worker; verify health at port 8000"],
            ["Could not detect distributor from PDF header", "Distributor name not in PDF or not registered", "Register distributor or use manual override on Upload page"],
            ["Could not match distributor from PDF header", "Name in PDF differs from registered name", "Fix distributor name or use manual override"],
            ["Database errors on any page", "Database not initialized", "Administrator: run migrations and seed data"],
            ["Empty dashboard sales chart", "No approved documents yet", "Approve at least one document to populate chart"],
            ["Template required on upload", "Distributor has no configured template", "Configure template via Template Wizard (Section 10)"],
            ["TEMPLATE_MISMATCH status", "PDF layout changed or wrong mapping", "Click Re-map PDF Template; check row count drop >30%"],
            ["Review queue won't clear", "Unresolved UNMATCHED/PENDING rows remain", "Resolve all rows in Review Queue before approval"],
            ["Approval blocked", "Unresolved review rows exist", "Complete all review items first"],
            ["Duplicate upload warning", "Approved doc exists for same distributor + date", "Expected; only re-upload to replace existing data"],
            ["Scanned PDF fails", "No extractable text in PDF", "Administrator: install Tesseract OCR on worker"],
            ["Downloaded Excel is empty", "No approved data for selected period", "Approve documents for the report date first"],
            ["Session expired", "7-day cookie expired", "Log in again with your password"],
        ],
    )
    m.heading("13.2 Document Status Reference", 2)
    m.table(
        ["Status", "Description"],
        [
            ["UPLOADED", "File saved, processing not yet started"],
            ["PROCESSING", "Extraction and matching in progress"],
            ["EXTRACTED", "All rows extracted and matched — ready for approval"],
            ["REVIEW_REQUIRED", "Some rows need manual resolution in Review Queue"],
            ["TEMPLATE_MISMATCH", "PDF layout does not match configured template"],
            ["FAILED", "Processing error — check PDF quality and retry"],
            ["APPROVED", "Data promoted to sales facts — ready for SSR generation"],
        ],
    )
    m.heading("13.3 Getting Help", 2)
    m.bullets(
        [
            "Contact your system administrator for login issues, service outages, or template configuration",
            "Refer to docs/pdf-families.md for detailed PDF format family documentation",
            "Run the smoke test checklist (SMOKE_TEST.md) to validate system health",
        ]
    )

    # --- 14. Appendix ---
    m.heading("14. Appendix", 1)
    m.heading("14.1 Navigation Reference", 2)
    m.table(
        ["Page", "Route", "Purpose"],
        [
            ["Dashboard", "/dashboard", "KPIs, charts, activity summary"],
            ["Upload", "/upload", "Submit PDF sales reports"],
            ["Documents", "/documents", "View all uploaded documents"],
            ["Document Detail", "/documents/[id]", "View rows, approve, generate SSR"],
            ["Review Queue", "/review", "Resolve unmatched product rows"],
            ["SSR Reports", "/reports", "Generate and list SSR reports"],
            ["Report Detail", "/reports/[id]", "Preview and download Excel"],
            ["Distributors", "/distributors", "Manage distributor network"],
            ["Template Wizard", "/distributors/[id]/template", "Configure PDF column mapping"],
            ["Products", "/products", "Manage product catalog"],
            ["Login", "/login", "Application authentication"],
        ],
    )
    m.heading("14.2 Glossary", 2)
    m.table(
        ["Term", "Definition"],
        [
            ["SSR", "Secondary Sales Report — consolidated Excel export of distributor sales data"],
            ["Auto-detect", "Automatic distributor identification from PDF header text"],
            ["PDF Format Family", "Preset layout template (A–J) for a class of distributor PDF reports"],
            ["Template Config", "Per-distributor column mapping stored in the database"],
            ["Daily Sales Fact", "Approved sales record promoted from an extracted document row"],
            ["Match Rate", "Percentage of extracted rows successfully matched to catalog products"],
            ["Review Queue", "List of unmatched rows requiring manual resolution"],
            ["Distributor Product Mapping", "Saved alias linking a distributor's product name to a catalog SKU"],
            ["Processing Pipeline", "Upload → Extract → Match Products → Review Exceptions stepper on Upload page"],
        ],
    )
    m.heading("14.3 Known Limitations (Demo Version)", 2)
    m.bullets(
        [
            "Single shared password — no multi-user role-based access control",
            "Synchronous processing — no background job queue",
            "10 PDF format families — custom parsers require Phase 4 development",
            "OCR is optional — scanned PDFs may fail without Tesseract installed",
            "No email notifications, audit trail, or ERP integration",
            "Cloud deployments may use ephemeral file storage (files lost on cold start)",
        ]
    )
    m.heading("14.4 Sample Files", 2)
    m.paragraph("Sample PDF files for testing can be generated with:")
    m.code_line("python scripts/generate_sample_pdfs.py")
    m.bullets(
        [
            "medsupply_jul2026.pdf — quick demo path, no review required (6 rows)",
            "pharmalink_jul2026.pdf — demo with review queue exceptions",
        ]
    )

    m.page_break()
    footer_p = m.doc.add_paragraph()
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer_p.add_run(
        f"Medicronis Sales Intelligence User Manual — Version {MANUAL_VERSION} — "
        f"{date.today().strftime('%B %Y')}"
    )
    run.font.size = Pt(10)
    run.font.color.rgb = RGBColor(100, 100, 100)
    run.italic = True


def build_manual() -> Path:
    doc = Document()
    title_break = add_title_page(doc)

    m = ManualBuilder(doc=doc)
    write_content(m)

    toc_elements = build_toc_elements(doc, m.toc)
    anchor = title_break
    for el in toc_elements:
        anchor.addnext(el)
        anchor = el

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT))
    return OUTPUT


if __name__ == "__main__":
    path = build_manual()
    print(f"User manual created: {path}")
