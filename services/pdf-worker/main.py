from __future__ import annotations

import io

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from extractor import extract_pdf
from matcher import match_rows
from schemas import ExtractResponse, MatchRowsRequest, MatchRowsResponse, MatchedRowOut

app = FastAPI(
    title="Medicronis PDF Worker",
    description="PDF extraction and product matching for SSR sales reporting",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "pdf-worker"}


@app.post("/extract", response_model=ExtractResponse)
async def extract(
    file: UploadFile = File(...),
    distributor_code: str | None = Form(None),
    use_ocr: bool = Form(False),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return ExtractResponse(
            distributor_hint="unknown",
            rows=[],
            confidence=0.0,
            template_used="none",
            page_count=0,
        )

    pdf_bytes = await file.read()
    result = extract_pdf(pdf_bytes, distributor_code=distributor_code, use_ocr=use_ocr)
    return ExtractResponse(**result)


@app.post("/match-rows", response_model=MatchRowsResponse)
async def match_rows_endpoint(body: MatchRowsRequest):
    row_dicts = [r.model_dump() for r in body.rows]
    mapping_dicts = [m.model_dump() for m in body.mappings]
    product_dicts = [p.model_dump() for p in body.products]
    alias_dicts = [a.model_dump() for a in body.aliases]

    matched = match_rows(
        row_dicts,
        distributor_id=body.distributor_id,
        mappings=mapping_dicts,
        products=product_dicts,
        aliases=alias_dicts,
    )

    matched_count = sum(1 for r in matched if r["match_status"] == "matched")
    review_count = sum(1 for r in matched if r["match_status"] == "review")
    unknown_count = sum(1 for r in matched if r["match_status"] == "unknown")

    return MatchRowsResponse(
        rows=[MatchedRowOut(**r) for r in matched],
        matched_count=matched_count,
        review_count=review_count,
        unknown_count=unknown_count,
    )
