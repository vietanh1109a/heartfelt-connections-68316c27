import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import {
  DollarSign, Clock, Wallet, AlertTriangle, Package, CheckCircle,
  TrendingUp, ShoppingCart, Lightbulb, Bell,
} from "lucide-react";

interface Props {
  profile: {
    user_id: string;
    total_sales: number;
    total_orders: number;
    pending_balance: number;
    available_balance: number;
    refund_count: number;
  };
}

export const CTVOverview = ({ profile }: Props) => {
  const refundRate = profile.total_orders > 0
    ? ((profile.refund_count / profile.total_orders) * 100).toFixed(1)
    : "0.0";

  // Fetch listings count
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

  // Fetch 7-day chart data
  const { data: chartData } = useQuery({
    queryKey: ["ctv-overview-chart", profile.user_id],
    queryFn: async () => {
      const since = subDays(new Date(), 6).toISOString();
      const { data } = await supabase
        .from("ctv_orders")
        .select("ctv_earning, created_at, status")
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
        if (map[d]) { map[d].revenue += o.ctv_earning; map[d].orders += 1; }
      });
      return Object.values(map);
    },
  });

  // Recent orders for activity
  const { data: recentOrders } = useQuery({
    queryKey: ["ctv-recent-activity", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("id, price, ctv_earning, status, created_at, ctv_listings(title)")
        .eq("ctv_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const stats = [
    { label: "Tổng doanh thu", value: `${profile.total_sales.toLocaleString("vi-VN")}đ`, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Pending", value: `${profile.pending_balance.toLocaleString("vi-VN")}đ`, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Khả dụng", value: `${profile.available_balance.toLocaleString("vi-VN")}đ`, icon: Wallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Đang bán", value: `${listingStats?.active ?? 0}`, icon: Package, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Chờ duyệt", value: `${listingStats?.pending ?? 0}`, icon: CheckCircle, color: "text-orange-400", bg: "bg-orange-400/10" },
    { label: "Tỉ lệ hoàn", value: `${refundRate}%`, icon: AlertTriangle, color: parseFloat(refundRate) > 10 ? "text-destructive" : "text-muted-foreground", bg: parseFloat(refundRate) > 10 ? "bg-destructive/10" : "bg-secondary" },
  ];

  const activityIcon = (status: string) => {
    if (status === "refunded") return <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />;
    return <CheckCircle className="h-3.5 w-3.5 text-green-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s, i) => {
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
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Charts - Left */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Doanh thu 7 ngày
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
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

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Đơn hàng theo ngày
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [v, "Đơn"]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Activity - Right */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bell className="h-4 w-4" /> Hoạt động gần đây
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {(!recentOrders || recentOrders.length === 0) ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Chưa có hoạt động</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {recentOrders.map((o: any) => (
                    <div key={o.id} className="flex items-center gap-3 py-2.5">
                      {activityIcon(o.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{o.ctv_listings?.title ?? "Sản phẩm"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {o.status === "refunded" ? "Hoàn tiền" : "Đơn thành công"} • {format(new Date(o.created_at), "dd/MM HH:mm")}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold ${o.status === "refunded" ? "text-orange-400" : "text-primary"}`}>
                        {o.status === "refunded" ? "-" : "+"}{o.ctv_earning.toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

          {/* Tips */}
          <Card className="border-border/50 bg-primary/5">
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
                    <span className="text-primary mt-0.5">•</span>{t}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
