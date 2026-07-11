import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepSidebarProps {
  steps: readonly string[];
  currentStep: number;
  maxReachableStep: number;
  onStepSelect: (step: number) => void;
}

export function StepSidebar({
  steps,
  currentStep,
  maxReachableStep,
  onStepSelect,
}: StepSidebarProps) {
  return (
    <nav aria-label="Setup steps" className="flex flex-row gap-1 overflow-x-auto sm:flex-col">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        const isReachable = index <= maxReachableStep;

        return (
          <button
            key={step}
            type="button"
            disabled={!isReachable}
            onClick={() => onStepSelect(index)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors sm:gap-3 sm:px-3",
              isActive && "bg-muted font-medium text-foreground",
              !isActive && isComplete && isReachable &&
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              !isActive && !isComplete && isReachable &&
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              !isReachable && "cursor-not-allowed text-muted-foreground/50",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                isActive && "bg-primary text-primary-foreground",
                isComplete && "bg-muted text-muted-foreground",
                !isActive && !isComplete && isReachable && "border border-border text-muted-foreground",
                !isReachable && "border border-border/60 text-muted-foreground/50",
              )}
            >
              {isComplete ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className="whitespace-nowrap">{step}</span>
          </button>
        );
      })}
    </nav>
  );
}
