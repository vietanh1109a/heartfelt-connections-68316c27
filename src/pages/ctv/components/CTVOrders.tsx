import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ShoppingCart, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

const statusCfg: Record<string, { label: string; cls: string }> = {
  paid: { label: "Đã TT", cls: "bg-blue-500/10 text-blue-400" },
  delivered: { label: "Thành công", cls: "bg-emerald-500/10 text-emerald-400" },
  refunded: { label: "Hoàn tiền", cls: "bg-orange-500/10 text-orange-400" },
};

export const CTVOrders = ({ userId }: { userId: string }) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["ctv-orders", userId],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_orders").select("*, ctv_listings(title)").eq("ctv_user_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!orders) return { total: 0, success: 0, refunded: 0, rate: "0" };
    const success = orders.filter(o => o.status !== "refunded").length;
    return { total: orders.length, success, refunded: orders.length - success, rate: orders.length > 0 ? ((success / orders.length) * 100).toFixed(1) : "0" };
  }, [orders]);

  const chartData = useMemo(() => {
    if (!orders) return [];
    const map: Record<string, { date: string; orders: number }> = {};
    for (let i = 6; i >= 0; i--) { const d = format(subDays(new Date(), i), "dd/MM"); map[d] = { date: d, orders: 0 }; }
    orders.forEach(o => { const d = format(new Date(o.created_at), "dd/MM"); if (map[d]) map[d].orders += 1; });
    return Object.values(map);
  }, [orders]);

  const kpis = [
    { label: "Tổng đơn", value: stats.total, icon: ShoppingCart, color: "text-foreground", bg: "bg-accent" },
    { label: "Thành công", value: stats.success, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Hoàn tiền", value: stats.refunded, icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Tỉ lệ TC", value: `${stats.rate}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k, i) => { const Icon = k.icon; return (
          <Card key={i} className="dash-card dash-card-hover">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ); })}
      </div>

      <Card className="dash-card">
        <CardContent className="p-5">
          <h3 className="dash-section-title mb-4">Đơn hàng 7 ngày</h3>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="dash-card">
        <CardContent className="p-5">
          <h3 className="dash-section-title mb-4">Danh sách đơn hàng</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                  <th className="text-left py-2 font-medium">Mã đơn</th>
                  <th className="text-left py-2 font-medium">Sản phẩm</th>
                  <th className="text-right py-2 font-medium">Giá</th>
                  <th className="text-right py-2 font-medium">Hoa hồng</th>
                  <th className="text-center py-2 font-medium">TT</th>
                  <th className="text-right py-2 font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-xs">Đang tải...</td></tr>
                : !orders?.length ? <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">Chưa có đơn hàng</td></tr>
                : orders.map((o: any) => {
                  const st = statusCfg[o.status] ?? { label: o.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={o.id} className="border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 text-[11px] text-muted-foreground font-mono">{o.id.slice(0, 8)}</td>
                      <td className="py-2.5 text-xs font-medium text-foreground truncate max-w-[140px]">{o.ctv_listings?.title ?? "—"}</td>
                      <td className="text-right text-xs">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="text-right text-xs text-primary font-medium">{(o.commission ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="text-center"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${st.cls}`}>{st.label}</span></td>
                      <td className="text-right text-[11px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM HH:mm")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
