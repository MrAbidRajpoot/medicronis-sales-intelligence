from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from extractor import extract_pdf
from matcher import match_rows


class ExtractedRowOut(BaseModel):
    raw_product_text: str
    raw_product_code: str | None = None
    quantity: float = 0
    unit_price: float | None = None
    gross_value: float | None = None
    returns_qty: float | None = None
    closing_stock: float | None = None
    transaction_date: str | None = None
    customer_name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExtractResponse(BaseModel):
    distributor_hint: str
    suggested_format_code: str | None = None
    distributor_name_hint: str | None = None
    rows: list[ExtractedRowOut]
    confidence: float
    template_used: str
    template_resolution_ok: bool = True
    extract_method: str = "table"
    needs_template_remap: bool = False
    page_count: int


class ExtractHintResponse(BaseModel):
    distributor_name_hint: str | None = None


class MatchRowIn(BaseModel):
    raw_product_text: str
    raw_product_code: str | None = None
    quantity: float = 0
    unit_price: float | None = None
    gross_value: float | None = None
    returns_qty: float | None = None
    closing_stock: float | None = None
    transaction_date: str | None = None
    customer_name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class MappingIn(BaseModel):
    raw_product_text: str
    product_id: str
    confidence: float = 1.0


class ProductIn(BaseModel):
    id: str
    sku: str
    name: str


class AliasIn(BaseModel):
    alias: str
    product_id: str


class MatchRowsRequest(BaseModel):
    rows: list[MatchRowIn]
    distributor_id: str | None = None
    mappings: list[MappingIn] = Field(default_factory=list)
    products: list[ProductIn] = Field(default_factory=list)
    aliases: list[AliasIn] = Field(default_factory=list)


class MatchedRowOut(MatchRowIn):
    match_status: str
    confidence: float
    suggested_product_id: str | None = None
    suggested_product_sku: str | None = None
    suggested_product_name: str | None = None
    match_method: str | None = None


class MatchRowsResponse(BaseModel):
    rows: list[MatchedRowOut]
    matched_count: int
    review_count: int
    unknown_count: int


class MatchSuggestionsRequest(BaseModel):
    raw_product_text: str
    products: list[ProductIn] = Field(default_factory=list)
    aliases: list[AliasIn] = Field(default_factory=list)
    min_score: int = 60
    limit: int = 4


class ProductSuggestionOut(BaseModel):
    product_id: str
    sku: str | None = None
    name: str | None = None
    confidence: float
    match_method: str | None = None


class MatchSuggestionsResponse(BaseModel):
    suggestions: list[ProductSuggestionOut]


class LeafColumnOut(BaseModel):
    col: int
    group: str
    leaf: str


class AnalyzeHeadersResponse(BaseModel):
    suggestedFormatCode: str
    confidence: float
    family: str
    headerStructure: str
    headerGrid: list[list[str]] = Field(default_factory=list)
    detectedGroups: list[str] = Field(default_factory=list)
    leafColumns: list[LeafColumnOut] = Field(default_factory=list)
    suggestedMappings: dict[str, Any] = Field(default_factory=dict)
    unresolvedFields: list[str] = Field(default_factory=list)
    colCount: int | None = None
    usesLineParser: bool = False
