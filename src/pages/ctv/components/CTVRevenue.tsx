import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpRight } from "lucide-react";

interface Props {
  userId: string;
}

type Period = "7" | "30" | "90" | "all";

export const CTVRevenue = ({ userId }: Props) => {
  const [period, setPeriod] = useState<Period>("30");

  const { data: orders } = useQuery({
    queryKey: ["ctv-revenue-all", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("commission, created_at, status, amount, ctv_listings(title)")
        .eq("ctv_user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const validOrders = useMemo(() => (orders ?? []).filter(o => o.status !== "refunded"), [orders]);

  const breakdowns = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const d7 = subDays(now, 7);
    const d30 = subDays(now, 30);

    let today = 0, week = 0, month = 0, all = 0;
    validOrders.forEach(o => {
      const date = new Date(o.created_at);
      all += o.commission;
      if (isAfter(date, todayStart)) today += o.commission;
      if (isAfter(date, d7)) week += o.commission;
      if (isAfter(date, d30)) month += o.commission;
    });

    const d14 = subDays(now, 14);
    let thisWeek = 0, lastWeek = 0;
    validOrders.forEach(o => {
      const date = new Date(o.created_at);
      if (isAfter(date, d7)) thisWeek += o.commission;
      else if (isAfter(date, d14)) lastWeek += o.commission;
    });
    const growth = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100).toFixed(1) : thisWeek > 0 ? "100" : "0";

    return { today, week, month, all, growth: parseFloat(growth as string) };
  }, [validOrders]);

  const days = period === "7" ? 7 : period === "30" ? 30 : period === "90" ? 90 : 30;
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number }> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      map[d] = { date: d, revenue: 0 };
    }
    validOrders.forEach(o => {
      const d = format(new Date(o.created_at), "dd/MM");
      if (map[d]) map[d].revenue += o.commission;
    });
    return Object.values(map);
  }, [validOrders, days]);

  const pillItems: { key: Period; label: string }[] = [
    { key: "7", label: "7 ngày" },
    { key: "30", label: "30 ngày" },
    { key: "90", label: "90 ngày" },
    { key: "all", label: "Tất cả" },
  ];

  const breakdownCards = [
    { label: "Hôm nay", value: breakdowns.today },
    { label: "7 ngày", value: breakdowns.week },
    { label: "30 ngày", value: breakdowns.month },
    { label: "Tất cả", value: breakdowns.all },
  ];

  return (
    <div className="space-y-4">
      {/* Period pills */}
      <div className="flex gap-1 bg-accent/30 p-1 rounded-xl w-fit border border-border/15">
        {pillItems.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              period === p.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {breakdownCards.map((b, i) => (
          <Card key={i} className="ctv-card ctv-card-hover group">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{b.label}</p>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/20" />
              </div>
              <p className="text-lg font-bold text-primary">{b.value.toLocaleString("vi-VN")}đ</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart 70% + Summary 30% */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-3">
        <div className="lg:col-span-7">
          <Card className="ctv-card">
            <CardContent className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
                <BarChart3 className="h-3.5 w-3.5" /> Biểu đồ doanh thu
              </h3>
              <div className="h-[220px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(0, Math.floor(days / 10) - 1)} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
                        formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                        cursor={{ fill: "hsl(var(--accent))", opacity: 0.3 }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-3">
          <Card className="ctv-card ctv-card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${breakdowns.growth >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
                {breakdowns.growth >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tăng trưởng tuần</p>
                <p className={`text-xl font-bold ${breakdowns.growth >= 0 ? "text-green-400" : "text-destructive"}`}>
                  {breakdowns.growth >= 0 ? "+" : ""}{breakdowns.growth}%
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="ctv-card ctv-card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tổng doanh thu</p>
                <p className="text-xl font-bold text-foreground">{breakdowns.all.toLocaleString("vi-VN")}đ</p>
                <p className="text-[10px] text-muted-foreground">{validOrders.length} đơn TC</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transaction table */}
      <Card className="ctv-card">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chi tiết giao dịch</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <th className="text-left py-2 font-medium">Sản phẩm</th>
                  <th className="text-right py-2 font-medium">Giá bán</th>
                  <th className="text-right py-2 font-medium">Hoa hồng</th>
                  <th className="text-center py-2 font-medium">TT</th>
                  <th className="text-right py-2 font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {(!orders || orders.length === 0) ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Chưa có giao dịch</td></tr>
                ) : (
                  orders.slice(0, 15).map((o: any, idx: number) => (
                    <tr key={`${o.created_at}-${idx}`} className="hover:bg-accent/20 transition-colors">
                      <td className="py-2 text-xs text-foreground truncate max-w-[160px]">{o.ctv_listings?.title ?? "—"}</td>
                      <td className="text-right text-xs text-muted-foreground">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="text-right text-xs text-primary font-semibold">{(o.commission ?? 0).toLocaleString("vi-VN")}đ</td>
                      <td className="text-center">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o.status === "refunded" ? "bg-orange-500/10 text-orange-400" : "bg-green-500/10 text-green-400"}`}>
                          {o.status === "refunded" ? "Hoàn" : "TC"}
                        </span>
                      </td>
                      <td className="text-right text-[10px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yy HH:mm")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
