import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";
import { BarChart3 } from "lucide-react";

interface Props {
  userId: string;
}

export const CTVRevenue = ({ userId }: Props) => {
  const { data: orders } = useQuery({
    queryKey: ["ctv-revenue-chart", userId],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from("ctv_orders")
        .select("ctv_earning, created_at, status")
        .eq("ctv_user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  // Group by date
  const chartData = (() => {
    if (!orders?.length) return [];
    const map: Record<string, { date: string; revenue: number; orders: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "dd/MM");
      map[d] = { date: d, revenue: 0, orders: 0 };
    }
    orders.forEach((o) => {
      if (o.status === "refunded") return;
      const d = format(new Date(o.created_at), "dd/MM");
      if (map[d]) {
        map[d].revenue += o.ctv_earning;
        map[d].orders += 1;
      }
    });
    return Object.values(map);
  })();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Doanh thu 30 ngày</h2>

      {!chartData.length ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-3">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có dữ liệu doanh thu</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">Doanh thu (VNĐ)</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    formatter={(value: number) => [`${value.toLocaleString("vi-VN")}đ`, "Doanh thu"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">Số đơn</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value: number) => [value, "Đơn"]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--accent-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
