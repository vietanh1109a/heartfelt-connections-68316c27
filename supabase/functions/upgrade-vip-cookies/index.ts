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

    // Check VIP status
    const { data: profile } = await admin.from("profiles").select("vip_expires_at").eq("user_id", user.id).single();
    const isVip = profile?.vip_expires_at && new Date(profile.vip_expires_at) > new Date();
    const desiredCount = isVip ? 5 : 2;

    // Call the DB function to assign cookies up to desiredCount
    const { error } = await admin.rpc("assign_cookies_to_user", {
      target_user_id: user.id,
      desired_count: desiredCount,
    });

    if (error) throw new Error("Lỗi gán cookie: " + error.message);

    return new Response(JSON.stringify({ success: true, assigned_count: desiredCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
