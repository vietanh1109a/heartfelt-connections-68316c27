import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Cookie, DollarSign, Crown, Activity, ArrowUpRight } from "lucide-react";

export function StatsTab() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = new Date();
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
        supabase.from("transactions").select("amount, type, created_at, description").order("created_at", { ascending: false }).limit(500),
        supabase.from("cookie_stock").select("*", { count: "exact", head: true }),
        supabase.from("cookie_stock").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("vip_purchases").select("amount_paid, created_at"),
      ]);

      const totalRevenue = transactions?.filter(t => t.type === "deposit").reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0;
      const revenueToday = transactions?.filter(t => t.type === "deposit" && new Date(t.created_at) >= today).reduce((sum, t) => sum + (t.amount ?? 0), 0) ?? 0;
      const usageToday = transactions?.filter(t => t.type === "purchase" && new Date(t.created_at) >= today).length ?? 0;
      const dieCookies = (totalCookies ?? 0) - (liveCookies ?? 0);
      const vipRevenue = vipPurchases?.reduce((sum, v) => sum + (v.amount_paid ?? 0), 0) ?? 0;
      const recent = [...(transactions ?? [])].slice(0, 8);

      return {
        totalUsers: totalUsers ?? 0,
        newUsersToday: newUsersToday ?? 0,
        vipUsers: vipUsers ?? 0,
        totalRevenue, revenueToday, usageToday,
        totalCookies: totalCookies ?? 0,
        liveCookies: liveCookies ?? 0,
        dieCookies, vipRevenue, recent,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => (
          <Card key={i} className="ctv-card animate-pulse">
            <CardContent className="p-4 space-y-2">
              <div className="h-3 bg-accent rounded w-20" />
              <div className="h-6 bg-accent rounded w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString("vi-VN");

  const cards = [
    { label: "Tổng doanh thu", value: `${fmt(stats?.totalRevenue ?? 0)}đ`, sub: `+${fmt(stats?.revenueToday ?? 0)}đ hôm nay`, icon: DollarSign, color: "text-green-400", iconBg: "bg-green-500/10" },
    { label: "Tổng người dùng", value: stats?.totalUsers ?? 0, sub: `+${stats?.newUsersToday ?? 0} hôm nay`, icon: Users, color: "text-blue-400", iconBg: "bg-blue-500/10" },
    { label: "Thành viên VIP", value: stats?.vipUsers ?? 0, sub: `DT VIP: ${fmt(stats?.vipRevenue ?? 0)}đ`, icon: Crown, color: "text-yellow-400", iconBg: "bg-yellow-500/10" },
    { label: "Cookie Live / Die", value: `${stats?.liveCookies ?? 0} / ${stats?.dieCookies ?? 0}`, sub: `Tổng: ${stats?.totalCookies ?? 0}`, icon: Cookie, color: "text-primary", iconBg: "bg-primary/10" },
    { label: "Lượt xem hôm nay", value: stats?.usageToday ?? 0, sub: "Lần nhấn Xem Netflix", icon: Activity, color: "text-orange-400", iconBg: "bg-orange-500/10" },
    { label: "Cookie live rate", value: stats?.totalCookies ? `${Math.round((stats.liveCookies / stats.totalCookies) * 100)}%` : "—", sub: `${stats?.liveCookies ?? 0} đang hoạt động`, icon: TrendingUp, color: "text-emerald-400", iconBg: "bg-emerald-500/10" },
  ];

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => (
          <Card key={card.label} className="ctv-card ctv-card-hover group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-xl ${card.iconBg} group-hover:scale-110 transition-transform`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
              </div>
              <p className={`text-xl font-bold ${card.color} mb-0.5`}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">{card.label}</p>
              <p className="text-[10px] text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent transactions */}
      <Card className="ctv-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider">Giao dịch gần đây</h3>
          </div>
          <div className="divide-y divide-border/15">
            {stats?.recent?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">Chưa có giao dịch</p>
            ) : stats?.recent?.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2.5 hover:bg-accent/20 transition-colors rounded-lg px-1">
                <div className="flex items-center gap-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.type === "deposit" ? "bg-green-500/10 text-green-400" : "bg-orange-500/10 text-orange-400"}`}>
                    {t.type === "deposit" ? "Nạp" : "Dùng"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{t.description || "—"}</span>
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
        </CardContent>
      </Card>
    </div>
  );
}
