import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

interface Props {
  userId: string;
}

export const CTVRevenue = ({ userId }: Props) => {
  const { data: orders } = useQuery({
    queryKey: ["ctv-revenue-all", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_orders")
        .select("commission, created_at, status")
        .eq("ctv_user_id", userId)
        .order("created_at", { ascending: true });
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

    // Growth calc (last 7 vs previous 7)
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

  // 30-day chart
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      map[d] = { date: d, revenue: 0 };
    }
    validOrders.forEach(o => {
      const d = format(new Date(o.created_at), "dd/MM");
      if (map[d]) map[d].revenue += o.commission;
    });
    return Object.values(map);
  }, [validOrders]);

  const breakdownCards = [
    { label: "Hôm nay", value: breakdowns.today },
    { label: "7 ngày", value: breakdowns.week },
    { label: "30 ngày", value: breakdowns.month },
    { label: "Tất cả", value: breakdowns.all },
  ];

  return (
    <div className="space-y-5">
      {/* Breakdown stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {breakdownCards.map((b, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{b.label}</p>
              <p className="text-xl font-bold text-primary">{b.value.toLocaleString("vi-VN")}đ</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Growth + Total row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${breakdowns.growth >= 0 ? "bg-green-500/10" : "bg-destructive/10"}`}>
              {breakdowns.growth >= 0 ? (
                <TrendingUp className="h-6 w-6 text-green-400" />
              ) : (
                <TrendingDown className="h-6 w-6 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tăng trưởng tuần</p>
              <p className={`text-2xl font-bold ${breakdowns.growth >= 0 ? "text-green-400" : "text-destructive"}`}>
                {breakdowns.growth >= 0 ? "+" : ""}{breakdowns.growth}%
              </p>
              <p className="text-xs text-muted-foreground">So với 7 ngày trước</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-foreground">{breakdowns.all.toLocaleString("vi-VN")}đ</p>
              <p className="text-xs text-muted-foreground">{validOrders.length} đơn thành công</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30-day Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Doanh thu 30 ngày (VNĐ)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Chưa có dữ liệu</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
