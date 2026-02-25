import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Safe VND formatter — toLocaleString("vi-VN") can crash on Deno (no ICU data)
function fmtVND(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const token = authHeader.replace("Bearer ", "");

    // Use same auth pattern as purchase-plan (working function)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const { vip_plan_id } = await req.json();
    if (!vip_plan_id) throw new Error("Missing vip_plan_id");

    // Get VIP plan
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("vip_plans").select("*").eq("id", vip_plan_id).eq("is_active", true).single();
    if (planErr || !plan) throw new Error("Gói VIP không tồn tại hoặc đã ngừng bán");

    // Expire bonus if needed
    await supabaseAdmin.rpc("expire_bonus_if_needed", { target_user_id: user.id });

    // Get user profile
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles").select("balance, bonus_balance, bonus_expires_at, vip_expires_at").eq("user_id", user.id).single();
    if (profErr || !profile) throw new Error("Không tìm thấy profile");

    // Compute effective balance
    const bonusActive = profile.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();
    const bonusBalance = bonusActive ? (profile.bonus_balance ?? 0) : 0;
    const effectiveBalance = (profile.balance ?? 0) + bonusBalance;

    if (effectiveBalance < plan.price) {
      return new Response(JSON.stringify({ error: `Số dư không đủ. Cần ${fmtVND(plan.price)}, bạn có ${fmtVND(effectiveBalance)}.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from bonus first, then permanent
    let remainingDeduct = plan.price;
    let newBonusBalance = bonusBalance;
    let newPermanentBalance = profile.balance ?? 0;

    if (bonusBalance > 0 && bonusActive) {
      const fromBonus = Math.min(bonusBalance, remainingDeduct);
      newBonusBalance -= fromBonus;
      remainingDeduct -= fromBonus;
    }
    if (remainingDeduct > 0) newPermanentBalance -= remainingDeduct;

    // Calculate VIP expiry (extend if already VIP)
    const now = new Date();
    const currentExpiry = profile.vip_expires_at ? new Date(profile.vip_expires_at) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    // Calculate views to grant based on duration
    const viewsToGrant = plan.duration_days >= 3650 ? 999999
      : plan.duration_days >= 365 ? 500
      : plan.duration_days >= 90 ? 222
      : plan.duration_days >= 30 ? 60 : 0;

    const { data: currentProfile } = await supabaseAdmin
      .from("profiles").select("vip_views_left").eq("user_id", user.id).single();
    const existingViews = (currentProfile as any)?.vip_views_left ?? 0;
    const newVipViews = existingViews === 999999 ? 999999 : existingViews + viewsToGrant;

    // Update balance, VIP expiry & views
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newPermanentBalance, bonus_balance: newBonusBalance, vip_expires_at: newExpiry.toISOString(), vip_views_left: newVipViews })
      .eq("user_id", user.id);
    if (updateErr) throw new Error("Lỗi cập nhật: " + updateErr.message);

    // Record VIP purchase
    await supabaseAdmin.from("vip_purchases").insert({
      user_id: user.id,
      plan_id: plan.id,
      amount_paid: plan.price,
    });

    // Upgrade cookie slots for VIP (read from app_settings)
    const { data: slotSetting } = await supabaseAdmin.from("app_settings").select("value").eq("id", "vip_cookie_slots").single();
    const vipSlots = Number(slotSetting?.value ?? 5);
    await supabaseAdmin.rpc("assign_cookies_to_user", { target_user_id: user.id, desired_count: vipSlots });

    // Log transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: -plan.price,
      type: "vip_purchase",
      description: `Mua ${plan.name}`,
    });

    return new Response(JSON.stringify({
      success: true,
      vip_expires_at: newExpiry.toISOString(),
      plan_name: plan.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("purchase-vip error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
