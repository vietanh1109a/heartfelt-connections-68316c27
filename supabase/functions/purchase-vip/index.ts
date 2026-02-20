import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const { vip_plan_id } = await req.json();
    if (!vip_plan_id) throw new Error("Missing vip_plan_id");

    // Get VIP plan
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("vip_plans").select("*").eq("id", vip_plan_id).eq("is_active", true).single();
    if (planErr || !plan) throw new Error("Gói VIP không tồn tại hoặc đã ngừng bán");

    // FIX: Expire bonus if needed before checking balance
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
      return new Response(JSON.stringify({ error: `Số dư không đủ. Cần $${plan.price}, bạn có $${effectiveBalance}.` }), {
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
    if (remainingDeduct > 0) {
      newPermanentBalance -= remainingDeduct;
    }

    // Calculate VIP expiry (extend if already VIP)
    const now = new Date();
    const currentExpiry = profile.vip_expires_at ? new Date(profile.vip_expires_at) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

    // Update balance & VIP expiry
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({ balance: newPermanentBalance, bonus_balance: newBonusBalance, vip_expires_at: newExpiry.toISOString() })
      .eq("user_id", user.id);
    if (updateErr) throw new Error("Lỗi cập nhật");

    // Record VIP purchase
    await supabaseAdmin.from("vip_purchases").insert({
      user_id: user.id,
      vip_plan_id: plan.id,
      amount_paid: plan.price,
      vip_expires_at: newExpiry.toISOString(),
    });

    // Upgrade cookie count to 5 for VIP
    await supabaseAdmin.rpc("assign_cookies_to_user", {
      target_user_id: user.id,
      desired_count: 5,
    });

    // Log transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: plan.price,
      type: "usage",
      memo: `Mua ${plan.name}`,
    });

    return new Response(JSON.stringify({
      success: true,
      vip_expires_at: newExpiry.toISOString(),
      plan_name: plan.name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
