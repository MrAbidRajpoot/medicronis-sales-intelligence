import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileStack, RefreshCw } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getTemplateCoverageReport,
  templateCoverageStatusLabel,
  type TemplateCoverageStatus,
} from "@/lib/template-coverage";
import { prisma } from "@/lib/prisma";

function statusBadgeVariant(status: TemplateCoverageStatus) {
  if (status === "ok") return "success" as const;
  if (status === "mismatch") return "danger" as const;
  return "warning" as const;
}

export async function TemplateCoverageSection() {
  const { kpis, rows } = await getTemplateCoverageReport(prisma);

  return (
    <section id="template-coverage" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Template Coverage</h2>
        <p className="text-sm text-muted-foreground">
          Upload readiness across {kpis.total} active distributors (last 30 days for mismatch detection)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          title="Template OK"
          value={String(kpis.ok)}
          subtitle="configured & no recent mismatch"
          icon={CheckCircle2}
        />
        <KpiCard
          title="Template Missing"
          value={String(kpis.missing)}
          subtitle="wizard not completed"
          icon={FileStack}
        />
        <KpiCard
          title="Template Mismatch"
          value={String(kpis.mismatch)}
          subtitle="layout drift in last 30d"
          icon={AlertTriangle}
        />
      </div>

      <DataTable
        title="Distributor Template Status"
        description="Daily uploads re-resolve column indices silently; mismatches require manual re-map"
        data={rows}
        emptyMessage="No active distributors"
        columns={[
          {
            key: "distributor",
            header: "Distributor",
            cell: (row) => (
              <div>
                <Link
                  href={`/distributors/${row.distributorId}/template`}
                  className="font-medium text-primary hover:underline"
                >
                  {row.distributorName}
                </Link>
                <p className="font-mono text-xs text-muted-foreground">{row.distributorCode}</p>
              </div>
            ),
          },
          {
            key: "formatFamily",
            header: "Format Family",
            cell: (row) => (
              <span className="text-sm">
                {row.formatFamily}
                <span className="ml-1 text-muted-foreground">({row.formatName})</span>
              </span>
            ),
          },
          {
            key: "lastUploadRowCount",
            header: "Last Upload Rows",
            cell: (row) =>
              row.lastUploadRowCount != null ? (
                <span className="tabular-nums">{row.lastUploadRowCount}</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
            className: "text-right",
          },
          {
            key: "expectedRowCount",
            header: "Expected Rows",
            cell: (row) =>
              row.expectedRowCount != null ? (
                <span className="tabular-nums">{row.expectedRowCount}</span>
              ) : (
                <span className="text-muted-foreground" title="Set after first approved upload">
                  —
                </span>
              ),
            className: "text-right",
          },
          {
            key: "status",
            header: "Status",
            cell: (row) => (
              <Badge variant={statusBadgeVariant(row.status)}>
                {templateCoverageStatusLabel(row.status)}
              </Badge>
            ),
          },
          {
            key: "actions",
            header: "",
            cell: (row) => {
              if (row.status === "mismatch" && row.mismatchDocumentId) {
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/distributors/${row.distributorId}/template?returnTo=/documents/${row.mismatchDocumentId}`}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Re-map
                    </Link>
                  </Button>
                );
              }
              if (row.status === "missing") {
                return (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/distributors/${row.distributorId}/template?setup=1`}>
                      Configure
                    </Link>
                  </Button>
                );
              }
              return null;
            },
            className: "text-right w-28",
          },
        ]}
      />
    </section>
  );
}
