// Configurable, short notification templates per team.
// Team leads edit them in Settings; anyone sending an event uses them.
import { supabase } from "@/integrations/supabase/client";

export type TemplateType =
  | "rehearsal"
  | "songs"
  | "payments"
  | "uniforms"
  | "prayer"
  | "prayer_lead"
  | "attendance"
  | "broadcast";

export const DEFAULT_TEMPLATES: Record<TemplateType, { title: string; body: string }> = {
  rehearsal:   { title: "📅 Upcoming rehearsal",     body: "{title} — {date}{at_time}" },
  songs:       { title: "🎵 New song added",         body: "{title}" },
  payments:    { title: "💸 Dues payment reminder",  body: "{title} — {amount} due {date}" },
  uniforms:    { title: "👔 Uniform schedule",       body: "{title} — {date}" },
  prayer:      { title: "🙏 New prayer chain",       body: "{title}" },
  prayer_lead: { title: "🙏 You're leading prayer",  body: "{date}{at_time}{focus}" },
  attendance:  { title: "🪑 Attendance reminder",    body: "{title} — {date}" },
  broadcast:   { title: "📣 {sender}",                body: "{title}" },
};

export const TEMPLATE_META: Record<TemplateType, { label: string; placeholders: string[] }> = {
  rehearsal:   { label: "Upcoming rehearsal",  placeholders: ["{title}", "{date}", "{at_time}"] },
  songs:       { label: "New song",            placeholders: ["{title}"] },
  payments:    { label: "Dues payment",        placeholders: ["{title}", "{amount}", "{date}"] },
  uniforms:    { label: "Uniform schedule",    placeholders: ["{title}", "{date}"] },
  prayer:      { label: "Prayer chain",        placeholders: ["{title}"] },
  prayer_lead: { label: "Prayer lead",         placeholders: ["{date}", "{at_time}", "{focus}"] },
  attendance:  { label: "Attendance",          placeholders: ["{title}", "{date}"] },
  broadcast:   { label: "Broadcast",           placeholders: ["{sender}", "{title}"] },
};

// In-memory cache (team_id -> templates)
let cache: { teamId: string; map: Record<string, { title: string; body: string }> } | null = null;

export async function loadTemplates(teamId: string) {
  if (cache && cache.teamId === teamId) return cache.map;
  const { data } = await supabase
    .from("notification_templates" as any)
    .select("type, template")
    .eq("team_id", teamId);
  const map: Record<string, { title: string; body: string }> = {};
  for (const row of (data ?? []) as any[]) {
    // template stored as "title\n---\nbody"
    const [title, ...rest] = (row.template || "").split("\n---\n");
    map[row.type] = { title: title || "", body: rest.join("\n---\n") };
  }
  cache = { teamId, map };
  return map;
}

export function invalidateTemplateCache() {
  cache = null;
}

function applyVars(s: string, vars: Record<string, string | undefined>) {
  return s.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? "").toString()).replace(/\s+/g, " ").trim();
}

/** Render a template for a given type. Falls back to default if none configured. */
export async function renderTemplate(
  teamId: string,
  type: TemplateType,
  vars: Record<string, string | undefined>,
): Promise<{ title: string; body: string }> {
  const map = await loadTemplates(teamId);
  const def = DEFAULT_TEMPLATES[type];
  const t = map[type] ?? def;
  return {
    title: applyVars(t.title || def.title, vars),
    body: applyVars(t.body || def.body, vars),
  };
}

export async function saveTemplate(teamId: string, type: TemplateType, title: string, body: string) {
  const template = `${title}\n---\n${body}`;
  const { error } = await supabase
    .from("notification_templates" as any)
    .upsert({ team_id: teamId, type, template } as any, { onConflict: "team_id,type" });
  invalidateTemplateCache();
  if (error) throw error;
}

export async function resetTemplate(teamId: string, type: TemplateType) {
  await supabase.from("notification_templates" as any).delete().eq("team_id", teamId).eq("type", type);
  invalidateTemplateCache();
}
