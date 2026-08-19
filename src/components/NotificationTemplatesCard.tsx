import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareText, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_META,
  loadTemplates,
  saveTemplate,
  resetTemplate,
  invalidateTemplateCache,
  type TemplateType,
} from "@/lib/notif-templates";

const TYPES: TemplateType[] = [
  "rehearsal", "songs", "payments", "uniforms", "prayer", "prayer_lead", "attendance", "broadcast",
];

/** Lead-only editor for short, friendly notification templates. */
export function NotificationTemplatesCard() {
  const { team, profile } = useAuth();
  const isLead = profile?.role === "team_lead";
  const [drafts, setDrafts] = useState<Record<string, { title: string; body: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!team?.id) return;
    setLoading(true);
    invalidateTemplateCache();
    loadTemplates(team.id).then((map) => {
      const initial: Record<string, { title: string; body: string }> = {};
      for (const t of TYPES) {
        const cfg = map[t];
        const def = DEFAULT_TEMPLATES[t];
        initial[t] = cfg ? { ...cfg } : { ...def };
      }
      setDrafts(initial);
      setLoading(false);
    });
  }, [team?.id]);

  const save = async (type: TemplateType) => {
    if (!team) return;
    const d = drafts[type];
    if (!d?.title.trim()) { toast.error("Title can't be empty"); return; }
    setSaving(type);
    try {
      await saveTemplate(team.id, type, d.title.trim(), (d.body ?? "").trim());
      toast.success(`${TEMPLATE_META[type].label} template saved`);
    } catch (e: any) {
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(null);
    }
  };

  const reset = async (type: TemplateType) => {
    if (!team) return;
    await resetTemplate(team.id, type);
    setDrafts((d) => ({ ...d, [type]: { ...DEFAULT_TEMPLATES[type] } }));
    toast.success("Reset to default");
  };

  if (!isLead) return null;

  return (
    <Card className="p-6 glass space-y-4">
      <div>
        <h2 className="font-bold flex items-center gap-2">
          <MessageSquareText className="h-4 w-4" /> Notification templates
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Edit the short, friendly message your team gets for each event type. Use placeholders like
          <code className="px-1 mx-1 rounded bg-muted">{`{title}`}</code>,
          <code className="px-1 mx-1 rounded bg-muted">{`{date}`}</code>,
          <code className="px-1 mx-1 rounded bg-muted">{`{amount}`}</code> — they're replaced automatically.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
        </div>
      ) : (
        <div className="space-y-5">
          {TYPES.map((t) => {
            const meta = TEMPLATE_META[t];
            const d = drafts[t] ?? DEFAULT_TEMPLATES[t];
            return (
              <div key={t} className="border-t border-border pt-4 first:border-0 first:pt-0 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-semibold">{meta.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    Placeholders: {meta.placeholders.join(" ")}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={d.title}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [t]: { ...d, title: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    rows={2}
                    value={d.body}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [t]: { ...d, body: e.target.value } }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="gradient-primary text-primary-foreground"
                    disabled={saving === t}
                    onClick={() => save(t)}
                  >
                    {saving === t ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => reset(t)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
