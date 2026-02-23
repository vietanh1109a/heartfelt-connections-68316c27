import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Package, Gamepad2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Product {
  id: string;
  name: string;
  description: string | null;
  note: string | null;
  category: string;
  price: number;
  thumbnail_url: string | null;
  is_active: boolean;
  sold_count: number;
  stock_count?: number;
}

function fmtVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

export default function Products({ filterCategory }: { filterCategory?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buying, setBuying] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ content: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", filterCategory],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (filterCategory) {
        query = query.eq("category", filterCategory);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get stock counts
      const productIds = (data ?? []).map((p: any) => p.id);
      if (productIds.length > 0) {
        const { data: stockData } = await supabase
          .from("product_items")
          .select("product_id")
          .in("product_id", productIds)
          .eq("is_sold", false);

        const stockMap: Record<string, number> = {};
        (stockData ?? []).forEach((s: any) => {
          stockMap[s.product_id] = (stockMap[s.product_id] || 0) + 1;
        });

        return (data ?? []).map((p: any) => ({
          ...p,
          stock_count: stockMap[p.id] || 0,
        }));
      }

      return (data ?? []).map((p: any) => ({ ...p, stock_count: 0 }));
    },
  });

  const handleBuy = async (product: Product) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-product", {
        body: { product_id: product.id },
      });
      if (error || data?.error) {
        toast.error(data?.error || "Lỗi mua sản phẩm");
        return;
      }
      setPurchaseResult({ content: data.content, name: data.product_name });
      setSelectedProduct(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`✅ Mua thành công! Trừ ${fmtVnd(data.amount_paid)}`);
    } finally {
      setBuying(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Đã copy!");
    setTimeout(() => setCopied(false), 2000);
  };

  const isGameKeys = filterCategory === "game_key";
  const title = isGameKeys ? "Key Game" : "Sản phẩm";
  const icon = isGameKeys ? <Gamepad2 className="h-5 w-5 text-primary" /> : <Package className="h-5 w-5 text-primary" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          {icon}
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>
      </header>

      {!filterCategory && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <Tabs defaultValue="all" onValueChange={(v) => {
            if (v === "game_key") navigate("/game-keys");
          }}>
            <TabsList>
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              <TabsTrigger value="game_key">Key Game</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Package className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Chưa có sản phẩm nào</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {products.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group cursor-pointer rounded-xl border border-border/40 bg-card/60 overflow-hidden hover:border-primary/30 hover:bg-card/80 transition-all"
              >
                <div className="aspect-square bg-secondary/30 relative overflow-hidden">
                  {product.thumbnail_url ? (
                    <img
                      src={product.thumbnail_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  {product.stock_count === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-destructive font-bold text-sm">Hết hàng</span>
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2">{product.name}</h3>
                  {product.note && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{product.note}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-primary font-bold text-sm">{fmtVnd(product.price)}</span>
                    <span className={`text-xs ${product.stock_count! > 0 ? "text-green-400" : "text-destructive"}`}>
                      {product.stock_count! > 0 ? `Còn ${product.stock_count}` : "Hết hàng"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-md bg-card border-border/40">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">{selectedProduct.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedProduct.thumbnail_url && (
                  <div className="rounded-lg overflow-hidden aspect-video bg-secondary/30">
                    <img
                      src={selectedProduct.thumbnail_url}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">{fmtVnd(selectedProduct.price)}</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${selectedProduct.stock_count! > 0 ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                    {selectedProduct.stock_count! > 0 ? `Còn ${selectedProduct.stock_count} sản phẩm` : "Hết hàng"}
                  </span>
                </div>
                {selectedProduct.note && (
                  <p className="text-sm text-muted-foreground">{selectedProduct.note}</p>
                )}
                {selectedProduct.description && (
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap border-t border-border/20 pt-3">
                    {selectedProduct.description}
                  </div>
                )}
                <Button
                  className="w-full gap-2"
                  disabled={buying || selectedProduct.stock_count === 0}
                  onClick={() => handleBuy(selectedProduct)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {buying ? "Đang xử lý..." : selectedProduct.stock_count === 0 ? "Hết hàng" : `Mua ngay - ${fmtVnd(selectedProduct.price)}`}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Purchase Result Modal */}
      <Dialog open={!!purchaseResult} onOpenChange={() => setPurchaseResult(null)}>
        <DialogContent className="max-w-md bg-card border-border/40">
          {purchaseResult && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-400" />
                  Mua thành công!
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Sản phẩm: <span className="text-foreground font-medium">{purchaseResult.name}</span></p>
                <div className="bg-secondary/50 rounded-lg p-4 border border-border/40">
                  <p className="text-xs text-muted-foreground mb-2">Nội dung sản phẩm:</p>
                  <p className="text-sm text-foreground font-mono break-all select-all">{purchaseResult.content}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => handleCopy(purchaseResult.content)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Đã copy" : "Copy nội dung"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  ⚠️ Lưu lại nội dung này, bạn sẽ không thể xem lại sau khi đóng.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
