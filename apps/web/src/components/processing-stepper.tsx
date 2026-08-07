import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessingStep {
  id: string;
  label: string;
  description?: string;
  status: "pending" | "active" | "complete" | "error";
}

interface ProcessingStepperProps {
  steps: ProcessingStep[];
  className?: string;
}

export function ProcessingStepper({ steps, className }: ProcessingStepperProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <div key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2",
                  step.status === "complete" && "border-accent bg-accent text-white",
                  step.status === "active" && "border-primary bg-primary/10 text-primary",
                  step.status === "pending" && "border-muted-foreground/30 text-muted-foreground",
                  step.status === "error" && "border-destructive bg-destructive/10 text-destructive"
                )}
              >
                {step.status === "complete" && <Check className="h-4 w-4" />}
                {step.status === "active" && <Loader2 className="h-4 w-4 animate-spin" />}
                {step.status === "pending" && <Circle className="h-3 w-3 fill-current" />}
                {step.status === "error" && <span className="text-xs font-bold">!</span>}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[2rem]",
                    step.status === "complete" ? "bg-accent" : "bg-muted"
                  )}
                />
              )}
            </div>
            <div className={cn("pb-8", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  step.status === "pending" && "text-muted-foreground"
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
