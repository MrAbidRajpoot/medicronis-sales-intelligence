from __future__ import annotations

import json

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from extractor import extract_distributor_name, extract_pdf
from header_analyzer import analyze_headers
from matcher import get_product_suggestions, match_rows
from schemas import (
    AnalyzeHeadersResponse,
    ExtractHintResponse,
    ExtractResponse,
    MatchRowsRequest,
    MatchRowsResponse,
    MatchedRowOut,
    MatchSuggestionsRequest,
    MatchSuggestionsResponse,
    ProductSuggestionOut,
)

app = FastAPI(
    title="Medicronis PDF Worker",
    description="PDF extraction and product matching for SSR sales reporting",
    version="0.3.0",
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
    format_code: str | None = Form(None),
    template_config: str | None = Form(None),
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
    config: dict | None = None
    if template_config:
        try:
            config = json.loads(template_config)
        except json.JSONDecodeError:
            config = None

    result = extract_pdf(
        pdf_bytes,
        template_config=config,
        distributor_code=distributor_code,
        format_code=format_code,
        use_ocr=use_ocr,
    )
    return ExtractResponse(**result)


@app.post("/extract-hint", response_model=ExtractHintResponse)
async def extract_hint(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return ExtractHintResponse(distributor_name_hint=None)

    pdf_bytes = await file.read()
    return ExtractHintResponse(distributor_name_hint=extract_distributor_name(pdf_bytes))


@app.post("/analyze-headers", response_model=AnalyzeHeadersResponse)
async def analyze_headers_endpoint(
    file: UploadFile = File(...),
    template_config: str | None = Form(None),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return AnalyzeHeadersResponse(
            suggestedFormatCode="fmt-j-no-table",
            confidence=0.0,
            family="J",
            headerStructure="line_fallback",
        )

    pdf_bytes = await file.read()
    config: dict | None = None
    if template_config:
        try:
            config = json.loads(template_config)
        except json.JSONDecodeError:
            config = None

    result = analyze_headers(pdf_bytes, template_config=config)
    return AnalyzeHeadersResponse(**result)


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


@app.post("/match-suggestions", response_model=MatchSuggestionsResponse)
async def match_suggestions_endpoint(body: MatchSuggestionsRequest):
    product_dicts = [p.model_dump() for p in body.products]
    alias_dicts = [a.model_dump() for a in body.aliases]

    suggestions = get_product_suggestions(
        body.raw_product_text,
        product_dicts,
        alias_dicts,
        min_score=body.min_score,
        limit=body.limit,
    )

    return MatchSuggestionsResponse(
        suggestions=[ProductSuggestionOut(**s) for s in suggestions],
    )
