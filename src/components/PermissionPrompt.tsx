import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";
import { subscribeToPush, pushSupported } from "@/lib/push";
import { toast } from "sonner";

const ASKED_KEY = "rechoir.notif.prompted";
const AUTO_TRIED = "rechoir.notif.auto-tried";

/**
 * Push notifications are ON by default. We try silently first; only show a
 * friendly explainer if the browser will block silent prompts.
 */
export function PermissionPrompt() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    if (!pushSupported() || typeof Notification === "undefined") return;

    // Already enabled here — nothing to do.
    if (Notification.permission === "granted" && localStorage.getItem("rechoir.notif") === "1") return;

    // Permission already granted (e.g. installed PWA) → auto-subscribe silently.
    if (Notification.permission === "granted") {
      subscribeToPush(profile.id, profile.team_id ?? null).catch(() => {});
      return;
    }
    if (Notification.permission === "denied") return;

    // Default state: try once silently (browser will show the native prompt).
    if (!localStorage.getItem(AUTO_TRIED)) {
      localStorage.setItem(AUTO_TRIED, "1");
      const t = setTimeout(() => {
        subscribeToPush(profile.id, profile.team_id ?? null).catch(() => {
          // If the user dismissed without granting, surface the explainer next visit.
          if (!localStorage.getItem(ASKED_KEY) && Notification.permission !== "granted") {
            setOpen(true);
          }
        });
      }, 1500);
      return () => clearTimeout(t);
    }

    if (localStorage.getItem(ASKED_KEY)) return;
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [profile?.id, profile?.team_id]);

  const enable = async () => {
    if (!profile) return;
    localStorage.setItem(ASKED_KEY, "1");
    const ok = await subscribeToPush(profile.id, profile.team_id ?? null);
    if (ok) toast.success("Notifications enabled");
    else toast("You can enable notifications later in Settings");
    setOpen(false);
  };

  const later = () => {
    localStorage.setItem(ASKED_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && later()}>
      <DialogContent className="glass max-w-md">
        <DialogHeader>
          <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mb-2">
            <BellRing className="h-6 w-6" />
          </div>
          <DialogTitle>Stay in sync with your choir</DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            Turn on notifications to get instant alerts for:
            <ul className="text-sm space-y-1 mt-2 list-disc list-inside text-foreground/80">
              <li>📣 Broadcasts from your team lead</li>
              <li>💬 Chat mentions and direct messages</li>
              <li>📅 Rehearsal and service reminders</li>
              <li>💸 Payment reminders and confirmations</li>
            </ul>
            <p className="text-xs text-muted-foreground pt-2">
              You can change this anytime in Settings.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={later}>Not now</Button>
          <Button className="gradient-primary text-primary-foreground" onClick={enable}>
            Enable notifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
