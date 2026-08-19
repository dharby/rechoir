import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/components/layout/MainLayout";

import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import RegisterTeam from "./pages/auth/RegisterTeam";
import AcceptInvite from "./pages/auth/AcceptInvite";
import ResetPassword from "./pages/auth/ResetPassword";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import Rehearsals from "./pages/Rehearsals";
import ServiceAttendance from "./pages/ServiceAttendance";
import Songs from "./pages/Songs";
import PrayerChains from "./pages/PrayerChains";
import PrayerRequests from "./pages/PrayerRequests";
import Payments from "./pages/Payments";
import Checklists from "./pages/Checklists";
import Uniforms from "./pages/Uniforms";
import Chat from "./pages/Chat";
import DirectMessages from "./pages/DirectMessages";
import Broadcast from "./pages/Broadcast";
import Invite from "./pages/Invite";
import SettingsPage from "./pages/Settings";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import MyAnalytics from "./pages/MyAnalytics";
import MemberDetail from "./pages/MemberDetail";
import Probation from "./pages/Probation";
import AdminAccess from "./pages/AdminAccess";
import TeamManagement from "./pages/TeamManagement";
import { NotificationBridge } from "./components/NotificationBridge";
import { PermissionPrompt } from "./components/PermissionPrompt";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
});

const wrap = (el: React.ReactNode, leadOnly = false, adminPage?: string) => (
  <ProtectedRoute leadOnly={leadOnly} adminPage={adminPage}><MainLayout>{el}</MainLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NotificationBridge />
            <PermissionPrompt />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register-team" element={<RegisterTeam />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<Onboarding />} />

              <Route path="/dashboard" element={wrap(<Dashboard />)} />
              <Route path="/notifications" element={wrap(<Notifications />)} />
              <Route path="/members" element={wrap(<Members />, true, "members")} />
              <Route path="/members/:id" element={wrap(<MemberDetail />)} />
              <Route path="/probation" element={wrap(<Probation />, true)} />
              <Route path="/admin-access" element={wrap(<AdminAccess />, true)} />
              <Route path="/team-management" element={wrap(<TeamManagement />, true)} />
              <Route path="/rehearsals" element={wrap(<Rehearsals />)} />
              {/* Rehearsal attendance merged into Sign-in attendance (/sign-in). */}
              <Route path="/attendance" element={wrap(<ServiceAttendance />)} />
              <Route path="/my-analytics" element={wrap(<MyAnalytics />)} />
              <Route path="/sign-in" element={wrap(<ServiceAttendance />)} />
              <Route path="/songs" element={wrap(<Songs />)} />
              <Route path="/prayer-chains" element={wrap(<PrayerChains />)} />
              <Route path="/prayer-requests" element={wrap(<PrayerRequests />)} />
              <Route path="/payments" element={wrap(<Payments />)} />
              <Route path="/checklists" element={wrap(<Checklists />)} />
              <Route path="/uniforms" element={wrap(<Uniforms />)} />
              <Route path="/chat" element={wrap(<Chat />)} />
              <Route path="/dm" element={wrap(<DirectMessages />)} />
              <Route path="/broadcast" element={wrap(<Broadcast />, true, "broadcast")} />
              <Route path="/invite" element={wrap(<Invite />, true)} />
              <Route path="/settings" element={wrap(<SettingsPage />)} />
              <Route path="/summary" element={wrap(<Summary />)} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
