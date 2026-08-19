import { supabase } from "@/integrations/supabase/client";

export async function sendTeamPush(opts: {
  teamId: string;
  excludeUserId?: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}) {
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        team_id: opts.teamId,
        exclude_user_id: opts.excludeUserId,
        title: opts.title,
        body: opts.body,
        url: opts.url,
        tag: opts.tag,
      },
    });
  } catch {
    // best-effort; in-app realtime + browser fallback still fire
  }
}

/** Targeted push to specific users (preferred for DMs/mentions). */
export async function sendUserPush(opts: {
  userIds: string[];
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}) {
  if (!opts.userIds?.length) return;
  try {
    await supabase.functions.invoke("send-push", {
      body: {
        user_ids: opts.userIds,
        title: opts.title,
        body: opts.body,
        url: opts.url,
        tag: opts.tag,
      },
    });
  } catch {}
}
