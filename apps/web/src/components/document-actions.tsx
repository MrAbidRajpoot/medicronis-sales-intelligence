"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Download, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/toast-provider";
import { useState } from "react";
import { DocumentStatus } from "@prisma/client";

interface DocumentActionsProps {
  documentId: string;
  status: DocumentStatus;
  hasUnresolved?: boolean;
}

export function DocumentActions({ documentId, status, hasUnresolved }: DocumentActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleApprove() {
    setLoading("approve");
    try {
      const res = await fetch(`/api/documents/${documentId}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Approval failed");
      toast.success(`Approved — ${data.factCount} daily sales fact(s) saved`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateSsr() {
    setLoading("ssr");
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "SSR generation failed");
      toast.success("SSR report generated");
      router.push(`/reports/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SSR generation failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "FAILED" && (
        <Button variant="outline" asChild>
          <Link href="/upload">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Upload
          </Link>
        </Button>
      )}

      {status === "EXTRACTED" && !hasUnresolved && (
        <Button variant="accent" onClick={handleApprove} disabled={!!loading}>
          {loading === "approve" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Approve & Promote to Sales
        </Button>
      )}

      {status === "REVIEW_REQUIRED" && (
        <Button variant="outline" asChild>
          <Link href="/review">Resolve in Review Queue</Link>
        </Button>
      )}

      {status === "APPROVED" && (
        <Button variant="accent" onClick={handleGenerateSsr} disabled={!!loading}>
          {loading === "ssr" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Generate SSR
        </Button>
      )}
    </div>
  );
}
