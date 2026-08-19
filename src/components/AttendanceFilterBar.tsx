import { Button } from "@/components/ui/button";

export type RosterStatus = "present" | "late" | "absent" | "excused";

const LABELS: Record<RosterStatus | "all", string> = {
  all: "All",
  present: "Present",
  late: "Late",
  absent: "Absent",
  excused: "Excused",
};

export function AttendanceTotals({
  total, present, late, absent, excused,
}: { total: number; present: number; late: number; absent: number; excused: number }) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const items: Array<{ k: string; v: number; p: number; cls: string }> = [
    { k: "Present", v: present, p: pct(present), cls: "text-accent" },
    { k: "Late",    v: late,    p: pct(late),    cls: "text-warning" },
    { k: "Absent",  v: absent,  p: pct(absent),  cls: "text-destructive" },
    { k: "Excused", v: excused, p: pct(excused), cls: "text-muted-foreground" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((it) => (
        <div key={it.k} className="rounded-lg p-3 border border-border bg-card/40">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{it.k}</div>
          <div className={`text-2xl font-extrabold ${it.cls}`}>{it.v}</div>
          <div className="text-[10px] text-muted-foreground">{it.p}% of {total}</div>
        </div>
      ))}
    </div>
  );
}

export function AttendanceFilterChips({
  value, onChange,
}: { value: RosterStatus | "all"; onChange: (v: RosterStatus | "all") => void }) {
  const keys: Array<RosterStatus | "all"> = ["all", "present", "late", "absent", "excused"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.map((k) => (
        <Button key={k} size="sm" variant={value === k ? "default" : "outline"} onClick={() => onChange(k)}>
          {LABELS[k]}
        </Button>
      ))}
    </div>
  );
}
