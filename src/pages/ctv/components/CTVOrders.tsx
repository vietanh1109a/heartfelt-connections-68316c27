import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ShoppingCart, CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";

const statusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Đã thanh toán", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  delivered: { label: "Thành công", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  refunded: { label: "Hoàn tiền", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

interface Props {
  userId: string;
}

export const CTVOrders = ({ userId }: Props) => {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["ctv-orders", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("*, ctv_listings(title)")
        .eq("ctv_user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!orders) return { total: 0, success: 0, refunded: 0, rate: "0" };
    const success = orders.filter(o => o.status !== "refunded").length;
    return {
      total: orders.length,
      success,
      refunded: orders.filter(o => o.status === "refunded").length,
      rate: orders.length > 0 ? ((success / orders.length) * 100).toFixed(1) : "0",
    };
  }, [orders]);

  const chartData = useMemo(() => {
    if (!orders) return [];
    const map: Record<string, { date: string; orders: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      map[d] = { date: d, orders: 0 };
    }
    orders.forEach(o => {
      const d = format(new Date(o.created_at), "dd/MM");
      if (map[d]) map[d].orders += 1;
    });
    return Object.values(map);
  }, [orders]);

  const statCards = [
    { label: "Tổng đơn", value: stats.total, icon: ShoppingCart, color: "text-foreground" },
    { label: "Thành công", value: stats.success, icon: CheckCircle, color: "text-green-400" },
    { label: "Hoàn tiền", value: stats.refunded, icon: AlertTriangle, color: "text-orange-400" },
    { label: "Tỉ lệ TC", value: `${stats.rate}%`, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="ctv-card ctv-card-hover">
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-accent">
                    <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart - compact */}
      <Card className="ctv-card">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Đơn hàng 7 ngày</h3>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="ctv-card">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Danh sách đơn hàng</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 font-medium">Mã đơn</th>
                  <th className="text-left py-2 font-medium">Sản phẩm</th>
                  <th className="text-right py-2 font-medium">Giá</th>
                  <th className="text-right py-2 font-medium">Hoa hồng</th>
                  <th className="text-center py-2 font-medium">Trạng thái</th>
                  <th className="text-right py-2 font-medium">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground animate-pulse text-xs">Đang tải...</td></tr>
                ) : !orders?.length ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">Chưa có đơn hàng nào</td></tr>
                ) : (
                  orders.map((o: any) => {
                    const st = statusConfig[o.status] ?? { label: o.status, className: "bg-secondary text-muted-foreground" };
                    return (
                      <tr key={o.id} className="hover:bg-accent/30 transition-colors">
                        <td className="py-2.5 text-[10px] text-muted-foreground font-mono">{o.id.slice(0, 8)}</td>
                        <td className="py-2.5 text-xs font-medium text-foreground truncate max-w-[160px]">{o.ctv_listings?.title ?? "—"}</td>
                        <td className="text-right text-xs text-foreground">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                        <td className="text-right text-xs text-primary font-semibold">{(o.commission ?? 0).toLocaleString("vi-VN")}đ</td>
                        <td className="text-center">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.className}`}>{st.label}</span>
                        </td>
                        <td className="text-right text-[10px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yy HH:mm")}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
