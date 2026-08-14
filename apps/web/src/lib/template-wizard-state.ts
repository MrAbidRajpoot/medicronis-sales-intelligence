import type {
  CanonicalField,
  HeaderStructure,
  PdfPlumberSettings,
  TemplateConfig,
} from "@/lib/pdf-template-types";
import {
  CANONICAL_FIELDS,
  REQUIRED_CANONICAL_FIELDS,
} from "@/lib/pdf-template-types";
import type { LeafColumn } from "@/lib/pdf-worker";

export type ColumnAssignment = CanonicalField | "ignore";

export const FIELD_LABELS: Record<CanonicalField, string> = {
  product_name: "Product Name",
  sales_qty: "Sales Units",
  sales_amount: "Sales Value",
  unit_price: "S.P",
  returns_qty: "Returns Qty",
  closing_stock: "Closing Stock",
};

export function forwardFillGroups(row0: string[]): string[] {
  const groups: string[] = [];
  let current = "";
  for (const cell of row0) {
    const norm = (cell ?? "").trim();
    if (norm) current = norm;
    groups.push(current);
  }
  return groups;
}

/** Build merged group header spans for row 0 display. */
export function buildGroupHeaderSpans(
  row0: string[],
  colCount: number
): { label: string; colspan: number; startCol: number }[] {
  const filled = forwardFillGroups(
    Array.from({ length: colCount }, (_, i) => row0[i] ?? "")
  );
  const spans: { label: string; colspan: number; startCol: number }[] = [];
  let i = 0;
  while (i < colCount) {
    const label = filled[i] ?? "";
    let span = 1;
    while (i + span < colCount && (filled[i + span] ?? "") === label) {
      span++;
    }
    spans.push({ label, colspan: span, startCol: i });
    i += span;
  }
  return spans;
}

const GROUPED_HEADER_STRUCTURES: readonly HeaderStructure[] = [
  "grouped_two_row",
  "title_block_then_table",
];

/** True when the detected grid has a spanning group row above the leaf row. */
export function isGroupedHeaderGrid(
  headerStructure: HeaderStructure,
  headerGrid: string[][]
): boolean {
  return GROUPED_HEADER_STRUCTURES.includes(headerStructure) && headerGrid.length >= 2;
}

export function leafLabelForColumn(
  headerGrid: string[][],
  col: number,
  headerStructure: HeaderStructure
): string {
  if (isGroupedHeaderGrid(headerStructure, headerGrid)) {
    return (headerGrid[1][col] ?? "").trim();
  }
  return (headerGrid[0]?.[col] ?? "").trim();
}

export function groupLabelForColumn(headerGrid: string[][], col: number): string {
  const row0 = headerGrid[0] ?? [];
  return forwardFillGroups(Array.from({ length: col + 1 }, (_, i) => row0[i] ?? ""))[col] ?? "";
}

export function assignmentsFromSuggestedMappings(
  colCount: number,
  suggested: Partial<Record<CanonicalField, { col?: number }>>
): ColumnAssignment[] {
  const assignments: ColumnAssignment[] = Array(colCount).fill("ignore");
  for (const field of CANONICAL_FIELDS) {
    const mapping = suggested[field];
    if (mapping?.col !== undefined && mapping.col >= 0 && mapping.col < colCount) {
      assignments[mapping.col] = field;
    }
  }
  return assignments;
}

export function assignmentsFromConfig(
  config: TemplateConfig,
  colCount: number
): ColumnAssignment[] {
  const assignments: ColumnAssignment[] = Array(colCount).fill("ignore");
  for (const field of CANONICAL_FIELDS) {
    const mapping = config.fields?.[field];
    if (mapping?.col !== undefined && mapping.col >= 0 && mapping.col < colCount) {
      assignments[mapping.col] = field;
    }
  }
  return assignments;
}

export function buildTemplateConfigFromAssignments(options: {
  headerStructure: HeaderStructure;
  headerGrid: string[][];
  columnAssignments: ColumnAssignment[];
  preset?: TemplateConfig | null;
  skipRowsBeforeHeader?: number;
  skipRowsContaining?: string[];
  pdfPlumberSettings?: PdfPlumberSettings;
  tableExtractionDisabled?: boolean;
  lineParser?: TemplateConfig["lineParser"];
}): TemplateConfig {
  const {
    headerStructure,
    headerGrid,
    columnAssignments,
    preset,
    skipRowsBeforeHeader,
    skipRowsContaining,
    pdfPlumberSettings,
    tableExtractionDisabled,
    lineParser,
  } = options;

  const fields: TemplateConfig["fields"] = {};

  columnAssignments.forEach((assignment, col) => {
    if (assignment === "ignore") return;
    fields[assignment] = {
      col,
      group: groupLabelForColumn(headerGrid, col) || undefined,
      leaf: leafLabelForColumn(headerGrid, col, headerStructure) || undefined,
    };
  });

  return {
    headerStructure,
    fields,
    ...(preset?.detection ? { detection: preset.detection } : {}),
    ...(skipRowsBeforeHeader !== undefined ? { skipRowsBeforeHeader } : preset?.skipRowsBeforeHeader !== undefined ? { skipRowsBeforeHeader: preset.skipRowsBeforeHeader } : {}),
    ...(skipRowsContaining?.length ? { skipRowsContaining } : preset?.skipRowsContaining ? { skipRowsContaining: preset.skipRowsContaining } : {}),
    ...(pdfPlumberSettings ? { pdfPlumberSettings } : preset?.pdfPlumberSettings ? { pdfPlumberSettings: preset.pdfPlumberSettings } : {}),
    ...(tableExtractionDisabled !== undefined
      ? { tableExtractionDisabled }
      : preset?.tableExtractionDisabled !== undefined
        ? { tableExtractionDisabled: preset.tableExtractionDisabled }
        : {}),
    ...(lineParser ?? preset?.lineParser ? { lineParser: lineParser ?? preset?.lineParser } : {}),
  };
}

export function isFieldRequired(field: CanonicalField): boolean {
  return (REQUIRED_CANONICAL_FIELDS as readonly string[]).includes(field);
}

export function assignedFields(assignments: ColumnAssignment[]): Set<CanonicalField> {
  return new Set(
    assignments.filter((a): a is CanonicalField => a !== "ignore")
  );
}

export function duplicateFieldColumns(assignments: ColumnAssignment[]): CanonicalField[] {
  const seen = new Map<CanonicalField, number>();
  const dupes: CanonicalField[] = [];
  assignments.forEach((a) => {
    if (a === "ignore") return;
    const count = (seen.get(a) ?? 0) + 1;
    seen.set(a, count);
    if (count === 2) dupes.push(a);
  });
  return dupes;
}
