"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  ReportsFilterBar,
  type ReportsFilterOption,
  type ReportsFilterProductOption,
} from "@/components/reports/reports-filter-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/toast-provider";
import {
  appendFilterQueryParams,
  formatProductWiseCell,
  type ProductWiseResponse,
} from "@/lib/monthly-reports/product-wise-client";
import {
  formatSnapshotCoverageSubtitle,
  productWiseSnapshotBanner,
  type MonthlyReportFilters,
  type ProductWiseRow,
} from "@/lib/monthly-reports/types";
import { cn } from "@/lib/utils";

const emptyFilters: MonthlyReportFilters = {
  regionIds: [],
  areaIds: [],
  territoryIds: [],
  zoneIds: [],
  managerIds: [],
  productGroupIds: [],
  productIds: [],
  distributorIds: [],
};

type HeaderTone = "identity" | "target" | "sales" | "achv" | "lmtd" | "stock";

const HEADER_TONES: HeaderTone[] = [
  "identity",
  "target",
  "sales",
  "lmtd",
  "target",
  "sales",
  "achv",
  "lmtd",
  "lmtd",
  "stock",
  "stock",
];

const TONE_CLASS: Record<HeaderTone, string> = {
  identity: "bg-[#DCE6F1]",
  target: "bg-orange-100",
  sales: "bg-sky-100",
  achv: "bg-emerald-100",
  lmtd: "bg-amber-100",
  stock: "bg-white",
};

function monthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthInput(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function cleanFilters(f: MonthlyReportFilters): MonthlyReportFilters {
  const out: MonthlyReportFilters = {};
  if (f.regionIds?.length) out.regionIds = f.regionIds;
  if (f.areaIds?.length) out.areaIds = f.areaIds;
  if (f.territoryIds?.length) out.territoryIds = f.territoryIds;
  if (f.zoneIds?.length) out.zoneIds = f.zoneIds;
  if (f.managerIds?.length) out.managerIds = f.managerIds;
  if (f.productGroupIds?.length) out.productGroupIds = f.productGroupIds;
  if (f.productIds?.length) out.productIds = f.productIds;
  if (f.distributorIds?.length) out.distributorIds = f.distributorIds;
  return out;
}

function buildQuery(year: number, month: number, filters: MonthlyReportFilters): string {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  appendFilterQueryParams(params, cleanFilters(filters));
  return params.toString();
}

function cellKinds(): Array<"text" | "units" | "money" | "percent"> {
  return [
    "text",
    "units",
    "units",
    "units",
    "money",
    "money",
    "percent",
    "money",
    "percent",
    "units",
    "money",
  ];
}

function rowCells(row: ProductWiseRow): Array<string | number | "-"> {
  return [
    row.productName,
    row.targetUnits,
    row.salesUnits,
    row.lmtdSalesUnits,
    row.targetValue,
    row.salesValue,
    row.targetAchvPercent,
    row.lmtdSalesValue,
    row.lmtdPercent,
    row.stockUnits,
    row.stockValue,
  ];
}

export default function ProductWiseReportPage() {
  const [monthValue, setMonthValue] = useState("");
  const [draftFilters, setDraftFilters] = useState<MonthlyReportFilters>({ ...emptyFilters });
  const [appliedFilters, setAppliedFilters] = useState<MonthlyReportFilters>({});
  const [appliedMonth, setAppliedMonth] = useState<{ year: number; month: number } | null>(null);

  const [regions, setRegions] = useState<ReportsFilterOption[]>([]);
  const [areas, setAreas] = useState<ReportsFilterOption[]>([]);
  const [territories, setTerritories] = useState<ReportsFilterOption[]>([]);
  const [zones, setZones] = useState<ReportsFilterOption[]>([]);
  const [managers, setManagers] = useState<ReportsFilterOption[]>([]);
  const [productGroups, setProductGroups] = useState<ReportsFilterOption[]>([]);
  const [products, setProducts] = useState<ReportsFilterProductOption[]>([]);
  const [distributors, setDistributors] = useState<ReportsFilterOption[]>([]);

  const [report, setReport] = useState<ProductWiseResponse | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      const [r, a, t, z, m, pg, p, d] = await Promise.all([
        fetch("/api/regions"),
        fetch("/api/areas"),
        fetch("/api/territories"),
        fetch("/api/zones"),
        fetch("/api/managers"),
        fetch("/api/product-groups"),
        fetch("/api/products"),
        fetch("/api/distributors"),
      ]);
      setRegions(await r.json());
      setAreas(await a.json());
      setTerritories(await t.json());
      setZones(await z.json());
      setManagers((await m.json()).map((x: ReportsFilterOption) => ({ id: x.id, name: x.name })));
      setProductGroups(await pg.json());
      setProducts(await p.json());
      setDistributors(
        (await d.json()).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name }))
      );
    } catch {
      toast.error("Failed to load filter options");
    }
  }, []);

  const fetchReport = useCallback(async (year: number, month: number, filters: MonthlyReportFilters) => {
    setLoadingReport(true);
    try {
      const qs = buildQuery(year, month, filters);
      const res = await fetch(`/api/reports/product-wise?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load report");
      setReport(data);
      setAppliedMonth({ year, month });
      setAppliedFilters(cleanFilters(filters));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report");
      setReport(null);
    } finally {
      setLoadingReport(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        await loadOptions();
        const metaRes = await fetch("/api/reports/product-wise?meta=1");
        const meta = await metaRes.json();
        if (cancelled) return;
        const year = meta.defaultMonth?.year ?? new Date().getFullYear();
        const month = meta.defaultMonth?.month ?? new Date().getMonth() + 1;
        setMonthValue(monthInputValue(year, month));
        await fetchReport(year, month, {});
      } catch {
        if (!cancelled) toast.error("Failed to initialize report");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOptions, fetchReport]);

  function handleApply() {
    const parsed = parseMonthInput(monthValue);
    if (!parsed) {
      toast.error("Select a valid month");
      return;
    }
    void fetchReport(parsed.year, parsed.month, draftFilters);
  }

  function handleClear() {
    setDraftFilters({ ...emptyFilters });
    const parsed = parseMonthInput(monthValue);
    if (!parsed) return;
    void fetchReport(parsed.year, parsed.month, {});
  }

  async function handleDownload() {
    if (!appliedMonth) return;
    setDownloading(true);
    try {
      const qs = buildQuery(appliedMonth.year, appliedMonth.month, appliedFilters);
      const res = await fetch(`/api/reports/product-wise/download?format=xlsx&${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Product-Wise-${appliedMonth.year}-${String(appliedMonth.month).padStart(2, "0")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const kinds = cellKinds();
  const summaryLabel = report
    ? `${report.rows.length} products · Month ${report.period.monthName.slice(0, 3)} ${report.period.year}`
    : null;

  if (loadingMeta) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Wise"
        description="Monthly management report — product totals from each distributor's latest MTD snapshot"
        actions={
          <Button
            variant="accent"
            size="sm"
            disabled={!report || downloading || loadingReport}
            onClick={() => void handleDownload()}
          >
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download Excel
          </Button>
        }
      />

      <ReportsFilterBar
        monthValue={monthValue}
        onMonthChange={setMonthValue}
        draftFilters={draftFilters}
        onDraftFiltersChange={setDraftFilters}
        regions={regions}
        areas={areas}
        territories={territories}
        zones={zones}
        managers={managers}
        productGroups={productGroups}
        products={products}
        distributors={distributors}
        loading={loadingReport}
        summaryLabel={summaryLabel}
        onApply={handleApply}
        onClear={handleClear}
      />

      <Card>
        <CardHeader className="border-b bg-primary/5">
          <CardTitle className="text-lg text-primary">
            {report
              ? `Productwise Report — ${report.period.monthName} ${report.period.year}`
              : "Product Wise"}
          </CardTitle>
          {report && (
            <p className="mt-1 text-sm text-muted-foreground">
              {productWiseSnapshotBanner(report.period.monthName)}
              {report.coverage
                ? ` ${formatSnapshotCoverageSubtitle(report.coverage, report.priorPeriod.monthName)}.`
                : ""}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loadingReport ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !report || report.rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Search}
                title="No data for this month"
                description="No sales facts match the selected month and filters. Try another month or clear filters."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    {report.columns.map((col, i) => (
                      <TableHead
                        key={col}
                        className={cn(
                          "whitespace-nowrap font-semibold",
                          TONE_CLASS[HEADER_TONES[i]!],
                          kinds[i] !== "text" && "text-right"
                        )}
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, rowIdx) => (
                    <TableRow key={`${row.productName}-${rowIdx}`}>
                      {rowCells(row).map((val, i) => (
                        <TableCell
                          key={i}
                          className={cn(
                            "whitespace-nowrap",
                            kinds[i] !== "text" && "text-right",
                            i === 0 && "font-medium"
                          )}
                        >
                          {kinds[i] === "text"
                            ? String(val)
                            : formatProductWiseCell(
                                val as number | "-",
                                kinds[i] as "units" | "money" | "percent"
                              )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {report.totals && (
                    <TableRow className="bg-[#DCE6F1] font-semibold">
                      {rowCells(report.totals).map((val, i) => (
                        <TableCell
                          key={i}
                          className={cn("whitespace-nowrap", kinds[i] !== "text" && "text-right")}
                        >
                          {kinds[i] === "text"
                            ? String(val)
                            : formatProductWiseCell(
                                val as number | "-",
                                kinds[i] as "units" | "money" | "percent"
                              )}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
