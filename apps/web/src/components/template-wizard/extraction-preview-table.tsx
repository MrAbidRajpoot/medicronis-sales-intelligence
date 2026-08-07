"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtractedRowPayload } from "@/lib/pdf-worker";

interface ExtractionPreviewTableProps {
  rows: ExtractedRowPayload[];
  loading?: boolean;
}

function fmtNum(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ExtractionPreviewTable({ rows, loading }: ExtractionPreviewTableProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Refreshing preview…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Map required columns to see extracted data preview.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Returns Qty</TableHead>
            <TableHead className="text-right">Net Sale Qty</TableHead>
            <TableHead className="text-right">Net Sale Amount</TableHead>
            <TableHead className="text-right">Closing Qty</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="max-w-[240px] truncate font-mono text-xs">
                {row.raw_product_text || "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(row.returns_qty)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(row.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(row.gross_value)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtNum(row.closing_stock)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
