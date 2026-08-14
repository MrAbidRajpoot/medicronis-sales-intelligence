/**
 * Line-parser config / fieldMappings validation checks.
 * Run from apps/web: npx tsx --tsconfig tsconfig.json src/lib/__tests__/line-fallback-utils.test.ts
 */
import assert from "node:assert/strict";
import {
  isLineFieldMapped,
  isLineParserConfigured,
  resolveLineFieldMappings,
} from "../line-fallback-utils";
import type { LineParserConfig } from "../pdf-template-types";

function testLegacyConfigured() {
  const legacy: LineParserConfig = {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 2,
    salesAmountColumn: 3,
  };
  assert.equal(isLineParserConfigured(legacy), true);
  const mappings = resolveLineFieldMappings(legacy);
  assert.equal(mappings.product_name?.kind, "before_rate");
  assert.equal(mappings.unit_price?.kind, "rate_pattern");
  assert.deepEqual(mappings.sales_qty, { kind: "after_rate_index", index: 2 });
  assert.deepEqual(mappings.sales_amount, { kind: "after_rate_index", index: 3 });
}

function testFieldMappingsConfigured() {
  const cfg: LineParserConfig = {
    enabled: true,
    mode: "rate_and_columns",
    fieldMappings: {
      product_name: { kind: "token_range", start: 0, end: 2 },
      sales_qty: { kind: "token_index", index: 6 },
      sales_amount: { kind: "token_index", index: 7 },
    },
  };
  assert.equal(isLineParserConfigured(cfg), true);
  assert.equal(isLineFieldMapped(cfg.fieldMappings?.product_name), true);
}

function testIncompleteFieldMappings() {
  const cfg: LineParserConfig = {
    enabled: true,
    mode: "rate_and_columns",
    fieldMappings: {
      product_name: { kind: "before_rate" },
    },
  };
  assert.equal(isLineParserConfigured(cfg), false);
}

function testAyanStyleWithClosing() {
  const cfg: LineParserConfig = {
    enabled: true,
    mode: "rate_and_columns",
    salesQtyColumn: 2,
    salesAmountColumn: 3,
    fieldMappings: {
      product_name: { kind: "before_rate" },
      unit_price: { kind: "rate_pattern" },
      sales_qty: { kind: "after_rate_index", index: 2 },
      sales_amount: { kind: "after_rate_index", index: 3 },
      closing_stock: { kind: "after_rate_index", index: 6 },
    },
  };
  assert.equal(isLineParserConfigured(cfg), true);
  assert.equal(isLineFieldMapped(cfg.fieldMappings?.closing_stock), true);
}

testLegacyConfigured();
testFieldMappingsConfigured();
testIncompleteFieldMappings();
testAyanStyleWithClosing();
console.log("line-fallback-utils tests passed");
