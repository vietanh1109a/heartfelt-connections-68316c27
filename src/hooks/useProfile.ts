import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Profile not found - create it automatically
      if (!data && !error) {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ user_id: user.id, balance: 0, bonus_balance: 0 })
          .select("*")
          .single();
        if (insertError) throw insertError;
        return {
          ...newProfile,
          effective_balance: 0,
          bonus_balance: 0,
          bonus_expires_at: null,
          bonus_active: false,
        };
      }

      if (error) throw error;

      // Compute effective balance: permanent + non-expired bonus
      const profile = data as any;
      const bonusActive =
        profile.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();
      const bonusBalance = bonusActive ? (profile.bonus_balance ?? 0) : 0;
      const effectiveBalance = (profile.balance ?? 0) + bonusBalance;

      return {
        ...profile,
        effective_balance: effectiveBalance,
        bonus_balance: profile.bonus_balance ?? 0,
        bonus_expires_at: profile.bonus_expires_at ?? null,
        bonus_active: bonusActive,
      };
    },
    enabled: !!user,
  });
}
