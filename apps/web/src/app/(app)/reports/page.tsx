"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus, Eye, BarChart3, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/toast-provider";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { todayIsoDate } from "@/lib/date-utils";
import { SsrReportStatus } from "@prisma/client";
import { useRouter } from "next/navigation";

interface ReportRow {
  id: string;
  reportCode: string;
  distributorName: string;
  viewType: string;
  asOfDate: string | null;
  periodStart: string;
  periodEnd: string;
  status: SsrReportStatus;
  lineCount: number;
  totalValue: number;
  generatedAt: string | null;
}

interface CoverageStats {
  distributorsWithData: number;
  activeDistributors: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [asOfDate, setAsOfDate] = useState(todayIsoDate());
  const [viewType, setViewType] = useState("day");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [coverage, setCoverage] = useState<CoverageStats | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setReports)
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (asOfDate > todayIsoDate()) {
      setCoverage(null);
      return;
    }

    setCoverageLoading(true);
    fetch(`/api/reports/coverage?viewType=${viewType}&asOfDate=${asOfDate}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCoverage(data);
      })
      .catch(() => setCoverage(null))
      .finally(() => setCoverageLoading(false));
  }, [viewType, asOfDate]);

  async function handleGenerate() {
    if (asOfDate > todayIsoDate()) {
      toast.error("Report date cannot be in the future");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewType, asOfDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      toast.success("SSR report generated");
      router.push(`/reports/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SSR Reports"
        description="Generate Secondary Sales Reports from approved daily sales facts"
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">As-of date</Label>
              <Input
                type="date"
                value={asOfDate}
                max={todayIsoDate()}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">View</Label>
              <Select value={viewType} onValueChange={setViewType}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {coverageLoading ? (
              <Badge variant="outline" className="mb-0.5 h-9 px-3">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Coverage…
              </Badge>
            ) : coverage ? (
              <Badge variant="outline" className="mb-0.5 h-9 px-3">
                {coverage.distributorsWithData} distributors with data / {coverage.activeDistributors} active
              </Badge>
            ) : null}
            <Button variant="accent" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Generate SSR
            </Button>
          </div>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No SSR reports yet"
          description="Approve documents to create daily sales facts, then generate day, week, or month SSR reports here."
          action={{ label: "View Documents", href: "/documents" }}
        />
      ) : (
        <DataTable
          data={reports}
          columns={[
            {
              key: "reportCode",
              header: "Report",
              cell: (row) => (
                <Link href={`/reports/${row.id}`} className="font-medium text-primary hover:underline">
                  {row.reportCode}
                </Link>
              ),
            },
            { key: "distributor", header: "Scope", cell: (row) => row.distributorName },
            {
              key: "view",
              header: "View / Date",
              cell: (row) => (
                <span className="whitespace-nowrap text-sm capitalize">
                  {row.viewType}
                  {row.viewType !== "day" && row.periodStart && row.periodEnd
                    ? ` · ${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`
                    : row.asOfDate
                      ? ` · ${formatDate(row.asOfDate)}`
                      : ""}
                </span>
              ),
            },
            { key: "lines", header: "Lines", cell: (row) => row.lineCount || "—", className: "text-right" },
            {
              key: "value",
              header: "Total Value",
              cell: (row) => (row.totalValue > 0 ? formatCurrency(row.totalValue) : "—"),
              className: "text-right",
            },
            { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} type="ssr" /> },
            {
              key: "generated",
              header: "Generated",
              cell: (row) =>
                row.generatedAt ? (
                  <span className="text-sm text-muted-foreground">{formatDateTime(row.generatedAt)}</span>
                ) : (
                  "—"
                ),
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/reports/${row.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                  {row.status === "READY" && (
                    <Button variant="ghost" size="sm" asChild title="Download Excel">
                      <a href={`/api/reports/${row.id}/download?format=xlsx`} title="Download Excel">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ),
              className: "w-24",
            },
          ]}
        />
      )}
    </div>
  );
}
