import { cn } from "@/lib/utils";
import { Flame, ArrowDown, Minus, ArrowUp } from "lucide-react";

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Low",
  2: "Normal",
  3: "High",
  4: "Critical",
};

const styles: Record<number, string> = {
  1: "bg-muted text-muted-foreground border-border",
  2: "bg-primary/10 text-primary border-primary/30",
  3: "bg-warning/15 text-warning border-warning/40",
  4: "bg-destructive/15 text-destructive border-destructive/50 animate-pulse",
};

const icons: Record<number, any> = { 1: ArrowDown, 2: Minus, 3: ArrowUp, 4: Flame };

export function PriorityBadge({ level, className }: { level?: number | null; className?: string }) {
  const l = Number(level ?? 2);
  if (l === 2) return null;
  const Icon = icons[l] ?? Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold",
        styles[l],
        className,
      )}
    >
      <Icon className="h-3 w-3" /> {PRIORITY_LABELS[l]}
    </span>
  );
}

export function PrioritySelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {[1, 2, 3, 4].map((l) => {
        const active = l === value;
        return (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-smooth",
              active ? styles[l] + " font-bold" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {PRIORITY_LABELS[l]}
          </button>
        );
      })}
    </div>
  );
}
