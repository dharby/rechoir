import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function ProtectedRoute({
  children,
  leadOnly = false,
  adminPage,
}: {
  children: ReactNode;
  leadOnly?: boolean;
  /** If set, either team_lead OR an admin with this page in admin_pages may enter. */
  adminPage?: string;
}) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (!profile?.team_id) return <Navigate to="/onboarding" replace />;

  if (profile && profile.is_active === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-extrabold">Account deactivated</h1>
          <p className="text-muted-foreground">
            Your team lead has deactivated your account, so your dashboard is disabled.
            Please reach out to them to be reactivated.
          </p>
        </div>
      </div>
    );
  }

  const isLead = profile?.role === "team_lead";
  const adminPages: string[] = (profile as any)?.admin_pages ?? [];
  const isAdminForPage = !!adminPage && !!(profile as any)?.is_admin && adminPages.includes(adminPage);

  if (leadOnly && !isLead && !isAdminForPage) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
