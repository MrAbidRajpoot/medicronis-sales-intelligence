"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileStack, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TemplateCoverageReport } from "@/lib/template-coverage";

export function TemplateCoverageKpis() {
  const [report, setReport] = useState<TemplateCoverageReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/template-coverage")
      .then((res) => res.json())
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) return null;

  const { kpis } = report;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Template Coverage</p>
            <p className="text-xs text-muted-foreground">
              {kpis.ok} of {kpis.total} distributors upload-ready
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="font-semibold">{kpis.ok}</span> OK
            </span>
            <span className="flex items-center gap-2">
              <FileStack className="h-4 w-4 text-amber-600" />
              <span className="font-semibold">{kpis.missing}</span> Missing
            </span>
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-semibold">{kpis.mismatch}</span> Mismatch
            </span>
          </div>
          <Link href="/dashboard#template-coverage" className="text-sm text-primary hover:underline">
            View full dashboard
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
