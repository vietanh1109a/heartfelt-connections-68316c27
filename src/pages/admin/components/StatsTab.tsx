import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Users, Cookie, DollarSign, Crown, Activity } from "lucide-react";

export function StatsTab() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = new Date();

      // FIX: Use count-only queries to avoid 1000-row Supabase limit
      const [
        { count: totalUsers },
        { count: newUsersToday },
        { count: vipUsers },
        { data: transactions },
        { count: totalCookies },
        { count: liveCookies },
        { data: vipPurchases },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("vip_expires_at", now.toISOString()),
        supabase.from("transactions").select("amount, type, created_at, memo").order("created_at", { ascending: false }).limit(500),
        supabase.from("cookie_stock").select("*", { count: "exact", head: true }),
        supabase.from("cookie_stock").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("vip_purchases").select("amount_paid, created_at"),
      ]);

      const totalRevenue = transactions?.filter(t => t.type === "deposit").reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0;
      const revenueToday = transactions?.filter(t => t.type === "deposit" && new Date(t.created_at) >= today).reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0;
      const usageToday = transactions?.filter(t => t.type === "usage" && new Date(t.created_at) >= today).length ?? 0;

      const dieCookies = (totalCookies ?? 0) - (liveCookies ?? 0);

      const vipRevenue = vipPurchases?.reduce((sum, v) => sum + (v.amount_paid ?? 0), 0) ?? 0;

      // Recent transactions (last 8)
      const recent = [...(transactions ?? [])].slice(0, 8);

      return {
        totalUsers: totalUsers ?? 0,
        newUsersToday: newUsersToday ?? 0,
        vipUsers: vipUsers ?? 0,
        totalRevenue, revenueToday, usageToday,
        totalCookies: totalCookies ?? 0,
        liveCookies: liveCookies ?? 0,
        dieCookies,
        vipRevenue, recent,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Đang tải thống kê...</div>;
  }

  const fmt = (n: number) => n.toLocaleString("vi-VN");

  const cards = [
    { label: "Tổng doanh thu", value: `${fmt(stats?.totalRevenue ?? 0)}đ`, sub: `+${fmt(stats?.revenueToday ?? 0)}đ hôm nay`, icon: DollarSign, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
    { label: "Tổng người dùng", value: stats?.totalUsers ?? 0, sub: `+${stats?.newUsersToday ?? 0} hôm nay`, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Thành viên VIP", value: stats?.vipUsers ?? 0, sub: `Doanh thu VIP: ${fmt(stats?.vipRevenue ?? 0)}đ`, icon: Crown, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
    { label: "Cookie Live / Die", value: `${stats?.liveCookies ?? 0} / ${stats?.dieCookies ?? 0}`, sub: `Tổng: ${stats?.totalCookies ?? 0} cookie`, icon: Cookie, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    { label: "Lượt xem hôm nay", value: stats?.usageToday ?? 0, sub: "Lần nhấn Xem Netflix", icon: Activity, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
    { label: "Cookie live rate", value: stats?.totalCookies ? `${Math.round((stats.liveCookies / stats.totalCookies) * 100)}%` : "—", sub: `${stats?.liveCookies ?? 0} cookie đang hoạt động`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-bold text-foreground text-sm">Giao dịch gần đây</h3>
        </div>
        <div className="divide-y divide-border/20">
          {stats?.recent?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">Chưa có giao dịch</p>
          ) : stats?.recent?.map((t: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === "deposit" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                  {t.type === "deposit" ? "Nạp" : "Dùng"}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{t.memo || "—"}</span>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${t.type === "deposit" ? "text-green-400" : "text-orange-400"}`}>
                  {t.type === "deposit" ? "+" : "-"}{(t.amount ?? 0).toLocaleString("vi-VN")}đ
                </span>
                <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString("vi-VN")}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
