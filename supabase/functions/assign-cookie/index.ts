import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    // Validate user
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

    // Check if user already has active cookie assignments
    const { data: existing } = await admin
      .from("user_cookie_assignment")
      .select("id, cookie_id, slot, cookie_stock!inner(id, is_active, cookie_data)")
      .eq("user_id", userId);

    const activeAssignments = (existing ?? []).filter(
      (a: any) => a.cookie_stock?.is_active
    );

    if (activeAssignments.length > 0) {
      // Only return the first active cookie (limit 1)
      const first = activeAssignments[0];
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Already has active cookie", 
        count: 1,
        assignments: [{
          id: first.id,
          cookie_id: first.cookie_id,
          slot: first.slot,
          is_active: (first as any).cookie_stock?.is_active,
          cookie_data: (first as any).cookie_stock?.cookie_data,
        }],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find an unassigned active cookie
    const { data: availableCookie, error: findErr } = await admin
      .from("cookie_stock")
      .select("id")
      .eq("is_active", true)
      .not("id", "in", `(${await getAssignedCookieIds(admin)})`)
      .limit(1)
      .maybeSingle();

    if (findErr) {
      console.error("Error finding available cookie:", findErr);
      return new Response(JSON.stringify({ error: "Lỗi tìm tài khoản khả dụng" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!availableCookie) {
      return new Response(JSON.stringify({ error: "Kho tài khoản đã hết. Vui lòng liên hệ hỗ trợ." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign cookie to user
    const { data: inserted, error: assignErr } = await admin
      .from("user_cookie_assignment")
      .insert({ user_id: userId, cookie_id: availableCookie.id, slot: 1 })
      .select("id, cookie_id, slot")
      .single();

    if (assignErr) {
      console.error("Error assigning cookie:", assignErr);
      return new Response(JSON.stringify({ error: "Lỗi gán tài khoản: " + assignErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch cookie data for the newly assigned cookie
    const { data: cookieInfo } = await admin
      .from("cookie_stock")
      .select("id, is_active, cookie_data")
      .eq("id", availableCookie.id)
      .single();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Cookie assigned",
      assignments: [{
        id: inserted.id,
        cookie_id: inserted.cookie_id,
        slot: inserted.slot,
        is_active: cookieInfo?.is_active,
        cookie_data: cookieInfo?.cookie_data,
      }],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("assign-cookie error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getAssignedCookieIds(admin: any): Promise<string> {
  const { data } = await admin
    .from("user_cookie_assignment")
    .select("cookie_id");
  if (!data || data.length === 0) return "'00000000-0000-0000-0000-000000000000'";
  return data.map((r: any) => `'${r.cookie_id}'`).join(",");
}
