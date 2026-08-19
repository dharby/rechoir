import { Sun, Moon, Monitor, Palette, Check } from "lucide-react";
import { useTheme, ThemeMode, ACCENT_LIST, AccentTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const OPTIONS: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "Auto" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, accent, setAccent } = useTheme();
  return (
    <div className="inline-flex items-center gap-1">
      <div role="radiogroup" aria-label="Theme mode" className="inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5">
        {OPTIONS.map((o) => {
          const active = mode === o.value;
          return (
            <button
              key={o.value}
              role="radio"
              aria-checked={active}
              onClick={() => setMode(o.value)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-smooth",
                active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted"
              )}
              title={o.label}
            >
              <o.icon className="h-3.5 w-3.5" />
              {!compact && <span>{o.label}</span>}
            </button>
          );
        })}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label="Accent palette"
            title="Accent palette"
            className="h-8 w-8 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-smooth"
            style={{ background: ACCENT_LIST.find((a) => a.id === accent)?.swatch }}
          >
            <Palette className="h-3.5 w-3.5 text-white drop-shadow" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 glass" align="end">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pb-1.5">Accent palette</div>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCENT_LIST.map((a) => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccent(a.id as AccentTheme)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-left transition-smooth",
                    active ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted"
                  )}
                >
                  <span className="h-7 w-7 rounded-full flex-shrink-0 shadow-elegant" style={{ background: a.swatch }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold truncate">{a.label}</span>
                    <span className="block text-[10px] text-muted-foreground truncate">{a.hint}</span>
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
