/**
 * Runnable mismatch detection checks for Phase 9.
 * Run: npx tsx apps/web/src/lib/__tests__/template-mismatch.test.ts
 */
import assert from "node:assert/strict";
import {
  ROW_COUNT_MISMATCH_THRESHOLD,
  detectTemplateMismatch,
  isRowCountMismatch,
} from "../template-mismatch";

function testRowCountMismatch() {
  assert.equal(isRowCountMismatch(100, 100), false, "same count is OK");
  assert.equal(isRowCountMismatch(70, 100), false, "exactly 70% is OK");
  assert.equal(isRowCountMismatch(69, 100), true, ">30% drop triggers mismatch");
  assert.equal(isRowCountMismatch(50, null), false, "no baseline skips check");
  assert.equal(isRowCountMismatch(50, 0), false, "zero baseline skips check");
}

function testResolutionFailure() {
  assert.equal(
    detectTemplateMismatch({
      rowCount: 50,
      lastSuccessfulRowCount: 100,
      templateResolutionOk: false,
    }),
    true,
    "label-path resolver failure triggers mismatch"
  );

  assert.equal(
    detectTemplateMismatch({
      rowCount: 50,
      lastSuccessfulRowCount: 100,
      needsTemplateRemap: true,
    }),
    true,
    "needs_template_remap triggers mismatch"
  );
}

function testCombinedDetection() {
  assert.equal(
    detectTemplateMismatch({
      rowCount: 75,
      lastSuccessfulRowCount: 100,
      templateResolutionOk: true,
      needsTemplateRemap: false,
    }),
    false,
    "75% of baseline passes"
  );

  assert.equal(ROW_COUNT_MISMATCH_THRESHOLD, 0.7);
}

testRowCountMismatch();
testResolutionFailure();
testCombinedDetection();

console.log("template-mismatch tests passed");
