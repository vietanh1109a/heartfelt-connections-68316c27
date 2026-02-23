import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowLeft, Package, Copy, Check, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function fmtVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

export default function PurchaseHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["purchase-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_purchases")
        .select("id, amount_paid, created_at, product_id, product_item_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch product names
      const productIds = [...new Set((data ?? []).map((p) => p.product_id))];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, thumbnail_url")
        .in("id", productIds);
      const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]));

      // Fetch item contents
      const itemIds = (data ?? []).map((p) => p.product_item_id);
      const { data: items } = await supabase
        .from("product_items")
        .select("id, content")
        .in("id", itemIds);
      const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i.content]));

      return (data ?? []).map((p) => ({
        ...p,
        product_name: productMap[p.product_id]?.name ?? "Sản phẩm",
        thumbnail_url: productMap[p.product_id]?.thumbnail_url,
        content: itemMap[p.product_item_id] ?? "",
      }));
    },
  });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Đã copy!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Lịch sử mua hàng</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Package className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Chưa có đơn hàng nào</p>
          </div>
        ) : (
          purchases.map((p) => {
            const isVisible = visibleId === p.id;
            const isCopied = copiedId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-border/40 bg-card/60 p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{p.product_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("vi-VN")} • {fmtVnd(p.amount_paid)}
                    </p>
                  </div>
                </div>

                <div className="bg-secondary/40 rounded-lg p-3 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Nội dung sản phẩm:</p>
                  <p className="text-sm font-mono break-all select-all text-foreground">
                    {isVisible ? p.content : "••••••••••••••••"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => setVisibleId(isVisible ? null : p.id)}
                  >
                    {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {isVisible ? "Ẩn" : "Hiện"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleCopy(p.id, p.content)}
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? "Đã copy" : "Copy"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
