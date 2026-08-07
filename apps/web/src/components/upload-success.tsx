"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadSuccessOverlay({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-10 py-8 shadow-lg">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <CheckCircle2 className="h-16 w-16 text-accent animate-[scale-in_0.3s_ease-out]" />
        </div>
        <p className="text-lg font-semibold text-foreground">Upload complete</p>
        <p className="text-sm text-muted-foreground">Redirecting to document...</p>
      </div>
    </div>
  );
}
