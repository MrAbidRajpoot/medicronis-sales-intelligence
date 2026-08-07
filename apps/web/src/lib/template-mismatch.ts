/** Row-count drop below this fraction of lastSuccessfulRowCount triggers TEMPLATE_MISMATCH. */
export const ROW_COUNT_MISMATCH_THRESHOLD = 0.7;

export const TEMPLATE_MISMATCH_MESSAGE = "Layout changed — re-map template";

export function isRowCountMismatch(
  rowCount: number,
  lastSuccessfulRowCount: number | null | undefined
): boolean {
  if (lastSuccessfulRowCount == null || lastSuccessfulRowCount <= 0) return false;
  return rowCount < lastSuccessfulRowCount * ROW_COUNT_MISMATCH_THRESHOLD;
}

export type TemplateMismatchInput = {
  rowCount: number;
  lastSuccessfulRowCount: number | null | undefined;
  needsTemplateRemap?: boolean;
  templateResolutionOk?: boolean;
};

/** Runtime mismatch detection used during daily upload (silent re-resolve; UI only on mismatch). */
export function detectTemplateMismatch(input: TemplateMismatchInput): boolean {
  const resolutionFailed =
    input.needsTemplateRemap === true || input.templateResolutionOk === false;
  return resolutionFailed || isRowCountMismatch(input.rowCount, input.lastSuccessfulRowCount);
}
