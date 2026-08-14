"use client";

import { cn } from "@/lib/utils";
import type { HeaderStructure } from "@/lib/pdf-template-types";
import {
  buildGroupHeaderSpans,
  FIELD_LABELS,
  forwardFillGroups,
  isFieldRequired,
  isGroupedHeaderGrid,
  type ColumnAssignment,
} from "@/lib/template-wizard-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CANONICAL_FIELDS } from "@/lib/pdf-template-types";
import { getUnresolvedRequiredFields } from "@/lib/template-validation";
import type { TemplateConfig } from "@/lib/pdf-template-types";

interface HeaderMappingGridProps {
  headerGrid: string[][];
  headerStructure: HeaderStructure;
  columnAssignments: ColumnAssignment[];
  onAssignmentChange: (col: number, value: ColumnAssignment) => void;
  config: TemplateConfig;
  disabled?: boolean;
}

const SELECT_OPTIONS: { value: ColumnAssignment; label: string }[] = [
  { value: "ignore", label: "Ignore" },
  ...CANONICAL_FIELDS.map((f) => ({ value: f as ColumnAssignment, label: FIELD_LABELS[f] })),
];

export function HeaderMappingGrid({
  headerGrid,
  headerStructure,
  columnAssignments,
  onAssignmentChange,
  config,
  disabled,
}: HeaderMappingGridProps) {
  const colCount = Math.max(
    headerGrid[0]?.length ?? 0,
    headerGrid[1]?.length ?? 0,
    columnAssignments.length
  );

  if (colCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Upload a sample PDF to detect column headers.
      </p>
    );
  }

  const unresolved = new Set(getUnresolvedRequiredFields(config));
  const row0 = headerGrid[0] ?? [];
  const row1 = headerGrid[1] ?? [];
  const filledGroups = forwardFillGroups(
    Array.from({ length: colCount }, (_, i) => row0[i] ?? "")
  );
  const groupSpans = buildGroupHeaderSpans(row0, colCount);
  const isGrouped = isGroupedHeaderGrid(headerStructure, headerGrid);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        {CANONICAL_FIELDS.filter(isFieldRequired).map((field) => (
          <span
            key={field}
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              unresolved.has(field)
                ? "bg-red-100 text-red-800"
                : "bg-emerald-100 text-emerald-800"
            )}
          >
            {FIELD_LABELS[field]}
            {unresolved.has(field) ? " *" : " ✓"}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {isGrouped && (
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                {groupSpans.map((span) => (
                  <TableHead
                    key={`group-${span.startCol}`}
                    colSpan={span.colspan}
                    className="whitespace-nowrap text-center text-xs font-semibold uppercase tracking-wide text-primary"
                  >
                    {span.label || filledGroups[span.startCol] || "—"}
                  </TableHead>
                ))}
              </TableRow>
            )}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {Array.from({ length: colCount }, (_, col) => (
                <TableHead key={`leaf-label-${col}`} className="min-w-[100px] text-center text-xs">
                  {isGrouped ? (row1[col] ?? "").trim() || "—" : (row0[col] ?? "").trim() || "—"}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {Array.from({ length: colCount }, (_, col) => {
                const assignment = columnAssignments[col] ?? "ignore";
                const requiredUnmapped =
                  assignment !== "ignore" &&
                  isFieldRequired(assignment) &&
                  unresolved.has(assignment);
                return (
                  <TableHead key={`map-${col}`} className="min-w-[140px] p-2">
                    <Select
                      value={assignment}
                      onValueChange={(v) => onAssignmentChange(col, v as ColumnAssignment)}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-9 text-xs",
                          requiredUnmapped && "border-destructive ring-1 ring-destructive/30",
                          assignment !== "ignore" &&
                            isFieldRequired(assignment) &&
                            !unresolved.has(assignment) &&
                            "border-emerald-400"
                        )}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="text-xs text-muted-foreground">
              {Array.from({ length: colCount }, (_, col) => (
                <TableCell key={`col-${col}`} className="text-center">
                  Col {col}
                  {isGrouped && filledGroups[col] && (
                    <div className="truncate text-[10px]">{filledGroups[col]}</div>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
