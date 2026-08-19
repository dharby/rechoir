// Sends Web Push notifications to a team or list of users.
// Body: { team_id?: string, user_ids?: string[], exclude_user_id?: string,
//         title: string, body?: string, url?: string, tag?: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const FALLBACK_SUBJECT = "mailto:notifications@rechoir.app";

// VAPID subject must be a valid mailto: or https: URL. If the env value is
// missing or malformed (e.g. someone typed "te4t4"), fall back to the default
// instead of crashing the entire function on boot.
function safeVapidSubject(raw: string | undefined): string {
  const v = (raw || "").trim();
  if (!v) return FALLBACK_SUBJECT;
  if (v.startsWith("mailto:") && v.includes("@")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || u.protocol === "http:") return v;
  } catch {}
  console.warn(`Invalid VAPID_SUBJECT "${v}" — using fallback`);
  return FALLBACK_SUBJECT;
}

let vapidReady = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(safeVapidSubject(Deno.env.get("VAPID_SUBJECT")), VAPID_PUBLIC, VAPID_PRIVATE);
    vapidReady = true;
  } catch (e) {
    console.error("VAPID setup failed:", (e as Error).message);
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  if (!vapidReady) {
    return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



  let body: any = {};
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400, headers: corsHeaders }); }
  const { team_id, user_ids, exclude_user_id, title, body: msgBody, url, tag } = body || {};
  if (!title) return new Response(JSON.stringify({ error: "title required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let q = admin.from("push_subscriptions").select("*");
  if (team_id) q = q.eq("team_id", team_id);
  if (Array.isArray(user_ids) && user_ids.length) q = q.in("user_id", user_ids);
  if (exclude_user_id) q = q.neq("user_id", exclude_user_id);
  const { data: subs, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const payload = JSON.stringify({ title, body: msgBody ?? "", url: url ?? "/dashboard", tag: tag ?? "rechoir" });
  let sent = 0; let stale = 0; let failed = 0;
  await Promise.all((subs ?? []).map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
        payload
      );
      sent++;
    } catch (e: any) {
      const code = e?.statusCode;
      if (code === 404 || code === 410) {
        stale++;
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        failed++;
        console.error("push send failed", { code, message: e?.message, endpoint: s.endpoint?.slice(0, 60) });
      }
    }
  }));

  return new Response(JSON.stringify({ sent, stale, failed, total: subs?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
