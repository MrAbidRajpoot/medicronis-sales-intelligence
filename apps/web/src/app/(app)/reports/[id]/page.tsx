import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SsrExcelDownloadButton } from "@/components/reports/ssr-excel-download-button";
import { prisma } from "@/lib/prisma";
import { fetchSsrDataSheet } from "@/lib/db-helpers";
import { DATA_COLUMNS, formatSalesTillDate, formatSsrDataCell, type SsrDataLine } from "@/lib/ssr-data";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { toIsoDate } from "@/lib/date-utils";

export const dynamic = "force-dynamic";

const EMPHASIZED_COLUMNS = new Set<keyof SsrDataLine>(["productName", "salesValue"]);

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const report = await prisma.ssrReport.findUnique({
    where: { id: params.id },
  });

  if (!report || report.salesBatchId || !report.asOfDate) notFound();

  const { lines: dataLines, reportCode } = await fetchSsrDataSheet(report.asOfDate);
  const subtotal = dataLines.reduce((sum, l) => sum + l.salesValue, 0);
  const salesTillLabel = formatSalesTillDate(report.asOfDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={reportCode}
        description={`Updated Sales Till ${salesTillLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={report.status} type="ssr" />
            {report.status === "READY" && (
              <SsrExcelDownloadButton reportId={report.id} />
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
                Updated Sales Till {salesTillLabel}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                DATA sheet — Sales Till {salesTillLabel}
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
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="bg-[#DCE6F1]">
                {DATA_COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn("whitespace-nowrap font-semibold", column.kind !== "text" && "text-right")}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={DATA_COLUMNS.length} className="py-12 text-center text-muted-foreground">
                    No sales facts in this period.
                  </TableCell>
                </TableRow>
              ) : (
                dataLines.map((line, i) => (
                  <TableRow key={i}>
                    {DATA_COLUMNS.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "whitespace-nowrap",
                          column.kind !== "text" && "text-right",
                          EMPHASIZED_COLUMNS.has(column.key) && "font-medium"
                        )}
                      >
                        {formatSsrDataCell(line, column)}
                      </TableCell>
                    ))}
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
