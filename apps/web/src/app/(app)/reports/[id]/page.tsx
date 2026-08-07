import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { buildDataSheetRows, buildDateRange, formatPeriod, formatSalesTillDate, getSsrExportFactBounds, reportCodeFor, viewTypeLabel, type SsrViewTypeLabel } from "@/lib/ssr-data";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toIsoDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId || !report.asOfDate) notFound();

  const viewType = (report.viewType?.toLowerCase() ?? "day") as SsrViewTypeLabel;
  const range = buildDateRange(viewType, report.asOfDate);
  const factBounds = getSsrExportFactBounds(viewType, report.asOfDate);

  const facts = await prisma.dailySalesFact.findMany({
    where: {
      saleDate: {
        gte: factBounds.min,
        lte: factBounds.max,
      },
    },
    include: {
      distributor: { include: { manager: true } },
      product: true,
    },
    orderBy: [{ distributor: { name: "asc" } }, { product: { name: "asc" } }],
  });

  const dataLines = buildDataSheetRows(facts, range, {
    asOfDate: report.asOfDate,
    viewType,
  });
  const reportCode = reportCodeFor(report.asOfDate, viewType);
  const subtotal = dataLines.reduce((sum, l) => sum + l.salesValue, 0);
  const periodLabel = viewType === "day"
    ? formatSalesTillDate(report.asOfDate)
    : formatPeriod(range.start, range.end);

  return (
    <div className="space-y-6">
      <PageHeader
        title={reportCode}
        description={`Updated Sales Till ${formatSalesTillDate(report.asOfDate)} — ${viewTypeLabel(viewType)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={report.status} type="ssr" />
            {report.status === "READY" && (
              <Button variant="accent" size="sm" asChild>
                <a href={`/api/reports/${report.id}/download?format=xlsx`}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Excel
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="border-b bg-primary/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg text-primary">
                Updated Sales Till {formatSalesTillDate(report.asOfDate)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                DATA sheet — {viewTypeLabel(viewType)}
                {viewType !== "day" ? ` (${periodLabel})` : ""}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">As of {formatDate(toIsoDate(report.asOfDate))}</p>
              {report.generatedAt && (
                <p className="text-xs text-muted-foreground">Generated: {formatDateTime(report.generatedAt)}</p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#DCE6F1]">
                <TableHead className="font-semibold">Distributor</TableHead>
                <TableHead className="font-semibold">City</TableHead>
                <TableHead className="font-semibold">Group</TableHead>
                <TableHead className="font-semibold">Product</TableHead>
                <TableHead className="text-right font-semibold">S.P</TableHead>
                <TableHead className="text-right font-semibold">Units</TableHead>
                <TableHead className="text-right font-semibold">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    No sales facts in this period.
                  </TableCell>
                </TableRow>
              ) : (
                dataLines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell>{line.distributorName}</TableCell>
                    <TableCell>{line.city || "—"}</TableCell>
                    <TableCell>{line.group || "—"}</TableCell>
                    <TableCell className="font-medium">{line.productName}</TableCell>
                    <TableCell className="text-right">{line.sellingPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{line.salesUnits.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(line.salesValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex justify-end border-t bg-[#DCE6F1] px-6 py-4">
            <dl className="space-y-1 text-right">
              <div className="flex justify-between gap-12">
                <dt className="text-sm font-semibold text-emerald-800">Total Sales Value</dt>
                <dd className="text-lg font-bold text-emerald-800">{formatCurrency(subtotal)}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
