import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useAdmin } from "@/hooks/useAdmin";
import { useAppSettings } from "@/hooks/useAppSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

export const MIN_EXTENSION_VERSION = "2.0.0";

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

export function useIndexData() {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { isAdmin } = useAdmin();
  const { freeMonthlySwitches, vipMonthlySwitches } = useAppSettings();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [extensionOutdated, setExtensionOutdated] = useState(false);

  // Ban status
  const { data: activeBan } = useQuery({
    queryKey: ["user-ban", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_bans")
        .select("*")
        .eq("user_id", user.id)
        .or(`expires_at.gt.${new Date().toISOString()},is_permanent.eq.true`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Cookie assignments — always fetch via edge function (bypasses RLS on cookie_stock)
  const { data: cookieAssignments } = useQuery({
    queryKey: ["cookie-assignments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return [];
      
      const supabaseUrl = "https://ckamflsosjzkyukajxzu.supabase.co";
      const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrYW1mbHNvc2p6a3l1a2FqeHp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzMyOTYsImV4cCI6MjA4NzA0OTI5Nn0.G32dB8s_G2xAWohnqegON4cfQT2tswgM9RGFt5tmud0";
      
      const res = await fetch(`${supabaseUrl}/functions/v1/assign-cookie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      console.log("Cookie assignments result:", result);
      
      if (!res.ok || result.error) {
        console.error("Cookie assign/fetch failed:", result.error);
        return [];
      }
      
      // Return assignments from edge function response
      const assignments = result.assignments || [];
      return assignments.map((a: any) => ({
        id: a.id,
        cookie_stock: { is_active: a.is_active },
      }));
    },
    enabled: !!user,
    staleTime: 30000,
  });

  const activeCookieCount = (cookieAssignments ?? []).filter(
    (a: { cookie_stock: { is_active: boolean } | null }) => a.cookie_stock?.is_active
  ).length;

  // VIP / switch info from profile
  const switchCount = profile?.switch_count ?? 0;
  const switchResetAt = profile?.switch_reset_at;
  const now = new Date();
  const isCurrentMonth =
    !!switchResetAt &&
    new Date(switchResetAt).getMonth() === now.getMonth() &&
    new Date(switchResetAt).getFullYear() === now.getFullYear();

  const isVip = !!profile?.vip_expires_at && new Date(profile.vip_expires_at) > new Date();
  const vipExpiresAt = profile?.vip_expires_at ? new Date(profile.vip_expires_at) : null;
  const maxSwitches = isAdmin ? Infinity : (isVip ? vipMonthlySwitches : freeMonthlySwitches);
  const switchesLeft = Math.max(0, maxSwitches - (isCurrentMonth ? switchCount : 0));

  // VIP plans
  const { data: vipPlans } = useQuery({
    queryKey: ["vip-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_plans")
        .select("*")
        .eq("is_active", true)
        .order("duration_days", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Realtime balance / VIP updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newBalance = (payload.new as { balance: number }).balance;
          const oldBalance = (payload.old as { balance: number }).balance;
          const newVip = (payload.new as { vip_expires_at: string | null }).vip_expires_at;
          const oldVip = (payload.old as { vip_expires_at: string | null }).vip_expires_at;
          if (newBalance > oldBalance) {
            const added = (newBalance - oldBalance).toLocaleString("vi-VN");
            const total = newBalance.toLocaleString("vi-VN");
            toast.success(`💰 Số dư đã được cộng +${added}đ! Số dư mới: ${total}đ`);
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
          if (newVip && newVip !== oldVip) {
            toast.success(`👑 Tài khoản của bạn đã được nâng cấp VIP! Hạn: ${new Date(newVip).toLocaleDateString("vi-VN")}`);
            queryClient.invalidateQueries({ queryKey: ["profile"] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  // Extension detection
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.data?.type === "EXTENSION_READY" ||
        event.data?.type === "EXTENSION_VERSION_RESPONSE" ||
        event.data?.type === "PONG_EXTENSION"
      ) {
        const ver = event.data.version;
        setExtensionVersion(ver);
        setExtensionOutdated(compareVersions(ver, MIN_EXTENSION_VERSION) < 0);
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({ type: "GET_EXTENSION_VERSION" }, "*");
    const t1 = setTimeout(() => window.postMessage({ type: "PING_EXTENSION" }, "*"), 500);
    const t2 = setTimeout(() => window.postMessage({ type: "GET_EXTENSION_VERSION" }, "*"), 1500);
    const t3 = setTimeout(() => window.postMessage({ type: "PING_EXTENSION" }, "*"), 3000);
    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  return {
    user, signOut, profile, isLoading, isAdmin, navigate, queryClient,
    extensionVersion, setExtensionVersion, extensionOutdated,
    activeBan, activeCookieCount,
    isVip, vipExpiresAt, maxSwitches, switchesLeft,
    vipPlans,
  };
}

export function useCookieActions(
  user: { id: string } | null | undefined,
  extensionVersion: string | null,
  setExtensionVersion: (v: string) => void
) {
  const trySendCookie = (cookieData: string): Promise<boolean> =>
    new Promise((resolve) => {
      window.postMessage({ type: "TRANSFER_COOKIE", payload: cookieData }, "*");
      const t = setTimeout(() => { window.removeEventListener("message", h); resolve(false); }, 5000);
      const h = (event: MessageEvent) => {
        if (event.data?.type === "COOKIE_SET_SUCCESS") { clearTimeout(t); window.removeEventListener("message", h); resolve(true); }
        else if (event.data?.type === "COOKIE_SET_ERROR") { clearTimeout(t); window.removeEventListener("message", h); resolve(false); }
      };
      window.addEventListener("message", h);
    });

  const checkExtensionAlive = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (extensionVersion) { resolve(extensionVersion); return; }
      const t = setTimeout(() => { window.removeEventListener("message", h); resolve(null); }, 2000);
      const h = (event: MessageEvent) => {
        if (
          event.data?.type === "EXTENSION_VERSION_RESPONSE" ||
          event.data?.type === "PONG_EXTENSION" ||
          event.data?.type === "EXTENSION_READY"
        ) {
          clearTimeout(t); window.removeEventListener("message", h);
          const ver = event.data.version;
          setExtensionVersion(ver);
          resolve(ver);
        }
      };
      window.addEventListener("message", h);
      window.postMessage({ type: "PING_EXTENSION" }, "*");
    });

  const checkCookiesBatch = (
    cookies: { cookie_id: string; cookie_data: string }[]
  ): Promise<Record<string, boolean>> =>
    new Promise((resolve) => {
      const results: Record<string, boolean> = {};
      let completed = 0;
      const cookieSets = cookies.map((c) => ({ id: c.cookie_id, cookieData: c.cookie_data }));
      const t = setTimeout(() => {
        window.removeEventListener("message", h);
        cookies.forEach((c) => { if (!(c.cookie_id in results)) results[c.cookie_id] = false; });
        resolve(results);
      }, 20000);
      const h = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === "CHECK_LIVE_RESULT") { results[event.data.id] = event.data.alive === true; completed++; }
        if (event.data.type === "CHECK_LIVE_COMPLETE" || completed >= cookies.length) {
          clearTimeout(t); window.removeEventListener("message", h);
          cookies.forEach((c) => { if (!(c.cookie_id in results)) results[c.cookie_id] = false; });
          resolve(results);
        }
      };
      window.addEventListener("message", h);
      window.postMessage({ type: "CHECK_LIVE_BATCH", cookieSets }, "*");
    });

  return { trySendCookie, checkExtensionAlive, checkCookiesBatch };
}
