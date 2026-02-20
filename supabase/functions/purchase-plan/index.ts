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
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const allowedOrigin = await getAllowedOrigin(admin);
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");

    const { plan_id } = await req.json();
    if (!plan_id) throw new Error("Missing plan_id");

    // Get plan
    const { data: plan, error: planErr } = await admin
      .from("netflix_plans").select("*").eq("id", plan_id).eq("is_active", true).single();
    if (planErr || !plan) throw new Error("Gói không tồn tại hoặc đã ngừng bán");

    // FIX: Expire bonus if needed before checking balance
    await admin.rpc("expire_bonus_if_needed", { target_user_id: user.id });

    // Get user profile with bonus balance
    const { data: profile, error: profErr } = await admin
      .from("profiles").select("balance, bonus_balance, bonus_expires_at").eq("user_id", user.id).single();
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

    // Find available account — must match the plan_id
    const { data: account } = await admin
      .from("netflix_accounts")
      .select("*")
      .eq("is_assigned", false)
      .eq("plan_id", plan_id)
      .limit(1)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: `Hiện tại đã hết tài khoản Netflix cho gói "${plan.name}". Vui lòng thử lại sau hoặc chọn gói khác.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FIX: Use atomic RPC to deduct balance — prevents race condition
    // Deduct bonus first (if active), then permanent balance
    let remainingDeduct = plan.price;
    let newBonusBalance = bonusBalance;
    let newPermanentDelta = 0;

    if (bonusBalance > 0 && bonusActive) {
      const fromBonus = Math.min(bonusBalance, remainingDeduct);
      newBonusBalance -= fromBonus;
      remainingDeduct -= fromBonus;
    }
    if (remainingDeduct > 0) {
      newPermanentDelta = -remainingDeduct;
    }

    // Atomic permanent balance deduction via RPC
    if (newPermanentDelta < 0) {
      const { error: rpcErr } = await admin.rpc("admin_adjust_balance", {
        target_user_id: user.id,
        delta: newPermanentDelta,
      });
      if (rpcErr) throw new Error("Lỗi trừ tiền: " + rpcErr.message);
    }
    // Update bonus balance if changed
    if (newBonusBalance !== bonusBalance) {
      const { error: balErr } = await admin
        .from("profiles")
        .update({ bonus_balance: newBonusBalance })
        .eq("user_id", user.id);
      if (balErr) throw new Error("Lỗi trừ bonus");
    }

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.duration_months);

    // Assign account
    const { error: accErr } = await admin
      .from("netflix_accounts")
      .update({
        is_assigned: true,
        assigned_to: user.id,
        assigned_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", account.id);
    if (accErr) throw new Error("Lỗi gán tài khoản");

    // Create purchase record
    const { error: purErr } = await admin
      .from("plan_purchases")
      .insert({
        user_id: user.id,
        plan_id: plan.id,
        amount_paid: plan.price,
        status: "assigned",
        account_id: account.id,
      });
    if (purErr) throw new Error("Lỗi tạo đơn hàng");

    // Log transaction
    await admin.from("transactions").insert({
      user_id: user.id,
      amount: plan.price,
      type: "usage",
      memo: `Mua gói ${plan.name}`,
    });

    return new Response(JSON.stringify({
      success: true,
      account: { email: account.email, password: account.password, expires_at: expiresAt.toISOString() },
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
