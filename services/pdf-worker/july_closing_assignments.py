"""July Closing PDF filename → distributor / format / template overrides (mirrors prisma/july-closing-distributors.ts)."""

from __future__ import annotations

from typing import Any

from presets import (
    FAMILY_A_16COL,
    FAMILY_D_AL_MAKKAH,
    FAMILY_G_ZAVION,
    FAMILY_I_HASHMANI,
    FAMILY_J_AMT,
    FAMILY_J_AYAN,
    FAMILY_J_BUKHARI,
    FAMILY_J_CH_MEDICINE,
    FAMILY_J_GLOBAL,
    FAMILY_J_LIFE_CARE,
    FAMILY_J_ZAFAR,
    FAMILY_Z_EVERGREEN,
    FAMILY_Z_HAMZA,
    preset_config_for_code,
)

JulyClosingEntry = dict[str, Any]


JULY_CLOSING_DISTRIBUTORS: list[JulyClosingEntry] = [
    {
        "code": "AIM-HYD",
        "name": "AIM Pharma HYD",
        "formatCode": "fmt-a-ssr-stock-return",
        "family": "A",
        "julyClosingPdfs": ["AIM Pharma HYD.pdf"],
    },
    {
        "code": "LAL-SIBBI",
        "name": "Lal Drug Agency Sibbi",
        "formatCode": "fmt-a-ssr-stock-return",
        "family": "A",
        "julyClosingPdfs": ["Lal Drug Agency Sibbi.pdf"],
    },
    {
        "code": "RELIABLE-MPK",
        "name": "Reliable Pharma MPK",
        "formatCode": "fmt-a-ssr-stock-return",
        "family": "A",
        "julyClosingPdfs": ["Reliable Pharma MPK.pdf"],
    },
    {
        "code": "AL-HARAM-KOHAT",
        "name": "Al Haram Enterprises Kohat",
        "formatCode": "fmt-a-ssr-stock-return",
        "family": "A",
        "julyClosingPdfs": ["Al Haram Enterprises Kohat.pdf"],
        "templateConfig": FAMILY_A_16COL,
    },
    {
        "code": "AL-SHIFA-JAMPUR",
        "name": "AL Shifa Enterprises Jampur",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["AL Shifa Enterprises Jampur.pdf"],
    },
    {
        "code": "AQ-SARGODHA",
        "name": "AQ Enterprises Sargodha",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["AQ Enterprises Sargodha.pdf"],
    },
    {
        "code": "AL-HARMAIN-DGK",
        "name": "Al Harmain Enterprises DG Khan",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["Al Harmain ENterprises DG Khan.pdf"],
    },
    {
        "code": "NG-SWL",
        "name": "N&G Enterprises SWL",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["N&G Enterprises SWL.pdf"],
    },
    {
        "code": "WELLCOME-ALIPUR",
        "name": "Wellcome Pharma Ali Pur",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["Wellcome Pharma alipur.pdf"],
    },
    {
        "code": "SHAHZAIB-OKARA",
        "name": "Shahzaib Pharma Okara",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["sHAHZAIB pHARMA Okara30.pdf"],
    },
    {
        "code": "RUMAN-PROMO-RYK",
        "name": "Ruman Medicine Promotion RYK",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["Ruman Medicine Promotion RYK.pdf"],
    },
    {
        "code": "RUMAN-TRADE-RYK",
        "name": "Ruman Medicine Trade RYK",
        "formatCode": "fmt-b-medicronis-erp",
        "family": "B",
        "julyClosingPdfs": ["Ruman Medicine Trade RYK.pdf"],
    },
    {
        "code": "EVERGREEN-DIK",
        "name": "Evergreen Enterprises DI Khan",
        "formatCode": "fmt-e-trad-rate-net-sale",
        "family": "E",
        "julyClosingPdfs": ["Evergreen Enterprises DI Khan.pdf"],
        "templateConfig": FAMILY_Z_EVERGREEN,
    },
    {
        "code": "AL-REHMAN-LHR",
        "name": "Al Rehman Medical Sources Lahore",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": [
            "Al Rehman  Medical Sources Lahore.pdf",
            "Al Rehman Medical Sources Lahore.pdf",
        ],
    },
    {
        "code": "BASHIR-GUJ",
        "name": "Bashir Pharma Gujranwala",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": ["Bashir Pharma Gujranwala.pdf"],
    },
    {
        "code": "MC-RWP",
        "name": "M&C RWP",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": ["M&C RWP.pdf"],
    },
    {
        "code": "PHARMARITE-JEH",
        "name": "Pharmarite Distributor Jehlum",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": ["Pharmarite Distributor Jehlum.pdf"],
    },
    {
        "code": "SHAFIQ-KHANPUR",
        "name": "Shafiq Medicine Company Khanpur",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": ["Shafiq Medicine Company Khanpur.pdf"],
    },
    {
        "code": "HAJI-NIZAM-QTA",
        "name": "Haji Nizam & Sons Quetta",
        "formatCode": "fmt-c-item-desc-net-sales",
        "family": "C",
        "julyClosingPdfs": ["Haji Nizam & Sons Quetta.pdf"],
    },
    {
        "code": "FAIZ-RAJANPUR",
        "name": "Faiz Enterprises Rajanpur",
        "formatCode": "fmt-f-simple-sales",
        "family": "F",
        "julyClosingPdfs": ["Faiz Enterprises Rajanpur.pdf"],
    },
    {
        "code": "AL-MAKKAH-BUNER",
        "name": "Al Makkah Trading Buner",
        "formatCode": "fmt-d-product-name-tp-tax",
        "family": "D",
        "julyClosingPdfs": ["Al Makkah Trading Buner.PDF"],
        "templateConfig": FAMILY_D_AL_MAKKAH,
    },
    {
        "code": "KAMAL-TIMERGARAH",
        "name": "Kamal Medicine Company Timergarah",
        "formatCode": "fmt-d-product-name-tp-tax",
        "family": "D",
        "julyClosingPdfs": ["Kamal Medicine Company Timergarah.PDF"],
    },
    {
        "code": "MEDICAMP-PSW",
        "name": "Medicamp PSW",
        "formatCode": "fmt-d-product-name-tp-tax",
        "family": "D",
        "julyClosingPdfs": ["Medicamp PSW.PDF"],
    },
    {
        "code": "UMAR-SWABI",
        "name": "Umar Medicine Swabi",
        "formatCode": "fmt-d-product-name-tp-tax",
        "family": "D",
        "julyClosingPdfs": ["Umar Medicine Swabi.PDF"],
    },
    {
        "code": "HAMED-BANNU-PROMO",
        "name": "Hamed Pharma Bannu (Promotion)",
        "formatCode": "fmt-e-trad-rate-net-sale",
        "family": "E",
        "julyClosingPdfs": ["Hamed Pharma Bannu Promotion.pdf"],
    },
    {
        "code": "HAMED-BANNU-TRADE",
        "name": "Hamed Pharma Bannu (Trade)",
        "formatCode": "fmt-e-trad-rate-net-sale",
        "family": "E",
        "julyClosingPdfs": ["Hamed Pharma Bannu Trade.pdf"],
    },
    {
        "code": "MEHRAN-MARDAN",
        "name": "Mehran Traders Mardan",
        "formatCode": "fmt-e-trad-rate-net-sale",
        "family": "E",
        "julyClosingPdfs": ["Mehran Traders Mardan.pdf"],
    },
    {
        "code": "PUNJAB-LAYYAH",
        "name": "Punjab Medicine Layyah",
        "formatCode": "fmt-f-simple-sales",
        "family": "F",
        "julyClosingPdfs": ["Punjab Medicine Layyah 22.pdf"],
    },
    {
        "code": "CHISHTI-MULTAN",
        "name": "Chishti Pharma Multan",
        "formatCode": "fmt-g-code-product-net-sale",
        "family": "G",
        "julyClosingPdfs": ["Chishti Pharma Multan.pdf"],
    },
    {
        "code": "ZAVION-JHANG",
        "name": "Zavion Pharma Jhang",
        "formatCode": "fmt-g-code-product-net-sale",
        "family": "G",
        "julyClosingPdfs": ["Zavion Pharma Jhang.pdf"],
        "templateConfig": FAMILY_G_ZAVION,
    },
    {
        "code": "MASHAL-BAJAUR",
        "name": "Mashal Enterprises Bajaur",
        "formatCode": "fmt-h-name-price-sales",
        "family": "H",
        "julyClosingPdfs": ["Mashal Enterprises Bajaur.pdf"],
    },
    {
        "code": "HASHMANI-KHI",
        "name": "Hashmani Health Care Karachi",
        "formatCode": "fmt-i-vertical-qty-bon",
        "family": "I",
        "julyClosingPdfs": ["Hashmani Health Care Karachi.pdf"],
        "templateConfig": FAMILY_I_HASHMANI,
    },
    {
        "code": "AYAN-TAUNSA",
        "name": "Ayan Pharma Taunsa",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Ayan Pharma Taunsa.pdf"],
        "templateConfig": FAMILY_J_AYAN,
    },
    {
        "code": "CH-MED-MWL",
        "name": "Ch Medicine MWL",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Ch Medicine MWL.pdf"],
        "templateConfig": FAMILY_J_CH_MEDICINE,
    },
    {
        "code": "GLOBAL-SKP",
        "name": "Globar Enterprises SKP",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Globar Enterprises SKP.PDF"],
        "templateConfig": FAMILY_J_GLOBAL,
    },
    {
        "code": "MRWA-BWP",
        "name": "Mrwa Enterprises BWP",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Mrwa Enterprises BWP.pdf"],
    },
    {
        "code": "NOOR-KHAN-MINGORA",
        "name": "Noor Khan Mingora",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Noor Khan Mingora.pdf", "Noor KHan minogra promotion30.pdf"],
    },
    {
        "code": "ZAFAR-NWS",
        "name": "Zafar & Sons NWS",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Zafar & Sons NWS.pdf"],
        "templateConfig": FAMILY_J_ZAFAR,
    },
    {
        "code": "TAWAKAL-ABBT",
        "name": "New Tawakal Enterprises ABBT",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["New Tawakal Enterprises ABBT.pdf"],
    },
    {
        "code": "BUKHARI-MBD",
        "name": "Bukhari Traders MBD",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Bukhari Traders MBD.pdf"],
        "templateConfig": FAMILY_J_BUKHARI,
    },
    {
        "code": "AMT-FSD",
        "name": "AMT FSD",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["AMT FSD.pdf"],
        "templateConfig": FAMILY_J_AMT,
    },
    {
        "code": "HAMZA-TTS",
        "name": "Hamza Medicine TTS",
        "formatCode": "fmt-f-simple-sales",
        "family": "F",
        "julyClosingPdfs": ["Hamza Medicine TTS.pdf"],
        "templateConfig": FAMILY_Z_HAMZA,
    },
    {
        "code": "LIFE-CARE-GUJRAT",
        "name": "Life Care Distributor Gujrat",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["Life Care Distributor Gujrat.pdf"],
        "templateConfig": FAMILY_J_LIFE_CARE,
    },
    {
        "code": "HAMZA-TRADERS-KASUR",
        "name": "The Hamza Traders Kasur",
        "formatCode": "fmt-j-no-table",
        "family": "J",
        "julyClosingPdfs": ["The Hamza Traders Kasur.pdf"],
    },
]


def _build_pdf_index() -> dict[str, JulyClosingEntry]:
    index: dict[str, JulyClosingEntry] = {}
    for distributor in JULY_CLOSING_DISTRIBUTORS:
        for pdf_name in distributor["julyClosingPdfs"]:
            index[pdf_name] = {
                **distributor,
                "pdfFilename": pdf_name,
            }
    return index


PDF_ASSIGNMENTS: dict[str, JulyClosingEntry] = _build_pdf_index()


def lookup_pdf_assignment(filename: str) -> JulyClosingEntry | None:
    """Case-insensitive lookup by PDF basename."""
    if filename in PDF_ASSIGNMENTS:
        return PDF_ASSIGNMENTS[filename]
    lower = filename.lower()
    for key, entry in PDF_ASSIGNMENTS.items():
        if key.lower() == lower:
            return {**entry, "pdfFilename": key}
    return None


def resolve_template_config(entry: JulyClosingEntry) -> dict[str, Any]:
    """Return TemplateConfig dict for extraction."""
    override = entry.get("templateConfig")
    if override:
        config = dict(override)
    else:
        config = preset_config_for_code(entry["formatCode"])
    config.setdefault("_formatCode", entry["formatCode"])
    return config
