import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import {
  DollarSign, Wallet, Package, TrendingUp,
  Lightbulb, Bell, CheckCircle, AlertTriangle, Star, Rocket,
} from "lucide-react";

interface Props {
  profile: {
    user_id: string;
    total_earned?: number;
    balance?: number;
    commission_rate?: number;
    status?: string;
    display_name?: string;
    [key: string]: any;
  };
}

export const CTVOverview = ({ profile }: Props) => {
  const totalSales = profile.total_earned ?? 0;
  const availableBalance = profile.balance ?? 0;

  const { data: orderStats } = useQuery({
    queryKey: ["ctv-order-stats", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("status")
        .eq("ctv_user_id", profile.user_id);
      const all = data ?? [];
      const success = all.filter(o => o.status !== "refunded").length;
      return { total: all.length, success, refunded: all.filter(o => o.status === "refunded").length };
    },
  });

  const successRate = (orderStats?.total ?? 0) > 0
    ? ((orderStats!.success / orderStats!.total) * 100).toFixed(1)
    : "0.0";

  const { data: listingStats } = useQuery({
    queryKey: ["ctv-listing-stats", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_listings")
        .select("status")
        .eq("ctv_user_id", profile.user_id);
      const all = data ?? [];
      return {
        active: all.filter(l => l.status === "approved").length,
        pending: all.filter(l => l.status === "pending_review").length,
      };
    },
  });

  const { data: chartData } = useQuery({
    queryKey: ["ctv-overview-chart", profile.user_id],
    queryFn: async () => {
      const since = subDays(new Date(), 6).toISOString();
      const { data } = await supabase
        .from("ctv_orders")
        .select("commission, created_at, status")
        .eq("ctv_user_id", profile.user_id)
        .gte("created_at", since);
      const map: Record<string, { date: string; revenue: number; orders: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "dd/MM");
        map[d] = { date: d, revenue: 0, orders: 0 };
      }
      (data ?? []).forEach((o) => {
        if (o.status === "refunded") return;
        const d = format(new Date(o.created_at), "dd/MM");
        if (map[d]) { map[d].revenue += o.commission; map[d].orders += 1; }
      });
      return Object.values(map);
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["ctv-top-products", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_listings")
        .select("id, title, total_sold, price")
        .eq("ctv_user_id", profile.user_id)
        .eq("status", "approved")
        .order("total_sold", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["ctv-recent-activity", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("id, amount, commission, status, created_at, ctv_listings(title)")
        .eq("ctv_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const mainStats = [
    { label: "Doanh thu", value: `${totalSales.toLocaleString("vi-VN")}đ`, icon: DollarSign, color: "text-primary" },
    { label: "Khả dụng", value: `${availableBalance.toLocaleString("vi-VN")}đ`, icon: Wallet, color: "text-green-400" },
    { label: "Đang bán", value: `${listingStats?.active ?? 0}`, icon: Package, color: "text-blue-400" },
    { label: "Tỉ lệ TC", value: `${successRate}%`, icon: TrendingUp, color: parseFloat(successRate) >= 90 ? "text-green-400" : "text-primary" },
  ];

  const activityIcon = (status: string) => {
    if (status === "refunded") return <AlertTriangle className="h-3 w-3 text-orange-400" />;
    return <CheckCircle className="h-3 w-3 text-green-400" />;
  };

  return (
    <div className="space-y-5">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {mainStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="ctv-card ctv-card-hover">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-accent">
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
                    <p className={`ctv-stat-value ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart 70% + Sidebar 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        <div className="lg:col-span-7 space-y-4">
          <Card className="ctv-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Doanh thu 7 ngày
                </h3>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
                      formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                      cursor={{ fill: "hsl(var(--accent))", opacity: 0.5 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top products */}
          {topProducts && topProducts.length > 0 && (
            <Card className="ctv-card">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Star className="h-3.5 w-3.5" /> Top sản phẩm
                </h3>
                <div className="divide-y divide-border/30">
                  {topProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-[10px] font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.price.toLocaleString("vi-VN")}đ</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">{p.total_sold} bán</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar 30% */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="ctv-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5" /> Ví CTV
              </h3>
              {[
                { label: "Chờ duyệt", value: `${listingStats?.pending ?? 0} SP`, color: "text-yellow-400" },
                { label: "Đơn hoàn", value: `${orderStats?.refunded ?? 0}`, color: "text-orange-400" },
                { label: "Tổng đơn", value: `${orderStats?.total ?? 0}`, color: "text-foreground" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="ctv-card">
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phí nền tảng</h3>
              {[
                { range: "< 100k", fee: "10%", active: false },
                { range: "100k–300k", fee: "7%", active: false },
                { range: "> 300k", fee: "5%", active: false },
              ].map((r, i) => (
                <div key={i} className="flex justify-between py-1.5 text-sm">
                  <span className="text-muted-foreground">{r.range}</span>
                  <span className="text-primary font-semibold">{r.fee}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="ctv-card bg-accent/30">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-400" /> Tips
              </h3>
              <ul className="space-y-1.5">
                {[
                  "Giá cạnh tranh so với thị trường",
                  "Mô tả rõ ràng, ảnh minh họa đẹp",
                  "Bảo hành dài → bán nhanh hơn",
                  "Giảm tỉ lệ hoàn < 5%",
                ].map((t, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-yellow-400 mt-0.5 text-[8px]">●</span>{t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <Card className="ctv-card">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
            <Bell className="h-3.5 w-3.5" /> Hoạt động gần đây
          </h3>
          {(!recentOrders || recentOrders.length === 0) ? (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <div className="p-3 rounded-2xl bg-primary/10">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Chưa có hoạt động</p>
                <p className="text-xs text-muted-foreground">Tạo sản phẩm đầu tiên để bắt đầu kiếm tiền!</p>
              </div>
              <Button size="sm" className="ctv-glow-btn mt-1">
                <Package className="h-3.5 w-3.5 mr-1.5" /> Tạo sản phẩm
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-2 font-medium">Sản phẩm</th>
                    <th className="text-right py-2 font-medium">Giá</th>
                    <th className="text-right py-2 font-medium">Hoa hồng</th>
                    <th className="text-center py-2 font-medium">TT</th>
                    <th className="text-right py-2 font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {recentOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 text-foreground text-xs font-medium truncate max-w-[160px]">
                        {o.ctv_listings?.title ?? "Sản phẩm"}
                      </td>
                      <td className="text-right text-xs text-muted-foreground">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="text-right text-xs">
                        <span className={o.status === "refunded" ? "text-orange-400" : "text-primary font-semibold"}>
                          {o.status === "refunded" ? "-" : "+"}{(o.commission ?? 0).toLocaleString("vi-VN")}đ
                        </span>
                      </td>
                      <td className="text-center">{activityIcon(o.status)}</td>
                      <td className="text-right text-[10px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM HH:mm")}</td>
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
