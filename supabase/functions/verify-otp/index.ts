import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SIGNUP_BONUS = 5000;   // 10 lượt xem × 500đ
const REFERRAL_BONUS = 2500; // 5 lượt xem × 500đ
const BONUS_EXPIRY_DAYS = 7;

async function getAllowedOrigin(admin: any): Promise<string> {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("id", "allowed_origin").single();
    return data?.value || "*";
  } catch {
    return "*";
  }
}

/** Look up a user_id from auth.users by email via a SECURITY DEFINER DB function */
async function getUserIdByEmail(admin: any, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc("get_user_id_by_email", { lookup_email: email });
  if (error || !data) return null;
  return data as string;
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
    const { email, code, referralCode } = await req.json();
    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: "Email and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find valid OTP
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("code", code)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "Mã xác thực không đúng hoặc đã hết hạn." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as used
    await supabaseAdmin.from("otp_codes").update({ used: true }).eq("id", otpRecord.id);

    // Get user_id via SECURITY DEFINER function (avoids broken getUserByEmail)
    const userId = await getUserIdByEmail(supabaseAdmin, email);
    if (!userId) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get current profile to check if already verified
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_verified, balance")
      .eq("user_id", userId)
      .single();

    if (currentProfile?.is_verified) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grant signup bonus into bonus_balance with 7-day expiry
    const bonusExpiresAt = new Date(Date.now() + BONUS_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.rpc("increment_bonus_balance", {
      target_user_id: userId,
      delta: SIGNUP_BONUS,
      expires_at: bonusExpiresAt,
    });

    // Mark verified
    await supabaseAdmin
      .from("profiles")
      .update({ is_verified: true })
      .eq("user_id", userId);

    // Record signup bonus transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      amount: SIGNUP_BONUS,
      type: "deposit",
      memo: `🎁 Người mới - tặng 10 lượt xem (hết hạn 7 ngày)`,
    });

    // Handle referral bonus
    if (referralCode && referralCode.trim()) {
      const referralEmail = referralCode.trim().toLowerCase();
      if (referralEmail !== email.toLowerCase()) {
        const referrerId = await getUserIdByEmail(supabaseAdmin, referralEmail);

        if (referrerId) {
          const { data: referrerProfile } = await supabaseAdmin
            .from("profiles")
            .select("is_verified")
            .eq("user_id", referrerId)
            .single();

          if (referrerProfile?.is_verified) {
            const { data: existingReferral } = await supabaseAdmin
              .from("referral_logs")
              .select("id")
              .eq("referred_user_id", userId)
              .maybeSingle();

            if (!existingReferral) {
              await supabaseAdmin.rpc("increment_balance", {
                target_user_id: referrerId,
                delta: REFERRAL_BONUS,
              });

              await supabaseAdmin.from("transactions").insert({
                user_id: referrerId,
                amount: REFERRAL_BONUS,
                type: "deposit",
                memo: `🎉 Thưởng giới thiệu thành viên mới +5 lượt xem (${email})`,
              });

              await supabaseAdmin.rpc("increment_balance", {
                target_user_id: userId,
                delta: REFERRAL_BONUS,
              });

              await supabaseAdmin.from("transactions").insert({
                user_id: userId,
                amount: REFERRAL_BONUS,
                type: "deposit",
                memo: `🎉 Được mời bởi ${referralEmail} +5 lượt xem`,
              });

              await supabaseAdmin.from("referral_logs").insert({
                referrer_user_id: referrerId,
                referred_user_id: userId,
                bonus_amount: REFERRAL_BONUS,
              });

              return new Response(JSON.stringify({ success: true, referralBonus: true }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, referralBonus: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("verify-otp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
