import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateDepositCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NAP";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !authData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.claims.sub;

    const body = await req.json();
    const amount = Number(body.amount);

    if (!amount || amount < 10000 || amount > 50000000) {
      return new Response(
        JSON.stringify({ error: "Số tiền không hợp lệ (tối thiểu 10,000đ)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to insert deposit
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Generate unique deposit_code (retry if collision)
    let depositCode = "";
    let attempts = 0;
    while (attempts < 5) {
      depositCode = generateDepositCode();
      const { data: existing } = await supabaseAdmin
        .from("deposits")
        .select("id")
        .eq("deposit_code", depositCode)
        .single();
      if (!existing) break;
      attempts++;
    }

    if (!depositCode) {
      throw new Error("Could not generate unique deposit code");
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: deposit, error: insertError } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: userId,
        amount,
        deposit_code: depositCode,
        status: "pending",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Read bank settings from app_settings
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("id, value");

    const settingsMap: Record<string, string> = {};
    (settings ?? []).forEach((s: any) => {
      settingsMap[s.id] = s.value;
    });

    const bankCode = settingsMap["bank_code"] ?? settingsMap["sepay_bank_name"] ?? "VPB";
    const accountNo = settingsMap["sepay_account_number"] ?? "";
    const accountName = settingsMap["account_name"] ?? "";

    // SePay QR: https://qr.sepay.vn/img?acc=STK&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG
    const qrUrl = `https://qr.sepay.vn/img?acc=${accountNo}&bank=${bankCode}&amount=${amount}&des=${encodeURIComponent(depositCode)}`;

    return new Response(
      JSON.stringify({
        deposit_id: deposit.id,
        deposit_code: depositCode,
        amount,
        expires_at: expiresAt,
        qr_url: qrUrl,
        bank_id: bankCode,
        account_no: accountNo,
        account_name: accountName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-deposit error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
