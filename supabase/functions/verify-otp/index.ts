import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FREE_BONUS_VIEWS = 10;   // lượt xem miễn phí tặng khi đăng ký
const FREE_BONUS_DAYS = 7;     // số ngày hết hạn bonus
const REFERRAL_BONUS_VIEWS = 5; // 5 lượt xem cho cả hai bên khi giới thiệu
const MAX_REFERRALS_PER_MONTH = 2; // tối đa 2 lần nhập mã mời/tháng

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

    // Confirm the user's email in Auth so they can sign in
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (confirmError) {
      console.error("Error confirming email:", confirmError);
    }

    // Get current profile to check if already verified
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_verified, balance, bonus_balance")
      .eq("user_id", userId)
      .single();

    if (currentProfile?.is_verified) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cấp lượt xem miễn phí + đánh dấu đã xác thực
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        free_views_left: FREE_BONUS_VIEWS,
        is_verified: true,
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
    }

    // Cấp 1 cookie từ kho active cho người dùng mới
    try {
      await supabaseAdmin.rpc("assign_cookies_to_user", {
        target_user_id: userId,
        desired_count: 1,
      });
      console.log("[verify-otp] Assigned cookies to new user:", userId);
    } catch (cookieErr) {
      console.error("[verify-otp] Failed to assign cookies:", cookieErr);
      // Không fail toàn bộ request nếu không có cookie
    }

    // Handle referral bonus
    if (referralCode && referralCode.trim()) {
      const referralEmail = referralCode.trim().toLowerCase();
      if (referralEmail !== email.toLowerCase()) {
        const referrerId = await getUserIdByEmail(supabaseAdmin, referralEmail);

        if (referrerId) {
          const { data: referrerProfile } = await supabaseAdmin
            .from("profiles")
            .select("is_verified, free_views_left")
            .eq("user_id", referrerId)
            .single();

          if (referrerProfile?.is_verified) {
            // Check if this user has already been referred (referred_user_id must be unique)
            const { data: existingReferral } = await supabaseAdmin
              .from("referral_logs")
              .select("id")
              .eq("referred_user_id", userId)
              .maybeSingle();

            if (!existingReferral) {
              // Check referral count for THIS MONTH for the referrer (giới hạn 2 lần/tháng)
              const startOfMonth = new Date();
              startOfMonth.setDate(1);
              startOfMonth.setHours(0, 0, 0, 0);

              const { data: monthlyReferrals } = await supabaseAdmin
                .from("referral_logs")
                .select("id")
                .eq("referrer_user_id", referrerId)
                .gte("created_at", startOfMonth.toISOString());

              const monthlyCount = (monthlyReferrals ?? []).length;

              if (monthlyCount >= MAX_REFERRALS_PER_MONTH) {
                console.log(`[verify-otp] Referrer ${referrerId} reached monthly limit (${monthlyCount}/${MAX_REFERRALS_PER_MONTH})`);
                return new Response(JSON.stringify({ success: true, referralBonus: false, referralLimitReached: true }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }

              // Cộng lượt xem cho REFERRER (+5 lượt)
              const referrerCurrentViews = referrerProfile.free_views_left ?? 0;
              await supabaseAdmin
                .from("profiles")
                .update({ free_views_left: referrerCurrentViews + REFERRAL_BONUS_VIEWS })
                .eq("user_id", referrerId);

              await supabaseAdmin.from("transactions").insert({
                user_id: referrerId,
                amount: 0,
                type: "bonus",
                description: `🎉 Thưởng giới thiệu thành viên mới +${REFERRAL_BONUS_VIEWS} lượt xem (${email})`,
              });

              // Cộng thêm lượt xem cho NGƯỜI MỚI (+5 lượt, tổng 15)
              await supabaseAdmin
                .from("profiles")
                .update({ free_views_left: FREE_BONUS_VIEWS + REFERRAL_BONUS_VIEWS })
                .eq("user_id", userId);

              await supabaseAdmin.from("transactions").insert({
                user_id: userId,
                amount: 0,
                type: "bonus",
                description: `🎉 Được mời bởi ${referralEmail} +${REFERRAL_BONUS_VIEWS} lượt xem`,
              });

              await supabaseAdmin.from("referral_logs").insert({
                referrer_user_id: referrerId,
                referred_user_id: userId,
                bonus_amount: REFERRAL_BONUS_VIEWS,
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
      JSON.stringify({ error: (error as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
