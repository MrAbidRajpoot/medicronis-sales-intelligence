"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ProcessingStepper, type ProcessingStep } from "@/components/processing-stepper";
import { UploadSuccessOverlay } from "@/components/upload-success";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatFileSize } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { toast } from "@/components/toast-provider";
import { todayIsoDate } from "@/lib/date-utils";

interface DistributorOption {
  id: string;
  code: string;
  name: string;
  region: string | null;
}

const IDLE_STEPS: ProcessingStep[] = [
  { id: "1", label: "Upload", description: "PDF received and stored", status: "pending" },
  { id: "2", label: "Extract", description: "Parsing line items from PDF", status: "pending" },
  { id: "3", label: "Match Products", description: "Mapping to master catalog", status: "pending" },
  { id: "4", label: "Review Exceptions", description: "Human review if needed", status: "pending" },
];

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [distributor, setDistributor] = useState<string>("");
  const [reportDate, setReportDate] = useState(todayIsoDate());
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<ProcessingStep[]>(IDLE_STEPS);
  const [showStepper, setShowStepper] = useState(false);

  useEffect(() => {
    fetch("/api/distributors")
      .then((r) => r.json())
      .then(setDistributors)
      .catch(() => setError("Could not load distributors"));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf") ||
        f.type === "application/zip" ||
        f.name.toLowerCase().endsWith(".zip")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (reportDate > todayIsoDate()) {
      toast.error("Report date cannot be in the future");
      return;
    }

    setUploading(true);
    setError(null);
    setShowStepper(true);
    setSteps([
      { id: "1", label: "Upload", status: "active", description: "Saving PDF..." },
      { id: "2", label: "Extract", status: "pending" },
      { id: "3", label: "Match Products", status: "pending" },
      { id: "4", label: "Review Exceptions", status: "pending" },
    ]);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    if (distributor) formData.append("distributorId", distributor);
    formData.append("reportDate", reportDate);

    try {
      setSteps((s) =>
        s.map((step, i) =>
          i === 0
            ? { ...step, status: "complete" }
            : i === 1
              ? { ...step, status: "active", description: "Calling PDF worker..." }
              : step
        )
      );

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setSteps([
        { id: "1", label: "Upload", status: "complete" },
        { id: "2", label: "Extract", status: "complete" },
        { id: "3", label: "Match Products", status: "complete" },
        {
          id: "4",
          label: "Review Exceptions",
          status: data.documents?.some((d: { status: string }) => d.status === "REVIEW_REQUIRED")
            ? "active"
            : "complete",
        },
      ]);

      toast.success(`Processed ${data.documents?.length ?? 0} document(s)`);
      if (data.warnings?.length) {
        data.warnings.forEach((w: string) => toast.error(w));
      }
      setSuccess(true);

      const first = data.documents?.[0];
      setTimeout(() => {
        if (first) {
          router.push(`/documents/${first.id}`);
          router.refresh();
        }
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setError(msg);
      toast.error(msg);
      setSteps((s) => s.map((step) => (step.status === "active" ? { ...step, status: "error" } : step)));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <UploadSuccessOverlay show={success} />

      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="Upload Documents"
          description="Upload distributor sales report PDFs for extraction and SSR generation"
        />

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex min-h-[160px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 sm:min-h-[200px] sm:px-6 sm:py-12 transition-colors touch-manipulation",
                    dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                >
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="mt-4 text-center text-sm font-medium">Drag & drop PDF or ZIP files here</p>
                  <p className="mt-1 text-center text-xs text-muted-foreground">
                    PDFs individually, or a ZIP containing multiple PDFs
                  </p>
                  <label className="mt-4 inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted touch-manipulation">
                    <input
                      type="file"
                      accept=".pdf,application/pdf,.zip,application/zip,application/x-zip-compressed"
                      multiple
                      className="hidden"
                      onChange={handleFileInput}
                    />
                    Browse Files
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {files.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2.5"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="shrink-0 p-1 text-muted-foreground hover:text-destructive touch-manipulation"
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Report Date</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Business date this PDF represents</Label>
                  <Input
                    type="date"
                    value={reportDate}
                    max={todayIsoDate()}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Distributor Override</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>Optional — auto-detected from PDF if blank</Label>
                  <Select value={distributor} onValueChange={setDistributor}>
                    <SelectTrigger className="min-h-[44px]">
                      <SelectValue placeholder="Auto-detect distributor" />
                    </SelectTrigger>
                    <SelectContent>
                      {distributors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Button
              variant="accent"
              size="lg"
              className="w-full min-h-[48px] sm:w-auto"
              disabled={files.length === 0 || uploading || success}
              onClick={handleUpload}
            >
              {uploading ? "Processing..." : `Upload ${files.length || ""} Document${files.length !== 1 ? "s" : ""}`}
            </Button>
          </div>

          <Card className="lg:sticky lg:top-24 lg:self-start">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Processing Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              {showStepper ? (
                <ProcessingStepper steps={steps} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a PDF to run extraction and product matching via the PDF worker service.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
