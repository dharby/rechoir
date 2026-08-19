import { useAuth } from "@/hooks/useAuth";

/**
 * Returns true if the current user can manage the given page.
 * Team leads can manage everything. Non-lead members must have `is_admin`
 * and the page key listed in their `admin_pages` array.
 */
export function useCanManage(pageKey?: string) {
  const { profile } = useAuth();
  if (!profile) return false;
  if (profile.role === "team_lead") return true;
  if (!pageKey) return false;
  const p: any = profile;
  return !!p.is_admin && Array.isArray(p.admin_pages) && p.admin_pages.includes(pageKey);
}
