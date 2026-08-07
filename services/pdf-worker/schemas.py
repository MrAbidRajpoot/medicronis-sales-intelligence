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
    transaction_date: str | None = None
    customer_name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExtractResponse(BaseModel):
    distributor_hint: str
    distributor_name_hint: str | None = None
    rows: list[ExtractedRowOut]
    confidence: float
    template_used: str
    page_count: int


class MatchRowIn(BaseModel):
    raw_product_text: str
    raw_product_code: str | None = None
    quantity: float = 0
    unit_price: float | None = None
    gross_value: float | None = None
    returns_qty: float | None = None
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
