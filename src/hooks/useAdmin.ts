import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useAdmin() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-role", user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isModerator: false };
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const roles = (data ?? []).map(r => r.role);
      return {
        isAdmin: roles.includes("admin"),
        isModerator: roles.includes("moderator"),
      };
    },
    enabled: !!user,
  });

  return {
    isAdmin: data?.isAdmin ?? false,
    isModerator: data?.isModerator ?? false,
    isLoading,
  };
}

