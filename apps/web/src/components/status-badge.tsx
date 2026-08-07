import { Badge } from "@/components/ui/badge";
import { DocumentStatus, ExtractedRowStatus, SsrReportStatus } from "@prisma/client";

const documentStatusConfig: Record<
  DocumentStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "info" }
> = {
  UPLOADED: { label: "Uploaded", variant: "secondary" },
  PROCESSING: { label: "Processing", variant: "info" },
  EXTRACTED: { label: "Extracted", variant: "default" },
  REVIEW_REQUIRED: { label: "Review Required", variant: "warning" },
  TEMPLATE_MISMATCH: { label: "Template Mismatch", variant: "danger" },
  APPROVED: { label: "Approved", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
};

const rowStatusConfig: Record<
  ExtractedRowStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "info" }
> = {
  PENDING: { label: "Pending", variant: "secondary" },
  MATCHED: { label: "Matched", variant: "success" },
  UNMATCHED: { label: "Unmatched", variant: "warning" },
  REVIEWED: { label: "Reviewed", variant: "info" },
  REJECTED: { label: "Rejected", variant: "danger" },
};

const ssrStatusConfig: Record<
  SsrReportStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "danger" | "info" }
> = {
  GENERATING: { label: "Generating", variant: "info" },
  READY: { label: "Ready", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
};

type StatusType = "document" | "row" | "ssr";

interface StatusBadgeProps {
  status: DocumentStatus | ExtractedRowStatus | SsrReportStatus;
  type?: StatusType;
}

export function StatusBadge({ status, type = "document" }: StatusBadgeProps) {
  const config =
    type === "row"
      ? rowStatusConfig[status as ExtractedRowStatus]
      : type === "ssr"
        ? ssrStatusConfig[status as SsrReportStatus]
        : documentStatusConfig[status as DocumentStatus];

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
