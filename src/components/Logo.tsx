import { Cloud } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-elegant">
        <Cloud className="h-4 w-4" strokeWidth={2.5} />
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        E-Cloud
      </span>
    </div>
  );
}
