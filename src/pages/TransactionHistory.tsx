import { useNavigate } from "react-router-dom";
import { useTransactions } from "@/hooks/useTransactions";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, ArrowDownCircle, ArrowUpCircle, Eye, EyeOff, Crown, Star } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TransactionHistory = () => {
  const { data: transactions, isLoading } = useTransactions();
  const { data: profile } = useProfile();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visibleAccounts, setVisibleAccounts] = useState<Record<string, boolean>>({});

  // Fetch user's plan purchases with assigned accounts
  const { data: purchases } = useQuery({
    queryKey: ["my-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("plan_purchases")
        .select("*, netflix_accounts(*), netflix_plans(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch VIP purchases
  const { data: vipPurchases } = useQuery({
    queryKey: ["my-vip-purchases", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("vip_purchases")
        .select("*, vip_plans(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Map transaction memo to purchase info
  const getPurchaseForTx = (tx: any) => {
    if (!tx.memo?.startsWith("Mua gói")) return null;
    return purchases?.find(
      (p: any) => Math.abs(new Date(p.created_at).getTime() - new Date(tx.created_at).getTime()) < 60000
    );
  };

  const toggleAccountVisibility = (id: string) => {
    setVisibleAccounts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Lịch sử giao dịch</h1>
        </div>
        <div className="flex items-center gap-2 bg-secondary/80 rounded-full px-4 py-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-foreground font-semibold text-sm">
            {(profile?.balance ?? 0).toLocaleString("vi-VN")}đ
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Tabs defaultValue="transactions">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="transactions" className="flex-1 gap-1.5">
              <ArrowUpCircle className="h-4 w-4" /> Giao dịch
            </TabsTrigger>
            <TabsTrigger value="vip" className="flex-1 gap-1.5">
              <Crown className="h-4 w-4 text-yellow-400" /> Lịch sử VIP
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex-1 gap-1.5">
              <Star className="h-4 w-4" /> Gói Netflix
            </TabsTrigger>
          </TabsList>

          {/* ─── TAB: TRANSACTIONS ─── */}
          <TabsContent value="transactions">
            {!transactions || transactions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <Wallet className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Chưa có giao dịch nào</p>
                <Button className="mt-6" onClick={() => navigate("/deposit")}>
                  Nạp tiền ngay
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx, i) => {
                  const purchase = getPurchaseForTx(tx);
                  const account = purchase?.netflix_accounts as any;
                  const plan = purchase?.netflix_plans as any;
                  const isAssigned = !!account;
                  const isVisible = visibleAccounts[tx.id];

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="p-4 bg-card border border-border/50 rounded-xl hover:border-border transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              tx.type === "deposit"
                                ? "bg-green-500/10 text-green-500"
                                : "bg-orange-500/10 text-orange-500"
                            }`}
                          >
                            {tx.type === "deposit" ? (
                              <ArrowDownCircle className="h-5 w-5" />
                            ) : (
                              <ArrowUpCircle className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-foreground font-medium text-sm">
                              {tx.type === "deposit" ? "Nạp tiền" : "Sử dụng"}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {tx.memo || (tx.type === "deposit" ? "Nạp tiền" : "Xem phim")}
                            </p>
                            <p className="text-muted-foreground/60 text-xs mt-0.5">
                              {format(new Date(tx.created_at), "HH:mm - dd/MM/yyyy", { locale: vi })}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-bold text-sm ${
                            tx.type === "deposit" ? "text-green-500" : "text-orange-500"
                          }`}
                        >
                          {tx.amount === 0
                            ? "🎁 Lượt xem"
                            : `${tx.type === "deposit" ? "+" : "-"}${tx.amount.toLocaleString("vi-VN")}đ`
                          }
                        </span>
                      </div>

                      {/* Show Netflix account info for plan purchases */}
                      {purchase && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          {isAssigned ? (
                            <div className="bg-secondary/40 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Crown className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-xs font-semibold text-foreground">Tài khoản Netflix — {plan?.name}</span>
                                </div>
                                <button
                                  onClick={() => toggleAccountVisibility(tx.id)}
                                  className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground w-16">Email:</span>
                                  <span className="text-foreground font-mono">
                                    {isVisible ? account.email : "••••••••@••••.com"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground w-16">Mật khẩu:</span>
                                  <span className="text-foreground font-mono">
                                    {isVisible ? account.password : "••••••••"}
                                  </span>
                                </div>
                                {account.expires_at && (
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground w-16">Hết hạn:</span>
                                    <span className="text-foreground">
                                      {format(new Date(account.expires_at), "dd/MM/yyyy", { locale: vi })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/20 rounded-lg p-2.5">
                              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                              Đang chờ Admin gán tài khoản Netflix cho bạn...
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: VIP ─── */}
          <TabsContent value="vip">
            {!vipPurchases || vipPurchases.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <Crown className="h-16 w-16 text-yellow-500/20 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Chưa có lịch sử VIP</p>
                <Button className="mt-6" onClick={() => navigate("/")}>
                  Nâng cấp VIP
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {vipPurchases.map((vip, i) => {
                  const isActive = new Date(vip.vip_expires_at) > new Date();
                  const plan = vip.vip_plans as any;
                  return (
                    <motion.div
                      key={vip.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`p-4 bg-card border rounded-xl ${isActive ? "border-yellow-500/40" : "border-border/50"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-full shrink-0 ${isActive ? "bg-yellow-500/20" : "bg-secondary/60"}`}>
                          <Crown className={`h-5 w-5 ${isActive ? "text-yellow-400" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-foreground font-semibold text-sm">{plan?.name ?? "VIP"}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-yellow-500/20 text-yellow-400" : "bg-secondary text-muted-foreground"}`}>
                              {isActive ? "Đang hoạt động" : "Đã hết hạn"}
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-0.5">
                            <p className="text-xs text-muted-foreground">
                              Ngày mua: <span className="text-foreground">{format(new Date(vip.created_at), "dd/MM/yyyy HH:mm", { locale: vi })}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Hết hạn: <span className={isActive ? "text-yellow-400 font-semibold" : "text-foreground"}>
                                {format(new Date(vip.vip_expires_at), "dd/MM/yyyy", { locale: vi })}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Đã trả: <span className="text-foreground font-semibold">{vip.amount_paid.toLocaleString("vi-VN")}đ</span>
                              {plan?.duration_days && <span className="text-muted-foreground"> / {Math.round(plan.duration_days / 30)} tháng</span>}
                            </p>
                          </div>
                          {isActive && (
                            <div className="mt-2.5 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all"
                                style={{
                                  width: `${Math.max(5, Math.min(100, ((new Date(vip.vip_expires_at).getTime() - Date.now()) / ((plan?.duration_days ?? 30) * 24 * 60 * 60 * 1000)) * 100))}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── TAB: PLANS (Netflix chính chủ) ─── */}
          <TabsContent value="plans">
            {!purchases || purchases.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <Star className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">Chưa có gói nào được mua</p>
                <Button className="mt-6" onClick={() => navigate("/")}>
                  Xem các gói
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-3">
                {purchases.map((p: any, i: number) => {
                  const plan = p.netflix_plans as any;
                  const account = p.netflix_accounts as any;
                  const isAssigned = !!account;
                  const isVisible = visibleAccounts[`plan-${p.id}`];

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="p-4 bg-card border border-border/50 rounded-xl"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-foreground font-semibold text-sm">{plan?.name ?? "Gói Netflix"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: vi })} — {p.amount_paid.toLocaleString("vi-VN")}đ
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isAssigned ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {isAssigned ? "Đã gán" : "Đang chờ"}
                        </span>
                      </div>

                      {isAssigned ? (
                        <div className="bg-secondary/40 rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">Thông tin tài khoản Netflix</span>
                            <button
                              onClick={() => setVisibleAccounts(prev => ({ ...prev, [`plan-${p.id}`]: !prev[`plan-${p.id}`] }))}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">Email:</span>
                            <span className="text-foreground font-mono">{isVisible ? account.email : "••••••••@••••.com"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">Mật khẩu:</span>
                            <span className="text-foreground font-mono">{isVisible ? account.password : "••••••••"}</span>
                          </div>
                          {account.expires_at && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-16">Hết hạn:</span>
                              <span className="text-foreground">{format(new Date(account.expires_at), "dd/MM/yyyy", { locale: vi })}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/20 rounded-lg p-2.5">
                          <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                          Đang chờ Admin gán tài khoản Netflix cho bạn...
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TransactionHistory;
