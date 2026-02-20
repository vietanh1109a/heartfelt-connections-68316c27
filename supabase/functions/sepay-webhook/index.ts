import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SePay webhook payload shape
interface SePayPayload {
  id: number;               // Transaction ID on SePay
  gateway: string;          // Bank brand name
  transactionDate: string;  // Transaction time
  accountNumber: string;    // Bank account number
  code: string | null;      // Payment code detected by SePay
  content: string;          // Transfer description (contains deposit_code)
  transferType: string;     // "in" or "out"
  transferAmount: number;   // Amount in VND
  accumulated: number;
  subAccount: string | null;
  referenceCode: string;
  description: string;
}

function parseDepositCode(content: string): string | null {
  // Match NAP followed by 6 alphanumeric chars, with or without dash
  const upper = content.toUpperCase();
  const match = upper.match(/NAP-?([A-Z0-9]{6})/);
  if (!match) return null;
  // Always return without dash (canonical format)
  return `NAP${match[1]}`;
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
    // Verify webhook token: SePay sends "Authorization: Apikey <token>"
    const authHeader = req.headers.get("Authorization") ?? "";
    const webhookToken = Deno.env.get("SEPAY_WEBHOOK_TOKEN") ?? "";

    const isBearer = authHeader === `Bearer ${webhookToken}`;
    const isApikey = authHeader === `Apikey ${webhookToken}`;

    if (!webhookToken || (!isBearer && !isApikey)) {
      console.warn("Webhook auth failed:", authHeader);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: SePayPayload = await req.json();
    console.log("SePay webhook received:", JSON.stringify(payload));

    // Only process incoming transfers
    if (payload.transferType !== "in") {
      return new Response(JSON.stringify({ success: true, message: "Skipped: not an incoming transfer" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency: check if this event was already processed
    const eventId = `sepay-${payload.id}`;
    const { error: dupError } = await supabase
      .from("webhook_events")
      .insert({
        provider: "sepay",
        event_id: eventId,
        payload,
      });

    if (dupError) {
      // Unique constraint violation = already processed
      if (dupError.code === "23505") {
        console.log("Duplicate webhook event, skipping:", eventId);
        return new Response(JSON.stringify({ success: true, message: "Already processed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw dupError;
    }

    // Parse deposit_code from transfer content
    const depositCode = parseDepositCode(payload.content ?? "");
    if (!depositCode) {
      console.log("No deposit_code found in content:", payload.content);
      return new Response(JSON.stringify({ success: true, message: "No deposit code in content" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching pending deposit
    const { data: deposit, error: findError } = await supabase
      .from("deposits")
      .select("*")
      .eq("deposit_code", depositCode)
      .eq("status", "pending")
      .single();

    if (findError || !deposit) {
      console.log("No matching pending deposit for code:", depositCode);
      return new Response(JSON.stringify({ success: true, message: "No matching deposit" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check amount >= deposit.amount
    if (payload.transferAmount < deposit.amount) {
      console.log(`Amount mismatch: received ${payload.transferAmount}, expected ${deposit.amount}`);
      return new Response(JSON.stringify({ success: true, message: "Amount too low" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check not expired
    if (new Date(deposit.expires_at) < new Date()) {
      await supabase
        .from("deposits")
        .update({ status: "expired" })
        .eq("id", deposit.id);
      return new Response(JSON.stringify({ success: true, message: "Deposit expired" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atomic: update deposit → paid
    const { error: updateDepositError } = await supabase
      .from("deposits")
      .update({
        status: "paid",
        sepay_tx_id: String(payload.id),
        paid_at: new Date().toISOString(),
      })
      .eq("id", deposit.id)
      .eq("status", "pending"); // extra guard

    if (updateDepositError) {
      throw updateDepositError;
    }

    // Credit balance using RPC (security definer function)
    const { error: balanceError } = await supabase.rpc("credit_user_balance", {
      p_user_id: deposit.user_id,
      p_amount: deposit.amount,
    });

    if (balanceError) {
      // Fallback: direct upsert on profiles.balance
      console.warn("RPC credit_user_balance failed, using fallback:", balanceError.message);
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", deposit.user_id)
        .single();

      const newBalance = (profile?.balance ?? 0) + deposit.amount;
      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", deposit.user_id);
    }

    // Insert into transactions ledger
    await supabase.from("transactions").insert({
      user_id: deposit.user_id,
      type: "deposit",
      amount: deposit.amount,
      memo: `SePay ${depositCode} - TX#${payload.id}`,
    });

    console.log(`✅ Deposit ${depositCode} paid: +${deposit.amount}đ for user ${deposit.user_id}`);

    return new Response(JSON.stringify({ success: true, message: "Payment processed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sepay-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
