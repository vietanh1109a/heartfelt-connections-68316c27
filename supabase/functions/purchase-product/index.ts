import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { product_id } = await req.json();
    if (!product_id) {
      return new Response(JSON.stringify({ error: "Missing product_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for all DB operations
    const admin = createClient(supabaseUrl, serviceKey);

    // Get product
    const { data: product, error: productErr } = await admin
      .from("products")
      .select("*")
      .eq("id", product_id)
      .eq("is_active", true)
      .single();

    if (productErr || !product) {
      return new Response(JSON.stringify({ error: "Sản phẩm không tồn tại hoặc đã ngừng bán" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile balance
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("balance, bonus_balance, bonus_expires_at")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Không tìm thấy profile" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bonusActive = profile.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();
    const effectiveBalance = profile.balance + (bonusActive ? profile.bonus_balance : 0);

    if (effectiveBalance < product.price) {
      return new Response(JSON.stringify({ error: `Số dư không đủ. Cần ${product.price.toLocaleString()}đ, hiện có ${effectiveBalance.toLocaleString()}đ` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find an available stock item
    const { data: item, error: itemErr } = await admin
      .from("product_items")
      .select("*")
      .eq("product_id", product_id)
      .eq("is_sold", false)
      .limit(1)
      .single();

    if (itemErr || !item) {
      return new Response(JSON.stringify({ error: "Sản phẩm đã hết hàng" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark item as sold
    const { error: updateItemErr } = await admin
      .from("product_items")
      .update({ is_sold: true, sold_to: user.id, sold_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("is_sold", false); // optimistic lock

    if (updateItemErr) {
      return new Response(JSON.stringify({ error: "Lỗi xử lý đơn hàng" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct balance (bonus first, then permanent)
    let remaining = product.price;
    if (bonusActive && profile.bonus_balance > 0) {
      const fromBonus = Math.min(profile.bonus_balance, remaining);
      await admin.from("profiles").update({ bonus_balance: profile.bonus_balance - fromBonus }).eq("user_id", user.id);
      remaining -= fromBonus;
    }
    if (remaining > 0) {
      await admin.from("profiles").update({ balance: profile.balance - remaining }).eq("user_id", user.id);
    }

    // Increment sold_count
    await admin.from("products").update({ sold_count: (product.sold_count || 0) + 1 }).eq("id", product_id);

    // Create purchase record
    await admin.from("product_purchases").insert({
      user_id: user.id,
      product_id: product_id,
      product_item_id: item.id,
      amount_paid: product.price,
    });

    // Create transaction record
    await admin.from("transactions").insert({
      user_id: user.id,
      amount: -product.price,
      type: "usage",
      memo: `Mua sản phẩm: ${product.name}`,
    });

    return new Response(JSON.stringify({
      success: true,
      product_name: product.name,
      content: item.content,
      amount_paid: product.price,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
