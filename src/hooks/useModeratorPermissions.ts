import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "./useAdmin";

export type TabPermission = {
  tab: string;
  can_view: boolean;
  can_edit: boolean;
};

export function useModeratorPermissions() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  return useQuery({
    queryKey: ["moderator-permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("moderator_permissions")
        .select("*")
        .order("tab");
      if (error) throw error;
      return (data ?? []) as TabPermission[];
    },
    enabled: !!user,
    // Admins have full access to all tabs
    select: (perms: TabPermission[]) => {
      if (isAdmin) {
        // Super admin sees everything
        return perms.map(p => ({ ...p, can_view: true, can_edit: true }));
      }
      return perms;
    },
  });
}
