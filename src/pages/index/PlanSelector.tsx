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

const features = [
  "Tài khoản Netflix chính chủ",
  "Đầy đủ tính năng Premium",
  "Hỗ trợ nhiều profile",
  "Hỗ trợ 24/7",
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

  const { data: plans } = useQuery({
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
      const { data, error } = await supabase.rpc("get_netflix_stock_by_plan");
      if (error) return [];
      return data ?? [];
    },
  });

  const getStockForPlan = (planId: string) => {
    const entry = stockByPlan?.find((s: { plan_id: string; count: number }) => s.plan_id === planId);
    return entry?.count ?? 0;
  };

  const handlePurchase = async (plan: { id: string; price: number; name: string }) => {
    if (!user || !profile) return;
    const effectiveBalance = (profile.balance ?? 0) + (profile.bonus_balance ?? 0);
    if (effectiveBalance < plan.price) {
      toast.error(`Số dư không đủ. Cần ${plan.price.toLocaleString("vi-VN")}đ, bạn có ${effectiveBalance.toLocaleString("vi-VN")}đ.`);
      navigate("/deposit");
      return;
    }
    setPurchasing(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-plan", {
        body: { plan_id: plan.id },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      setPurchasedAccount({ ...data.account, plan_name: data.plan_name });
      setShowPlans(false);
      toast.success(`Đã mua ${data.plan_name} thành công!`, { duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["netflix-stock-by-plan"] });
    } catch {
      toast.error("Lỗi khi mua gói. Vui lòng thử lại.");
    } finally {
      setPurchasing(null);
    }
  };

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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPlans(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl"
          >
            <div className="text-center mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">Chọn gói Netflix</h2>
              <p className="text-muted-foreground text-sm mt-1">Chọn gói phù hợp với nhu cầu của bạn</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {plans?.map((plan, i) => {
                const baseMonthlyPrice = plans[0]?.price ?? plan.price;
                const monthlyPrice = plan.price / plan.duration_months;
                const savingsPercent = plan.duration_months > 1
                  ? Math.round((1 - monthlyPrice / baseMonthlyPrice) * 100)
                  : 0;
                const planStock = getStockForPlan(plan.id);
                const planOutOfStock = planStock === 0;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`relative rounded-xl border p-4 md:p-5 flex flex-col transition-all ${planOutOfStock ? "border-border/20 bg-card/40 opacity-60" : "border-border/40 bg-card/80 hover:border-border"}`}
                  >
                    <div className="absolute top-2 right-2">
                      {planOutOfStock ? (
                        <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">Hết hàng</span>
                      ) : (
                        <span className="bg-green-500/20 text-green-500 text-[10px] font-medium px-2 py-0.5 rounded-full">Còn {planStock}</span>
                      )}
                    </div>
                    <h3 className="text-foreground font-bold text-base md:text-lg">{plan.name}</h3>
                    {plan.description && <p className="text-muted-foreground text-[11px] mt-1 leading-snug">{plan.description}</p>}
                    <div className="mt-3 mb-1">
                      <span className="text-primary font-extrabold text-2xl md:text-3xl">{plan.price.toLocaleString("vi-VN")}đ</span>
                      <span className="text-muted-foreground text-xs ml-1">/{plan.duration_months} tháng</span>
                    </div>
                    {savingsPercent > 0 ? (
                      <span className="text-green-500 text-xs font-semibold mb-3">Tiết kiệm {savingsPercent}%</span>
                    ) : <div className="mb-3" />}
                    <div className="space-y-2 mb-4 flex-1">
                      {features.map((f, fi) => (
                        <div key={fi} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> {f}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handlePurchase(plan)}
                      disabled={purchasing === plan.id || planOutOfStock}
                      className={`w-full rounded-lg py-2.5 font-bold text-sm transition-all disabled:opacity-50 ${planOutOfStock ? "border border-border/20 text-muted-foreground cursor-not-allowed" : "border border-border/40 text-foreground hover:bg-secondary/40"}`}
                    >
                      {planOutOfStock ? "Hết hàng" : purchasing === plan.id ? "Đang xử lý..." : "Mua ngay"}
                    </button>
                  </motion.div>
                );
              })}
            </div>
            <div className="text-center mt-5">
              <button onClick={() => setShowPlans(false)} className="bg-secondary/80 text-foreground text-sm font-medium px-6 py-2 rounded-lg hover:bg-secondary transition-colors">
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <Dialog open={!!purchasedAccount} onOpenChange={() => setPurchasedAccount(null)}>
        <DialogContent className="max-w-sm bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Crown className="h-5 w-5 text-primary" /> Mua gói thành công!
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
