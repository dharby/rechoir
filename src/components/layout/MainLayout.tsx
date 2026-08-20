import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, HeartHandshake, CalendarDays,
  CreditCard, Music2, MessageSquare, Megaphone, Shirt, ListChecks,
  UserPlus, Settings, LogOut, ChevronDown, CalendarCheck, BarChart3, Sparkles, BellRing, MessagesSquare, ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import logo from "@/assets/rechoir-logo.png";
import { ReactNode, useState } from "react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { HeaderBell } from "@/components/HeaderBell";
import { useChatUnreadCount } from "@/hooks/useChatUnread";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@supabase/supabase-js";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; leadOnly?: boolean; adminPage?: string; badge?: "chat" | "notif" | "dm" };

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/notifications", label: "Notifications", icon: BellRing, badge: "notif" },
  { to: "/summary", label: "Summary", icon: BarChart3 },
  { to: "/members", label: "Members", icon: Users, leadOnly: true, adminPage: "members" },
  { to: "/team-management", label: "Team management", icon: ShieldCheck, leadOnly: true },
  { to: "/rehearsals", label: "Upcoming events", icon: CalendarDays },
  { to: "/sign-in", label: "Sign-in attendance", icon: CalendarCheck },
  { to: "/my-analytics", label: "My analytics", icon: BarChart3 },
  { to: "/songs", label: "Songs", icon: Music2 },
  { to: "/prayer-chains", label: "Prayer Chains", icon: HeartHandshake },
  { to: "/prayer-requests", label: "Prayer Requests", icon: Sparkles },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/checklists", label: "Checklists", icon: ListChecks },
  { to: "/uniforms", label: "Uniforms", icon: Shirt },
  { to: "/chat", label: "Chat", icon: MessageSquare, badge: "chat" },
  { to: "/dm", label: "Direct messages", icon: MessagesSquare, badge: "dm" },
  { to: "/broadcast", label: "Broadcast", icon: Megaphone, leadOnly: true, adminPage: "broadcast" },
  { to: "/invite", label: "Invite", icon: UserPlus, leadOnly: true },
];

function NavBadge({ kind }: { kind: "chat" | "notif" | "dm" }) {
  const { profile } = useAuth();
  const chatCount = useChatUnreadCount();
  const { data: notifCount = 0 } = useQuery({
    queryKey: ["unread-notif", profile?.id],
    enabled: !!profile?.id && kind === "notif",
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", profile!.id)
        .eq("is_read", false)
        .is("dismissed_at", null);
      return count ?? 0;
    },
  });
  const { data: dmCount = 0 } = useQuery({
    queryKey: ["dm-unread-total", profile?.id],
    enabled: !!profile?.id && kind === "dm",
    queryFn: async () => {
      const me = profile!.id;
      const { data: states } = await supabase
        .from("dm_read_state").select("peer_id, last_read_at").eq("user_id", me);
      const stateMap: Record<string, string> = {};
      (states ?? []).forEach((s: any) => (stateMap[s.peer_id] = s.last_read_at));
      const { data: incoming } = await supabase
        .from("direct_messages").select("sender_id, created_at")
        .eq("recipient_id", me).order("created_at", { ascending: false }).limit(500);
      let total = 0;
      (incoming ?? []).forEach((m: any) => {
        const last = stateMap[m.sender_id];
        if (!last || new Date(m.created_at) > new Date(last)) total++;
      });
      return total;
    },
  });
  const count = kind === "chat" ? chatCount : kind === "notif" ? notifCount : dmCount;
  if (!count) return null;
  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ProfileMenu({ onNav }: { onNav?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-card text-foreground hover:bg-accent/10 transition-colors">
            <UserAvatar user={profile} />
            <div className="text-xs flex-1 min-w-0 text-left">
              <div className="font-medium text-foreground truncate">{profile?.full_name || profile?.email}</div>
              <div className="text-muted-foreground capitalize">{profile?.role?.replace("_", " ")}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-xl p-4 bg-card text-foreground shadow-shadow-card border border-border/30">
          <DropdownMenuItem onClick={() => { navigate("/settings"); onNav?.(); }}>
            <Settings className="h-4 w-4 mr-2" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of RECHOIR?</AlertDialogTitle>
                <AlertDialogDescription>You'll need your email and choir code to sign back in.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { await signOut(); navigate("/"); }} className="btn-primary w-full py-2.5 rounded-md font-medium text-primary-foreground">
                  Sign out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarBody({ onNav }: { onNav?: () => void }) {
  const { profile, team } = useAuth();
  const isLead = profile?.role === "team_lead";
  const adminPages: string[] = (profile as any)?.admin_pages ?? [];
  const isAdmin = !!(profile as any)?.is_admin;
  const items = navItems.filter((i) => {
    if (!i.leadOnly) return true;
    if (isLead) return true;
    if (i.adminPage && isAdmin && adminPages.includes(i.adminPage)) return true;
    return false;
  });

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border/50">
        <img src={logo} alt="RECHOIR" className="h-11 w-11 rounded-xl object-contain" />
        <div className="min-w-0">
          <div className="font-extrabold tracking-tight text-sidebar-foreground">RECHOIR</div>
          <div className="text-xs text-sidebar-foreground/60 truncate max-w-[150px]">
            {team?.name ?? "No choir"}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            onClick={onNav}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary border-primary/20 shadow-sm"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/30 hover:text-primary transition-colors"
              )
            }
          >
            <it.icon className="h-4 w-4" />
            <span className="flex-1">{it.label}</span>
            {it.badge && <NavBadge kind={it.badge} />}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border/50 space-y-3">
        <div className="flex justify-center"><ThemeToggle /></div>
        <ProfileMenu onNav={onNav} />
      </div>
    </div>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 transition-all duration-300 bg-sidebar text-sidebar-foreground border-r border-sidebar-border/50">
        <SidebarBody />
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="hidden md:flex items-center justify-end gap-2 px-6 py-2 border-b border-border bg-card/50 backdrop-blur border-border/30">
          <HeaderBell />
        </header>
        <header className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card border-border/30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar text-sidebar-foreground border-border/30"><SidebarBody onNav={() => setOpen(false)} /></SheetContent>
          </Sheet>
          <div className="font-bold text-sidebar-foreground">RECHOIR</div>
          <HeaderBell />
        </header>
        <main key={location.pathname} className="flex-1 p-6 md:p-8 min-h-[calc(100vh_-_72px)] animate-slide-up">
          {children}
        </main>
      </div>
    </div>
  );
}