import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getSwitchLimits(admin: any): Promise<{ free: number; vip: number }> {
  try {
    const { data } = await admin.from("app_settings")
      .select("id, value")
      .in("id", ["free_monthly_switches", "vip_monthly_switches"]);
    const map: Record<string, number> = {};
    (data ?? []).forEach((s: any) => { map[s.id] = Number(s.value); });
    return {
      free: map["free_monthly_switches"] ?? 2,
      vip: map["vip_monthly_switches"] ?? 10,
    };
  } catch {
    return { free: 2, vip: 10 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { reason, details } = await req.json();

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("switch_count, switch_reset_at, balance, bonus_balance, bonus_expires_at, vip_expires_at, free_views_left, vip_views_left")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // VIP check
    const isVip = !!(profile.vip_expires_at && new Date(profile.vip_expires_at) > new Date());

    // Check admin/moderator role
    const [adminRoleRes, switchLimits] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "moderator"]).maybeSingle(),
      getSwitchLimits(supabaseAdmin),
    ]);
    const isAdmin = !!adminRoleRes.data;

    // ═══════════════════════════════════════════════════════════════════
    // ANTI-SPAM DETECTION
    // Free: 2 reports in <3 min → ban 1 day
    // VIP: 4 reports in <5 min → ban 1 day
    // ═══════════════════════════════════════════════════════════════════
    if (!isAdmin) {
      const spamWindow = isVip ? 5 : 3; // minutes
      const spamThreshold = isVip ? 4 : 2; // reports count (including current)
      const windowStart = new Date(Date.now() - spamWindow * 60 * 1000).toISOString();

      const { count: recentReports } = await supabaseAdmin
        .from("cookie_reports")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", windowStart);

      // If already at threshold-1 (this would be the Nth report), trigger ban
      if ((recentReports ?? 0) >= spamThreshold - 1) {
        const banExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // 1. Ban user for 1 day
        await supabaseAdmin.from("user_bans").insert({
          user_id: userId,
          reason: "Lạm dụng tính năng báo hỏng tài khoản",
          banned_by: "system",
          is_permanent: false,
          expires_at: banExpiry,
        });

        // 2. Revoke ALL benefits: money, views, VIP, switches
        await supabaseAdmin.from("profiles").update({
          balance: 0,
          bonus_balance: 0,
          bonus_expires_at: null,
          free_views_left: 0,
          vip_views_left: 0,
          vip_expires_at: null,
          switch_count: 0,
        }).eq("user_id", userId);

        // 3. Return assigned cookies to stock (reactivate) & remove assignments
        const { data: assignments } = await supabaseAdmin
          .from("user_cookie_assignment")
          .select("cookie_id")
          .eq("user_id", userId);

        if (assignments && assignments.length > 0) {
          // Reactivate cookies back into stock
          const cookieIds = assignments.map((a: any) => a.cookie_id);
          await supabaseAdmin.from("cookie_stock").update({ is_active: true }).in("id", cookieIds);
          // Remove assignments
          await supabaseAdmin.from("user_cookie_assignment").delete().eq("user_id", userId);
        }

        // 4. Log transaction
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          amount: 0,
          type: "usage",
          memo: `🚫 Bị ban 1 ngày — Lạm dụng tính năng báo hỏng (${(recentReports ?? 0) + 1} lần trong ${spamWindow} phút)`,
        });

        return new Response(JSON.stringify({
          error: `Tài khoản của bạn đã bị khóa 1 ngày do lạm dụng tính năng báo hỏng tài khoản. Toàn bộ số dư, lượt xem và quyền VIP đã bị thu hồi.`,
          banned: true,
        }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Switch limits
    const MAX_SWITCHES = isAdmin ? Infinity : (isVip ? switchLimits.vip : switchLimits.free);

    // Monthly reset
    const now = new Date();
    let switchCount = profile.switch_count ?? 0;
    const resetAt = profile.switch_reset_at ? new Date(profile.switch_reset_at) : null;
    if (!resetAt || now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      switchCount = 0;
    }

    if (!isAdmin && switchCount >= MAX_SWITCHES) {
      return new Response(JSON.stringify({
        error: `Bạn đã hết lượt đổi tài khoản trong tháng này (${MAX_SWITCHES}/${MAX_SWITCHES}).`
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Get current assignments to exclude
    const { data: currentAssignments } = await supabaseAdmin
      .from("user_cookie_assignment")
      .select("cookie_id")
      .eq("user_id", userId);

    const oldCookieIds = (currentAssignments ?? []).map((a: any) => a.cookie_id);

    // 2. DEACTIVATE reported cookies (temporarily remove from stock)
    if (oldCookieIds.length > 0) {
      await supabaseAdmin.from("cookie_stock").update({ is_active: false }).in("id", oldCookieIds);
    }

    // 3. Delete all current assignments
    await supabaseAdmin
      .from("user_cookie_assignment")
      .delete()
      .eq("user_id", userId);

    // 4. Pick a random active cookie from stock (exclude old ones)
    const excludeList = oldCookieIds.length > 0
      ? `(${oldCookieIds.join(",")})`
      : null;

    let query = supabaseAdmin
      .from("cookie_stock")
      .select("id, is_active")
      .eq("is_active", true);

    if (excludeList) {
      query = query.not("id", "in", excludeList);
    }

    const { data: candidates } = await query;

    if (!candidates || candidates.length === 0) {
      // Restore old assignments if no cookies available
      if (oldCookieIds.length > 0) {
        // Re-activate old cookies since we can't replace
        await supabaseAdmin.from("cookie_stock").update({ is_active: true }).in("id", oldCookieIds);
        const restoreRows = oldCookieIds.map((id: string, i: number) => ({
          user_id: userId, cookie_id: id, slot: i + 1,
        }));
        await supabaseAdmin.from("user_cookie_assignment").insert(restoreRows);
      }
      return new Response(JSON.stringify({ error: "Hệ thống hiện không có cookie khả dụng. Vui lòng liên hệ admin." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Shuffle and pick one random
    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const picked = shuffled[0];

    // 5. Assign the picked cookie
    await supabaseAdmin.from("user_cookie_assignment").insert({
      user_id: userId,
      cookie_id: picked.id,
      slot: 1,
    });

    // 6. Update switch count
    await supabaseAdmin
      .from("profiles")
      .update({ switch_count: switchCount + 1, switch_reset_at: now.toISOString() })
      .eq("user_id", userId);

    // 7. Log report for admin — store reported cookie IDs in details as JSON
    const reportDetails = JSON.stringify({
      text: details || null,
      reported_cookie_ids: oldCookieIds,
    });

    await supabaseAdmin.from("cookie_reports").insert({
      user_id: userId,
      reason: reason || "Không rõ",
      details: reportDetails,
      status: "pending",
    });

    // 8. Log transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: 0,
      type: "usage",
      memo: `🔄 Báo hỏng & đổi cookie — Lý do: ${reason || "Không rõ"}${details ? ` (${details})` : ""}`,
    });

    return new Response(JSON.stringify({
      success: true,
      switchesLeft: isAdmin ? "∞" : MAX_SWITCHES - (switchCount + 1),
      message: "Đã cấp tài khoản mới thành công!",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("report-cookie error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
