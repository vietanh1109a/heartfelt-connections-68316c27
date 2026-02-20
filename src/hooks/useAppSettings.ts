import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAppSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("id, value");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((s) => { map[s.id] = s.value; });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    isLoading,
    linkExtension:       data?.link_extension       || "",
    linkGuideYoutube:    data?.link_guide_youtube    || "",
    linkFacebook:        data?.link_facebook         || "",
    linkInstagram:       data?.link_instagram        || "",
    linkThreads:         data?.link_threads          || "",
    linkTiktok:          data?.link_tiktok           || "",
    linkTelegram:        data?.link_telegram         || "",
    linkSupport:         data?.link_support          || "",
    // Game settings
    freeBonusViews:      Number(data?.free_bonus_views     ?? 10),
    freeBonusDays:       Number(data?.free_bonus_days      ?? 7),
    freeCookieSlots:     Number(data?.free_cookie_slots    ?? 2),
    vipCookieSlots:      Number(data?.vip_cookie_slots     ?? 5),
    freeMonthlySwitches: Number(data?.free_monthly_switches ?? 2),
    vipMonthlySwitches:  Number(data?.vip_monthly_switches  ?? 10),
  };
}
