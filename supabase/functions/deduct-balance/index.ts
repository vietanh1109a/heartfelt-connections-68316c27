import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to get allowed origin from app_settings
async function getAllowedOrigin(admin: any): Promise<string> {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("id", "allowed_origin").single();
    return data?.value || "*";
  } catch {
    return "*";
  }
}

function buildCorsHeaders(allowedOrigin: string) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const allowedOrigin = await getAllowedOrigin(admin);
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate JWT
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

    const { amount, memo } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid amount");

    // FIX: Expire bonus balance if needed (server-enforced)
    await admin.rpc("expire_bonus_if_needed", { target_user_id: userId });

    // Fetch current balances server-side
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("balance, bonus_balance, bonus_expires_at")
      .eq("user_id", userId)
      .single();

    if (profErr || !profile) throw new Error("Profile not found");

    // Compute effective spendable balance
    const bonusActive = profile.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();
    const bonusBalance = bonusActive ? (profile.bonus_balance ?? 0) : 0;
    const permanentBalance = profile.balance ?? 0;
    const effectiveBalance = permanentBalance + bonusBalance;

    if (effectiveBalance < amount) {
      return new Response(JSON.stringify({ error: `Số dư không đủ. Cần ${amount.toLocaleString("vi-VN")}đ, bạn có ${effectiveBalance.toLocaleString("vi-VN")}đ.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct from bonus first, then permanent
    let remainingDeduct = amount;
    let newBonusBalance = bonusBalance;
    let newPermanentBalance = permanentBalance;

    if (bonusBalance > 0 && bonusActive) {
      const fromBonus = Math.min(bonusBalance, remainingDeduct);
      newBonusBalance -= fromBonus;
      remainingDeduct -= fromBonus;
    }
    if (remainingDeduct > 0) {
      newPermanentBalance -= remainingDeduct;
    }

    // Optimistic lock: update with current values as condition
    const { data: updateData, error: updateErr } = await admin
      .from("profiles")
      .update({ balance: newPermanentBalance, bonus_balance: newBonusBalance })
      .eq("user_id", userId)
      .eq("balance", permanentBalance)
      .eq("bonus_balance", profile.bonus_balance ?? 0)
      .select("balance, bonus_balance");

    if (updateErr) throw new Error("Lỗi trừ tiền. Vui lòng thử lại.");

    if (!updateData || updateData.length === 0) {
      return new Response(JSON.stringify({ error: "Số dư đã thay đổi đồng thời. Vui lòng thử lại." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log transaction
    await admin.from("transactions").insert({
      user_id: userId,
      amount,
      type: "usage",
      memo: memo || "Sử dụng dịch vụ",
    });

    return new Response(JSON.stringify({ success: true, new_balance: newPermanentBalance + newBonusBalance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
