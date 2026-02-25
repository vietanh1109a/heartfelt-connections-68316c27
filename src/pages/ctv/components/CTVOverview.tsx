import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from "recharts";
import { format, subDays } from "date-fns";
import {
  DollarSign, Wallet, Package, TrendingUp,
  Bell, CheckCircle, AlertTriangle, Rocket, ArrowUpRight,
  Sparkles,
} from "lucide-react";

interface Props {
  profile: {
    user_id: string;
    total_earned?: number;
    balance?: number;
    commission_rate?: number;
    display_name?: string;
    [key: string]: any;
  };
}

export const CTVOverview = ({ profile }: Props) => {
  const totalSales = profile.total_earned ?? 0;
  const available = profile.balance ?? 0;

  const { data: orderStats } = useQuery({
    queryKey: ["ctv-order-stats", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_orders").select("status").eq("ctv_user_id", profile.user_id);
      const all = data ?? [];
      const success = all.filter(o => o.status !== "refunded").length;
      return { total: all.length, success, refunded: all.length - success };
    },
  });

  const { data: listingStats } = useQuery({
    queryKey: ["ctv-listing-stats", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_listings").select("status").eq("ctv_user_id", profile.user_id);
      const all = data ?? [];
      return { active: all.filter(l => l.status === "approved").length, pending: all.filter(l => l.status === "pending_review").length };
    },
  });

  const successRate = (orderStats?.total ?? 0) > 0
    ? ((orderStats!.success / orderStats!.total) * 100).toFixed(1) : "0";

  const { data: chartData } = useQuery({
    queryKey: ["ctv-overview-chart", profile.user_id],
    queryFn: async () => {
      const since = subDays(new Date(), 6).toISOString();
      const { data } = await supabase.from("ctv_orders").select("commission, created_at, status")
        .eq("ctv_user_id", profile.user_id).gte("created_at", since);
      const map: Record<string, { date: string; revenue: number }> = {};
      for (let i = 6; i >= 0; i--) { const d = format(subDays(new Date(), i), "dd/MM"); map[d] = { date: d, revenue: 0 }; }
      (data ?? []).forEach(o => { if (o.status !== "refunded") { const d = format(new Date(o.created_at), "dd/MM"); if (map[d]) map[d].revenue += o.commission; } });
      return Object.values(map);
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["ctv-recent-activity", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_orders").select("id, amount, commission, status, created_at, ctv_listings(title)")
        .eq("ctv_user_id", profile.user_id).order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const kpis = [
    { label: "Doanh thu", value: `${totalSales.toLocaleString("vi-VN")}đ`, icon: DollarSign, color: "text-emerald-400", iconBg: "bg-emerald-500/10" },
    { label: "Khả dụng", value: `${available.toLocaleString("vi-VN")}đ`, icon: Wallet, color: "text-blue-400", iconBg: "bg-blue-500/10" },
    { label: "Đang bán", value: `${listingStats?.active ?? 0} SP`, icon: Package, color: "text-violet-400", iconBg: "bg-violet-500/10" },
    { label: "Tỉ lệ TC", value: `${successRate}%`, icon: TrendingUp, color: "text-amber-400", iconBg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          Chào {profile.display_name ?? "CTV"} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Đây là tổng quan hoạt động của bạn.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <Card key={i} className="dash-card dash-card-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg ${k.iconBg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${k.color}`} />
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
                <p className="text-lg font-bold text-foreground tracking-tight">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart + Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <Card className="dash-card lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="dash-section-title">Doanh thu 7 ngày</h3>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData ?? []}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Side info */}
        <div className="space-y-3">
          <Card className="dash-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="dash-section-title">Tổng hợp</h3>
              {[
                { label: "Tổng đơn", val: `${orderStats?.total ?? 0}`, color: "text-foreground" },
                { label: "Đơn hoàn", val: `${orderStats?.refunded ?? 0}`, color: "text-orange-400" },
                { label: "Chờ duyệt", val: `${listingStats?.pending ?? 0} SP`, color: "text-yellow-400" },
                { label: "Hoa hồng", val: `${profile.commission_rate ?? 10}%`, color: "text-primary" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-semibold ${item.color}`}>{item.val}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="dash-card">
            <CardContent className="p-4 space-y-2">
              <h3 className="dash-section-title">Phí nền tảng</h3>
              {[{ r: "< 100k", f: "10%" }, { r: "100k–300k", f: "7%" }, { r: "> 300k", f: "5%" }].map((t, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t.r}</span>
                  <span className="text-foreground font-medium">{t.f}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="dash-card border-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
                <h3 className="text-xs font-semibold text-foreground">Tips</h3>
              </div>
              <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                <li>• Giá cạnh tranh → bán nhanh</li>
                <li>• Mô tả rõ, ảnh đẹp</li>
                <li>• Bảo hành dài → uy tín</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <Card className="dash-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="dash-section-title flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" /> Hoạt động gần đây
            </h3>
          </div>
          {(!recentOrders || recentOrders.length === 0) ? (
            <div className="py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Chưa có hoạt động</p>
                <p className="text-xs text-muted-foreground mt-1">Tạo sản phẩm đầu tiên để bắt đầu kiếm tiền!</p>
              </div>
              <Button size="sm" className="dash-glow-btn">
                <Package className="h-3.5 w-3.5 mr-1.5" /> Tạo sản phẩm
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Sản phẩm", "Giá", "Hoa hồng", "", "Thời gian"].map(h => (
                      <th key={h} className="text-[11px] text-muted-foreground font-medium py-2 text-left first:text-left last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o: any) => (
                    <tr key={o.id} className="border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 text-xs font-medium text-foreground max-w-[140px] truncate">{o.ctv_listings?.title ?? "—"}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="py-2.5 text-xs">
                        <span className={o.status === "refunded" ? "text-orange-400" : "text-emerald-400 font-medium"}>
                          {o.status === "refunded" ? "-" : "+"}{(o.commission ?? 0).toLocaleString("vi-VN")}đ
                        </span>
                      </td>
                      <td className="py-2.5">
                        {o.status === "refunded"
                          ? <AlertTriangle className="h-3 w-3 text-orange-400" />
                          : <CheckCircle className="h-3 w-3 text-emerald-400" />
                        }
                      </td>
                      <td className="py-2.5 text-[11px] text-muted-foreground text-right">{format(new Date(o.created_at), "dd/MM HH:mm")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
