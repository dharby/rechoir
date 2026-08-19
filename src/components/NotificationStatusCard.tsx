import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, BellRing, ShieldAlert, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { canUseBackgroundPush, hasActivePushSubscription, subscribeToPush, unsubscribeFromPush, pushEnabled } from "@/lib/push";
import { showOsNotification } from "@/lib/os-notify";
import { toast } from "sonner";

type State = "unsupported" | "default" | "granted" | "denied";

function readState(): State {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as State;
}

async function readLiveState(): Promise<State> {
  const direct = readState();
  if (direct === "unsupported") return "unsupported";
  try {
    const status = await navigator.permissions?.query?.({ name: "notifications" as PermissionName });
    if (direct === "granted" || status?.state === "granted") return "granted";
    if (direct === "denied" || status?.state === "denied") return "denied";
    if (status?.state === "prompt") return "default";
  } catch {}
  return direct;
}

export function NotificationStatusCard() {
  const { profile } = useAuth();
  const [state, setState] = useState<State>(readState());
  const [subscribed, setSubscribed] = useState<boolean>(pushEnabled());
  const [busy, setBusy] = useState(false);

  const sync = async () => {
    setState(await readLiveState());
    setSubscribed((await hasActivePushSubscription()) || pushEnabled());
  };

  // Keep UI in sync (permission may change in another tab / browser settings)
  useEffect(() => {
    const tick = () => { sync(); };
    const id = setInterval(tick, 2000);
    tick();
    let permissionStatus: PermissionStatus | null = null;
    navigator.permissions?.query?.({ name: "notifications" as PermissionName })
      .then((status) => {
        permissionStatus = status;
        status.onchange = tick;
      })
      .catch(() => {});
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      if (permissionStatus) permissionStatus.onchange = null;
      window.removeEventListener("focus", tick);
    };
  }, []);

  const enable = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const latest = await readLiveState();
      setState(latest);
      if (latest === "denied") {
        toast.error("Notifications are still blocked in this browser's site settings");
        return;
      }
      const ok = await subscribeToPush(profile.id, profile.team_id ?? null);
      await sync();
      if (ok) toast.success("Notifications enabled on this device");
      else if (Notification.permission === "denied")
        toast.error("Blocked — re-enable in your browser site settings");
      else if (!canUseBackgroundPush()) toast("Open-tab notifications are allowed here. Use the published app installed to your home screen for background delivery.");
      else toast.error("Permission is allowed, but device registration did not finish. Please try again.");
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.success("Notifications disabled");
    } finally { setBusy(false); }
  };

  const sendTest = async () => {
    if (!profile?.id) return;
    const ok = await showOsNotification({
      title: "🔔 RECHOIR test",
      body: "Notifications are working on this device.",
      url: "/notifications",
      tag: "test",
    });
    if (ok) toast.success("Test notification sent");
    else toast.error("Enable notifications first, then try the test again");
  };

  const permitted = state === "granted";
  const ready = permitted && subscribed;

  const StatusBadge = () => {
    if (state === "unsupported")
      return <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" /> Not supported</Badge>;
    if (state === "denied")
      return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> Blocked</Badge>;
    if (ready)
      return <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary"><Check className="h-3 w-3" /> On</Badge>;
    if (state === "granted")
      return <Badge variant="outline" className="gap-1"><Bell className="h-3 w-3" /> Granted, not subscribed</Badge>;
    return <Badge variant="outline" className="gap-1"><BellOff className="h-3 w-3" /> Off</Badge>;
  };

  return (
    <Card className="p-6 glass space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold leading-tight">Notification permission</h2>
            <p className="text-xs text-muted-foreground">Live status on this device</p>
          </div>
        </div>
        <StatusBadge />
      </div>

      {state === "unsupported" && (
        <p className="text-xs text-muted-foreground">
          This browser doesn't support push notifications. Install RECHOIR to your home screen
          (see below) or open it in Chrome / Safari for full support.
        </p>
      )}

      {state === "denied" && (
        <div className="text-xs text-destructive space-y-1">
          <p>You've blocked notifications for this site.</p>
          <p className="text-muted-foreground">
            Re-enable in your browser: tap the lock/info icon next to the address bar →
            <b> Site settings</b> → <b>Notifications</b> → <b>Allow</b>, then return here and tap Enable.
          </p>
          <p className="text-muted-foreground">
            If you already changed it to Allow, tap Enable notifications to re-check this device.
          </p>
        </div>
      )}

      {state === "default" && (
        <p className="text-xs text-muted-foreground">
          Tap <b>Enable notifications</b> below. Your browser will ask for permission once.
        </p>
      )}

      {ready && (
        <p className="text-xs text-muted-foreground">
          Reminders, broadcasts, chat mentions and DMs will appear as system notifications —
          even when the tab is closed (if installed to your home screen).
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!ready && (
          <Button
            disabled={busy || state === "unsupported"}
            onClick={enable}
            className="gradient-primary text-primary-foreground"
          >
            {state === "denied" ? <RefreshCw className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            Enable notifications
          </Button>
        )}
        {permitted && (
          <Button variant="outline" onClick={sendTest}>Send test notification</Button>
        )}
        {ready && (
          <>
            <Button variant="ghost" onClick={disable} disabled={busy}>
              <BellOff className="h-4 w-4 mr-2" /> Turn off on this device
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
