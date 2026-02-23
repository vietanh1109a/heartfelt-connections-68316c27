import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";
import { ArrowLeft, ShoppingCart, Package, Gamepad2, Copy, Check, Shield, Zap, MessageCircle, Flame, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  note: string | null;
  category: string;
  price: number;
  original_price: number | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sold_count: number;
  stock_count?: number;
}

function fmtVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

function isHot(product: Product) {
  return product.sold_count >= 3;
}

export default function Products({ filterCategory, embedded }: { filterCategory?: string; embedded?: boolean }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { warrantyDays } = useAppSettings();
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

  const content = (
    <>
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
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onBuy={handleBuy}
        buying={buying}
        warrantyDays={warrantyDays}
      />

      {/* Purchase Result Modal */}
      <PurchaseResultModal
        result={purchaseResult}
        onClose={() => setPurchaseResult(null)}
        onCopy={handleCopy}
        copied={copied}
      />
    </>
  );

  if (embedded) {
    return content;
  }

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
      <main className="max-w-5xl mx-auto px-4 py-6">
        {content}
      </main>
    </div>
  );
}

/* ─── Product Card ─── */
function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const inStock = product.stock_count! > 0;
  const hasDiscount = product.original_price && product.original_price > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product.price / product.original_price!) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-border/40 bg-card/60 overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_8px_30px_hsl(var(--primary)/0.15)] hover:-translate-y-1"
    >
      {/* Image */}
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
        {/* Out of stock overlay */}
        {!inStock && (
          <div className="absolute inset-0 backdrop-blur-sm bg-black/70 flex items-center justify-center">
            <span className="text-destructive font-bold text-sm">Hết hàng</span>
          </div>
        )}
        {/* Badges row */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between pointer-events-none">
          <div className="flex flex-col gap-1">
            {isHot(product) && inStock && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-400 shadow-lg">
                <Flame className="h-3 w-3" /> HOT
              </span>
            )}
            {hasDiscount && inStock && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 shadow-lg">
                -{discountPct}%
              </span>
            )}
          </div>
          {inStock && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-green-300 bg-green-500/20 border border-green-500/30 backdrop-blur-sm">
              Còn {product.stock_count}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2">{product.name}</h3>

        {/* Benefits */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Zap className="h-2.5 w-2.5 text-amber-400" /> Giao ngay sau thanh toán</span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Shield className="h-2.5 w-2.5 text-blue-400" /> Bảo hành đổi nếu lỗi</span>
        </div>

        {/* Price hierarchy */}
        <div className="space-y-0.5 pt-1 border-t border-border/20">
          <span className="text-primary font-bold text-base block">{fmtVnd(product.price)}</span>
          {hasDiscount && (
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground line-through text-xs">{fmtVnd(product.original_price!)}</span>
              <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                Tiết kiệm {discountPct}%
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <Button
          size="sm"
          className="w-full gap-1.5 text-xs h-8 transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
          disabled={!inStock}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {inStock ? "Mua ngay" : "Hết hàng"}
        </Button>

        {/* Trust row */}
        <div className="flex items-center justify-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5"><Shield className="h-2.5 w-2.5" /> An toàn</span>
          <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> Tức thì</span>
          <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" /> 24/7</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Product Detail Modal ─── */
function ProductDetailModal({
  product,
  onClose,
  onBuy,
  buying,
  warrantyDays,
}: {
  product: Product | null;
  onClose: () => void;
  onBuy: (p: Product) => void;
  buying: boolean;
  warrantyDays: number;
}) {
  const inStock = product ? product.stock_count! > 0 : false;
  const hasDiscount = product?.original_price && product.original_price > product.price;
  const discountPct = hasDiscount ? Math.round((1 - product!.price / product!.original_price!) * 100) : 0;

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md border-border/30 rounded-[20px] overflow-hidden p-0"
        style={{
          background: "linear-gradient(145deg, hsl(0 0% 7%), hsl(0 0% 10%))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {product && (
          <div className="flex flex-col">
            {/* Header with image - compact 16:9 */}
            {product.thumbnail_url && (
              <div className="relative w-full aspect-[16/8] overflow-hidden bg-secondary/30">
                <img
                  src={product.thumbnail_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {isHot(product) && (
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r from-orange-500 to-amber-400 shadow-lg">
                    <Flame className="h-3 w-3" /> Bán chạy
                  </span>
                )}
              </div>
            )}

            {/* Content */}
            <div className="px-5 pt-4 pb-5 space-y-4">
              {/* Title */}
              <DialogHeader className="p-0">
                <DialogTitle className="text-lg font-bold text-foreground">{product.name}</DialogTitle>
              </DialogHeader>

              {/* Price block */}
              <div className="space-y-1">
                {hasDiscount && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">{fmtVnd(product.original_price!)}</span>
                    <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                      Tiết kiệm {discountPct}%
                    </span>
                  </div>
                )}
                <span className="text-2xl font-bold text-primary block">{fmtVnd(product.price)}</span>
              </div>

              {/* One-line summary */}
              <p className="text-xs text-muted-foreground">
                Giao tài khoản trong 1 phút • Bảo hành {warrantyDays} ngày • Hỗ trợ 24/7
              </p>

              {/* What you get */}
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5 border border-border/30">
                <p className="text-xs font-semibold text-foreground/90">Bạn sẽ nhận được:</p>
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <BadgeCheck className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  <span>Không share – dùng riêng 100%</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>Giao ngay sau thanh toán</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground/80">
                  <Shield className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span>Bảo hành đổi mới nếu lỗi trong {warrantyDays} ngày</span>
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-foreground/70 whitespace-pre-wrap">{product.description}</p>
              )}

              {/* Stock urgency + CTA */}
              <div className="space-y-2 pt-1">
                <div className="flex justify-center">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full ${
                      inStock
                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                        : "bg-destructive/10 text-destructive border border-destructive/20"
                    }`}
                  >
                    {inStock ? `⚡ Còn ${product.stock_count} sản phẩm – mua ngay!` : "Hết hàng"}
                  </span>
                </div>

                <Button
                  className="w-full gap-2 h-11 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                  disabled={buying || !inStock}
                  onClick={() => onBuy(product)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {buying
                    ? "Đang xử lý..."
                    : !inStock
                    ? "Hết hàng"
                    : `Mua ngay – ${fmtVnd(product.price)}`}
                </Button>
              </div>

              {/* Trust row */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> An toàn</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Tức thì</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> 24/7</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Purchase Result Modal ─── */
function PurchaseResultModal({
  result,
  onClose,
  onCopy,
  copied,
}: {
  result: { content: string; name: string } | null;
  onClose: () => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  return (
    <Dialog open={!!result} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md border-border/30 rounded-[20px]"
        style={{
          background: "linear-gradient(145deg, hsl(0 0% 7%), hsl(0 0% 10%))",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {result && (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground flex items-center gap-2">
                <Check className="h-5 w-5 text-green-400" />
                Mua thành công!
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Sản phẩm: <span className="text-foreground font-medium">{result.name}</span>
              </p>
              <div className="bg-secondary/50 rounded-xl p-4 border border-border/40">
                <p className="text-xs text-muted-foreground mb-2">Nội dung sản phẩm:</p>
                <p className="text-sm text-foreground font-mono break-all select-all">{result.content}</p>
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => onCopy(result.content)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Đã copy" : "Copy nội dung"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                💡 Bạn có thể xem lại nội dung trong <a href="/purchase-history" className="text-primary underline">Lịch sử mua hàng</a>.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
