import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_SWITCHES_FREE = 1;
const MAX_SWITCHES_VIP = 2;

async function getAllowedOrigin(admin: any): Promise<string> {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("id", "allowed_origin").single();
    return data?.value || "*";
  } catch {
    return "*";
  }
}

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const allowedOrigin = await getAllowedOrigin(supabaseAdmin);
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { reason, details, dead_cookie_ids } = await req.json();

    // Get user profile + VIP status
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("switch_count, switch_reset_at, balance, bonus_balance, bonus_expires_at, vip_expires_at")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // FIX: Server-side effective balance check (expire bonus if needed)
    await supabaseAdmin.rpc("expire_bonus_if_needed", { target_user_id: user.id });

    const bonusActive = profile.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();
    const bonusBalance = bonusActive ? (profile.bonus_balance ?? 0) : 0;
    const effectiveBalance = (profile.balance ?? 0) + bonusBalance;

    // Check if user has any spendable balance (server-enforced)
    if (effectiveBalance < 1) {
      return new Response(JSON.stringify({ error: "Số dư không đủ để sử dụng dịch vụ." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Determine max switches based on VIP status
    const isVip = !!(profile.vip_expires_at && new Date(profile.vip_expires_at) > new Date());

    // Check if admin (unlimited switches)
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "moderator"])
      .maybeSingle();
    const isAdmin = !!adminRole;

    const MAX_SWITCHES_PER_MONTH = isAdmin ? Infinity : (isVip ? MAX_SWITCHES_VIP : MAX_SWITCHES_FREE);

    // Check and reset switch count monthly
    const now = new Date();
    let switchCount = profile.switch_count ?? 0;
    const resetAt = profile.switch_reset_at ? new Date(profile.switch_reset_at) : null;

    if (!resetAt || now.getMonth() !== resetAt.getMonth() || now.getFullYear() !== resetAt.getFullYear()) {
      switchCount = 0;
    }

    if (!isAdmin && switchCount >= MAX_SWITCHES_PER_MONTH) {
      return new Response(JSON.stringify({
        error: `Bạn đã hết lượt đổi tài khoản trong tháng này (${MAX_SWITCHES_PER_MONTH}/${MAX_SWITCHES_PER_MONTH}).`
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all current cookie assignments for user
    const { data: assignments } = await supabaseAdmin
      .from("user_cookie_assignment")
      .select("cookie_id, slot")
      .eq("user_id", user.id)
      .order("slot", { ascending: true });

    if (!assignments || assignments.length === 0) {
      return new Response(JSON.stringify({ error: "Bạn chưa được gán cookie nào." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const deadIds: string[] = Array.isArray(dead_cookie_ids) && dead_cookie_ids.length > 0
      ? dead_cookie_ids
      : assignments.map((a: any) => a.cookie_id);

    const deadCount = deadIds.length;
    const totalSlots = assignments.length;

    const newSlotsNeeded = deadCount >= totalSlots ? 1 : deadCount;

    await supabaseAdmin
      .from("user_cookie_assignment")
      .delete()
      .eq("user_id", user.id)
      .in("cookie_id", deadIds);

    const keepIds = assignments
      .map((a: any) => a.cookie_id)
      .filter((id: string) => !deadIds.includes(id));

    const allKnownIds = assignments.map((a: any) => a.cookie_id);
    const { data: freshCookies } = await supabaseAdmin
      .from("cookie_stock")
      .select("id")
      .eq("is_active", true)
      .not("id", "in", `(${allKnownIds.map((id: string) => `'${id}'`).join(",")})`)
      .order("updated_at", { ascending: true })
      .limit(newSlotsNeeded);

    let cookiesToAdd = freshCookies ?? [];

    if (cookiesToAdd.length < newSlotsNeeded) {
      const exclude = keepIds.length > 0
        ? `(${keepIds.map((id: string) => `'${id}'`).join(",")})`
        : null;

      let query = supabaseAdmin
        .from("cookie_stock")
        .select("id")
        .eq("is_active", true)
        .order("updated_at", { ascending: true })
        .limit(newSlotsNeeded);

      if (exclude) {
        query = query.not("id", "in", exclude);
      }

      const { data: anyCookies } = await query;
      cookiesToAdd = anyCookies ?? [];
    }

    if (cookiesToAdd.length === 0) {
      const restoreRows = assignments
        .filter((a: any) => deadIds.includes(a.cookie_id))
        .map((a: any) => ({ user_id: user.id, cookie_id: a.cookie_id, slot: a.slot }));
      if (restoreRows.length > 0) {
        await supabaseAdmin.from("user_cookie_assignment").insert(restoreRows);
      }
      return new Response(JSON.stringify({ error: "Hệ thống hiện không có cookie khả dụng. Vui lòng liên hệ admin." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: remainingSlots } = await supabaseAdmin
      .from("user_cookie_assignment")
      .select("slot")
      .eq("user_id", user.id)
      .order("slot", { ascending: false })
      .limit(1);

    const maxSlot = remainingSlots && remainingSlots.length > 0 ? (remainingSlots[0] as any).slot : 0;

    const newRows = cookiesToAdd.map((c: any, i: number) => ({
      user_id: user.id,
      cookie_id: c.id,
      slot: maxSlot + i + 1,
    }));
    await supabaseAdmin.from("user_cookie_assignment").insert(newRows);

    await supabaseAdmin
      .from("profiles")
      .update({
        switch_count: switchCount + 1,
        switch_reset_at: now.toISOString(),
      })
      .eq("user_id", user.id);

    await supabaseAdmin.from("cookie_reports").insert({
      user_id: user.id,
      reason: reason || "Không rõ",
      details: details || null,
      status: "pending",
    });

    const changedCount = deadCount >= totalSlots
      ? `${deadCount} chết → cấp 1 mới`
      : `${deadCount} chết → đổi ${cookiesToAdd.length} mới`;

    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: 0,
      type: "usage",
      memo: `🔄 Báo hỏng & đổi cookie — ${changedCount} — Lý do: ${reason || "Không rõ"}${details ? ` (${details})` : ""}`,
    });

    return new Response(JSON.stringify({
      success: true,
      switchesLeft: isAdmin ? "∞" : MAX_SWITCHES_PER_MONTH - (switchCount + 1),
      deadCount,
      newCount: cookiesToAdd.length,
      message: deadCount >= totalSlots
        ? `Đã đổi ${cookiesToAdd.length} tài khoản mới (${deadCount} tài khoản cũ đều bị lỗi).`
        : `Đã thay thế ${cookiesToAdd.length} tài khoản bị lỗi!`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("report-cookie error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
