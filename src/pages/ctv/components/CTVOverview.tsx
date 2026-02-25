import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import {
  DollarSign, Wallet, Package, TrendingUp,
  Lightbulb, Bell, CheckCircle, AlertTriangle, Clock, Star,
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

  // Top products
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
    { label: "Doanh thu", value: `${totalSales.toLocaleString("vi-VN")}đ`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Khả dụng", value: `${availableBalance.toLocaleString("vi-VN")}đ`, icon: Wallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Đang bán", value: `${listingStats?.active ?? 0}`, icon: Package, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Tỉ lệ TC", value: `${successRate}%`, icon: TrendingUp, color: parseFloat(successRate) >= 90 ? "text-green-400" : "text-primary", bg: parseFloat(successRate) >= 90 ? "bg-green-400/10" : "bg-primary/10" },
  ];

  const activityIcon = (status: string) => {
    if (status === "refunded") return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
    return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
  };

  return (
    <div className="space-y-5">
      {/* 4 Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mainStats.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                  <div className={`p-1.5 rounded-lg ${s.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart (70%) + Sidebar (30%) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Charts - Left 70% */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Doanh thu 7 ngày
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top products */}
          {topProducts && topProducts.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Star className="h-4 w-4" /> Top sản phẩm
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <div className="divide-y divide-border/20">
                  {topProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground">{p.price.toLocaleString("vi-VN")}đ</p>
                      </div>
                      <span className="text-xs font-semibold text-primary">{p.total_sold} đã bán</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Right 30% */}
        <div className="lg:col-span-3 space-y-4">
          {/* Wallet summary */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" /> Ví CTV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Chờ duyệt</span>
                <span className="text-yellow-400 font-semibold">{(listingStats?.pending ?? 0)} SP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Đơn hoàn</span>
                <span className="text-orange-400 font-semibold">{orderStats?.refunded ?? 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tổng đơn</span>
                <span className="text-foreground font-semibold">{orderStats?.total ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Fee Policy */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Phí nền tảng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {[
                { range: "< 100k", fee: "10%" },
                { range: "100k–300k", fee: "7%" },
                { range: "> 300k", fee: "5%" },
              ].map((r, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-border/20 last:border-0 text-sm">
                  <span className="text-muted-foreground">{r.range}</span>
                  <span className="text-primary font-semibold">{r.fee}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tips - neutral bg instead of red */}
          <Card className="border-border/50 bg-secondary/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-400" /> Tips tăng doanh số
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {[
                  "Giá cạnh tranh so với thị trường",
                  "Mô tả rõ ràng, ảnh minh họa đẹp",
                  "Bảo hành dài → bán nhanh hơn",
                  "Giảm tỉ lệ hoàn < 5% để giữ uy tín",
                ].map((t, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-yellow-400 mt-0.5">•</span>{t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity - full width */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" /> Hoạt động gần đây
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(!recentOrders || recentOrders.length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Chưa có hoạt động</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-xs text-muted-foreground uppercase">
                    <th className="text-left py-2 font-medium">Sản phẩm</th>
                    <th className="text-right py-2 font-medium">Giá</th>
                    <th className="text-right py-2 font-medium">Hoa hồng</th>
                    <th className="text-center py-2 font-medium">TT</th>
                    <th className="text-right py-2 font-medium">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {recentOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-secondary/30 transition-colors">
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
