import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Bell, Download, KeyRound, Palette } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";

import { categoryEnabled, setCategoryEnabled, useCategoryPrefs, type NotifCategory } from "@/lib/notifications";
import { soundEnabled, setSoundEnabled, playPing } from "@/lib/sound";
import { UserAvatar } from "@/components/UserAvatar";
import { Camera, Loader2 } from "lucide-react";
import { NotificationTemplatesCard } from "@/components/NotificationTemplatesCard";
import { NotificationStatusCard } from "@/components/NotificationStatusCard";
import { ChatNotificationPrefsCard } from "@/components/ChatNotificationPrefsCard";
import { NotificationReplayCard } from "@/components/NotificationReplayCard";

export default function Settings() {
  const { profile, refresh } = useAuth();
  const [name, setName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [spec, setSpec] = useState(profile?.specialization || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Notifications (sound preference; full status lives in NotificationStatusCard)
  const [pingOn, setPingOn] = useState<boolean>(() => soundEnabled());

  // PWA install prompt
  const [installEvt, setInstallEvt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: name, phone, specialization: spec,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { await refresh(); toast.success("Saved!"); }
  };

  const installApp = async () => {
    if (!installEvt) {
      toast.info("Use your browser menu → Install RECHOIR (or Add to Home Screen)");
      return;
    }
    installEvt.prompt();
    const { outcome } = await installEvt.userChoice;
    if (outcome === "accepted") toast.success("Installing…");
    setInstallEvt(null);
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", profile.id);
      if (profErr) throw profErr;
      await refresh();
      toast.success("Display picture updated");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const removeAvatar = async () => {
    if (!profile) return;
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
    await refresh();
    toast.success("Display picture removed");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-extrabold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and preferences</p>
        </div>
      </div>

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold">Profile</h2>
        <div className="flex items-center gap-4">
          <UserAvatar user={profile} className="h-16 w-16" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input type="file" accept="image/*" className="hidden" onChange={onAvatarChange} disabled={uploadingAvatar} />
              <span className={`inline-flex items-center gap-2 px-3 h-9 rounded-md border border-border text-sm cursor-pointer hover:bg-muted ${uploadingAvatar ? "opacity-60 pointer-events-none" : ""}`}>
                {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {profile?.avatar_url ? "Change picture" : "Upload picture"}
              </span>
            </label>
            {profile?.avatar_url && (
              <Button variant="ghost" size="sm" onClick={removeAvatar}>Remove</Button>
            )}
          </div>
        </div>
        <div><Label>Full name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><Label>Specialization</Label><Input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="Soprano, Drums..." /></div>
        <div><Label>Email</Label><Input value={profile?.email || ""} disabled /></div>
        <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">Save changes</Button>
      </Card>

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</h2>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-medium text-sm">Theme</div>
            <div className="text-xs text-muted-foreground">Light, dark or follow your device.</div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      <NotificationStatusCard />

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Bell className="h-4 w-4" /> Notification preferences</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Ping sound</div>
            <div className="text-xs text-muted-foreground">Play a chime when a notification arrives</div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => playPing()}>Test</Button>
            <Switch checked={pingOn} onCheckedChange={(v) => { setSoundEnabled(v); setPingOn(v); if (v) playPing(); }} />
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Categories</div>
          <CategoryToggle category="broadcast" label="📣 Broadcasts" desc="Important announcements from your team lead" />
          <CategoryToggle category="chat" label="💬 Chat mentions" desc="When someone @mentions you in team chat" />
          <CategoryToggle category="reminder" label="⏰ Reminders" desc="Payment, rehearsal and prayer reminders" />
          <CategoryToggle category="announcement" label="✨ Announcements" desc="New songs, rehearsals, prayer chains, uniforms" />
        </div>
      </Card>

      <ChatNotificationPrefsCard />

      <NotificationReplayCard />

      <NotificationTemplatesCard />

      <Card className="p-6 glass space-y-3 border-primary/30">
        <h2 className="font-bold flex items-center gap-2"><Download className="h-4 w-4 text-primary" /> Install to home screen</h2>
        <p className="text-sm text-muted-foreground">
          For reliable background notifications — including reminders, rehearsals,
          dues, prayer lead and chat alerts — install RECHOIR to your home screen.
          When installed, the OS keeps notifications flowing even when the app is closed.
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><b>iOS Safari:</b> tap Share → <i>Add to Home Screen</i>.</li>
          <li><b>Android Chrome:</b> tap the menu (⋮) → <i>Install app</i> / <i>Add to Home Screen</i>.</li>
          <li><b>Desktop:</b> use the install icon in the address bar.</li>
        </ul>
        <Button onClick={installApp} className="gradient-primary text-primary-foreground">Install RECHOIR</Button>
      </Card>

      <Card className="p-6 glass space-y-4">
        <h2 className="font-bold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Security</h2>
        <Link to="/reset-password"><Button variant="outline">Reset password</Button></Link>
      </Card>
    </div>
  );
}

function CategoryToggle({ category, label, desc }: { category: NotifCategory; label: string; desc: string }) {
  // Re-render on cross-tab / cross-component changes
  useCategoryPrefs();
  const on = categoryEnabled(category);
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch
        checked={on}
        onCheckedChange={(v) => setCategoryEnabled(category, v)}
      />
    </div>
  );
}
