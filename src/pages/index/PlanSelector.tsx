import { useState, memo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { CheckCircle2, Crown } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const features = [
  "Tài khoản Netflix chính chủ",
  "Đầy đủ tính năng Premium",
  "Hỗ trợ nhiều profile",
  "Ưu tiên hỗ trợ 24/7",
];

const PlanSelector = memo(() => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);
  const [purchasedAccount, setPurchasedAccount] = useState<{
    email: string; password: string; expires_at: string; plan_name: string;
  } | null>(null);

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["netflix-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netflix_plans")
        .select("*")
        .eq("is_active", true)
        .order("duration_months", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: stockByPlan } = useQuery({
    queryKey: ["netflix-stock-by-plan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netflix_accounts")
        .select("plan_id")
        .eq("is_assigned", false);
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: { plan_id: string }) => {
        counts[row.plan_id] = (counts[row.plan_id] ?? 0) + 1;
      });
      return counts;
    },
    staleTime: 30000,
  });

  const getStockForPlan = (planId: string) => stockByPlan?.[planId] ?? 0;

  const handlePurchase = async (plan: { id: string; price: number; name: string }) => {
    if (!user || !profile) return;
    const effectiveBalance = (profile as any).effective_balance ?? ((profile.balance ?? 0) + (profile.bonus_balance ?? 0));
    if (effectiveBalance < plan.price) {
      toast.error(`Số dư không đủ. Cần ${plan.price.toLocaleString("vi-VN")}đ, bạn có ${effectiveBalance.toLocaleString("vi-VN")}đ.`);
      navigate("/deposit");
      return;
    }
    setPurchasing(plan.id);
    try {
      // Direct fetch to bypass ES256 gateway bug (supabase.functions.invoke returns 401)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      let res: Response;
      try {
        res = await fetch(`https://${projectId}.supabase.co/functions/v1/purchase-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ plan_id: plan.id }),
        });
      } catch {
        toast.error("Lỗi kết nối. Vui lòng thử lại.");
        return;
      }
      let data: any = {};
      try { data = await res.json(); } catch {}
      if (!res.ok || data?.error) { toast.error(data?.error || `Lỗi ${res.status}. Vui lòng thử lại.`); return; }
      setPurchasedAccount({ ...data.account, plan_name: data.plan_name });
      setShowPlans(false);
      toast.success(`Đã mua ${data.plan_name} thành công!`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["netflix-stock-by-plan"] });
    } finally {
      setPurchasing(null);
    }
  };

  // Popular = middle plan
  const popularIndex = plans
    ? plans.length >= 3 ? Math.floor(plans.length / 2) : plans.length === 2 ? 1 : 0
    : -1;

  // Base monthly price for savings calc
  const baseMonthlyPrice = plans && plans.length > 0
    ? plans[0].price / plans[0].duration_months
    : 0;

  return (
    <>
      <button
        onClick={() => setShowPlans(true)}
        className="w-full rounded-lg py-3.5 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
        style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
      >
        Chọn gói dịch vụ
      </button>

      {showPlans && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPlans(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-3xl"
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/40 rounded-full px-4 py-1.5 mb-4">
                <Crown className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-400 font-bold text-sm tracking-wide">TÀI KHOẢN NETFLIX</span>
              </div>
              <h2 className="text-3xl font-bold text-foreground">Chọn gói Netflix</h2>
              <p className="text-muted-foreground text-sm mt-2">Tài khoản chính chủ · Giao ngay sau khi mua</p>
            </div>

            {/* Plans grid — 4 vertical cards */}
            <div className={`grid gap-4 ${!plans || plans.length <= 2 ? "grid-cols-2" : plans.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
              {plansLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 rounded-2xl" />
                ))
              ) : plans?.map((plan, i) => {
                const isPopular = i === popularIndex && (plans?.length ?? 0) > 1;
                const planStock = getStockForPlan(plan.id);
                const planOutOfStock = planStock === 0;
                const monthlyPrice = plan.price / plan.duration_months;
                const savingsPercent = baseMonthlyPrice > 0 && plan.duration_months > 1
                  ? Math.round((1 - monthlyPrice / baseMonthlyPrice) * 100)
                  : 0;

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`relative flex flex-col rounded-2xl border transition-all duration-200 ${
                      planOutOfStock
                        ? "border-yellow-500/10 opacity-50"
                        : isPopular
                          ? "border-yellow-400/70 scale-[1.06] shadow-[0_0_40px_rgba(234,179,8,0.2)] z-10"
                          : "border-yellow-500/20 hover:border-yellow-500/40"
                    }`}
                    style={{
                      background: planOutOfStock
                        ? "rgba(15,15,15,0.6)"
                        : isPopular
                          ? "linear-gradient(145deg, rgba(234,179,8,0.12), rgba(15,15,15,0.95))"
                          : "linear-gradient(145deg, rgba(234,179,8,0.05), rgba(15,15,15,0.9))",
                    }}
                  >
                    {/* Popular badge */}
                    {isPopular && !planOutOfStock && (
                      <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                        <span className="bg-yellow-400 text-black text-[11px] font-extrabold px-4 py-1 rounded-full tracking-wider shadow-lg">
                          ⭐ PHỔ BIẾN NHẤT
                        </span>
                      </div>
                    )}

                    <div className={`p-5 flex flex-col flex-1 ${isPopular && !planOutOfStock ? "pt-7" : ""}`}>
                      {/* Savings badge */}
                      {savingsPercent > 0 && (
                        <div className="self-start mb-2">
                          <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-green-500/30">
                            Tiết kiệm {savingsPercent}%
                          </span>
                        </div>
                      )}

                      {/* Stock */}
                      <div className="mb-2">
                        {planOutOfStock ? (
                          <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">Hết hàng</span>
                        ) : (
                          <span className="text-muted-foreground/60 text-[10px]">Còn {planStock} tài khoản</span>
                        )}
                      </div>

                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">
                        {plan.duration_months} tháng
                      </p>
                      <h3 className="text-foreground font-bold text-base mb-3">{plan.name}</h3>

                      {/* Price */}
                      <div className="mb-1">
                        <span className="text-yellow-400 font-extrabold text-3xl leading-none">
                          {plan.price.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      {plan.duration_months > 1 && (
                        <p className="text-muted-foreground text-xs mb-4">
                          ~{Math.round(monthlyPrice).toLocaleString("vi-VN")}đ/tháng
                        </p>
                      )}
                      {plan.duration_months <= 1 && <div className="mb-4" />}

                      {/* Features */}
                      <div className="space-y-1.5 mb-5 flex-1">
                        {features.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                            {f}
                          </div>
                        ))}
                      </div>

                      {/* CTA */}
                      <button
                        onClick={() => handlePurchase(plan)}
                        disabled={purchasing === plan.id || planOutOfStock}
                        className={`w-full mt-auto rounded-xl py-3 font-bold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                          planOutOfStock
                            ? "border border-border/20 text-muted-foreground"
                            : isPopular
                              ? "bg-yellow-400 text-black hover:bg-yellow-300 shadow-[0_4px_20px_rgba(234,179,8,0.4)] hover:shadow-[0_4px_28px_rgba(234,179,8,0.6)] active:scale-[0.97]"
                              : "border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/15 hover:border-yellow-400/60 active:scale-[0.97]"
                        }`}
                      >
                        {planOutOfStock ? "Hết hàng" : purchasing === plan.id ? "Đang xử lý..." : isPopular ? "🚀 Mua ngay" : "Mua ngay"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="text-center mt-6">
              <button onClick={() => setShowPlans(false)} className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors px-4 py-2">
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Success dialog */}
      <Dialog open={!!purchasedAccount} onOpenChange={() => setPurchasedAccount(null)}>
        <DialogContent className="max-w-sm bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-yellow-400" /> Mua gói thành công!
            </DialogTitle>
          </DialogHeader>
          {purchasedAccount && (
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Tài khoản Netflix <strong className="text-foreground">{purchasedAccount.plan_name}</strong> của bạn:
              </p>
              <div className="bg-secondary/40 rounded-lg p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="text-foreground">{purchasedAccount.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mật khẩu:</span>
                  <span className="text-foreground">{purchasedAccount.password}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hết hạn:</span>
                  <span className="text-foreground">{new Date(purchasedAccount.expires_at).toLocaleDateString("vi-VN")}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">⚠️ Hãy lưu lại thông tin này.</p>
              <Button onClick={() => setPurchasedAccount(null)} className="w-full">Đã hiểu</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});

PlanSelector.displayName = "PlanSelector";
export default PlanSelector;
