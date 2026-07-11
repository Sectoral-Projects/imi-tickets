import { ShieldX } from "lucide-react";

type UnauthorizedScreenProps = {
  title?: string;
  description?: string;
};

export function UnauthorizedScreen({
  title = "Not authorized",
  description = "You do not have permission to view this page.",
}: UnauthorizedScreenProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldX className="size-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
