import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

type Period = "7" | "30" | "90" | "all";

export const CTVRevenue = ({ userId }: { userId: string }) => {
  const [period, setPeriod] = useState<Period>("30");

  const { data: orders } = useQuery({
    queryKey: ["ctv-revenue-all", userId],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_orders").select("commission, created_at, status, amount, ctv_listings(title)")
        .eq("ctv_user_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const valid = useMemo(() => (orders ?? []).filter(o => o.status !== "refunded"), [orders]);

  const bd = useMemo(() => {
    const now = new Date(); const ts = startOfDay(now); const d7 = subDays(now, 7); const d30 = subDays(now, 30);
    let today = 0, week = 0, month = 0, all = 0;
    valid.forEach(o => { const dt = new Date(o.created_at); all += o.commission; if (isAfter(dt, ts)) today += o.commission; if (isAfter(dt, d7)) week += o.commission; if (isAfter(dt, d30)) month += o.commission; });
    const d14 = subDays(now, 14); let tw = 0, lw = 0;
    valid.forEach(o => { const dt = new Date(o.created_at); if (isAfter(dt, d7)) tw += o.commission; else if (isAfter(dt, d14)) lw += o.commission; });
    const g = lw > 0 ? ((tw - lw) / lw * 100) : tw > 0 ? 100 : 0;
    return { today, week, month, all, growth: parseFloat(g.toFixed(1)) };
  }, [valid]);

  const days = period === "7" ? 7 : period === "30" ? 30 : period === "90" ? 90 : 30;
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number }> = {};
    for (let i = days - 1; i >= 0; i--) { const d = format(subDays(new Date(), i), "dd/MM"); map[d] = { date: d, revenue: 0 }; }
    valid.forEach(o => { const d = format(new Date(o.created_at), "dd/MM"); if (map[d]) map[d].revenue += o.commission; });
    return Object.values(map);
  }, [valid, days]);

  const pills: { key: Period; label: string }[] = [{ key: "7", label: "7D" }, { key: "30", label: "30D" }, { key: "90", label: "90D" }, { key: "all", label: "All" }];
  const cards = [{ label: "Hôm nay", val: bd.today }, { label: "7 ngày", val: bd.week }, { label: "30 ngày", val: bd.month }, { label: "Tổng", val: bd.all }];

  return (
    <div className="space-y-5">
      {/* Period pills */}
      <div className="flex gap-1 bg-accent p-1 rounded-lg w-fit border border-border/50">
        {pills.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >{p.label}</button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <Card key={i} className="dash-card dash-card-hover">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
              <p className="text-lg font-bold text-foreground">{c.val.toLocaleString("vi-VN")}đ</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="dash-card lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="dash-section-title mb-4">Biểu đồ doanh thu</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={Math.max(0, Math.floor(days / 10) - 1)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${v.toLocaleString("vi-VN")}đ`, "Doanh thu"]} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revGrad2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="dash-card dash-card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bd.growth >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {bd.growth >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tăng trưởng tuần</p>
                <p className={`text-xl font-bold ${bd.growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {bd.growth >= 0 ? "+" : ""}{bd.growth}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="dash-card dash-card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tổng doanh thu</p>
                <p className="text-xl font-bold text-foreground">{bd.all.toLocaleString("vi-VN")}đ</p>
                <p className="text-[11px] text-muted-foreground">{valid.length} đơn TC</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table */}
      <Card className="dash-card">
        <CardContent className="p-5">
          <h3 className="dash-section-title mb-4">Chi tiết giao dịch</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                  <th className="text-left py-2 font-medium">Sản phẩm</th>
                  <th className="text-right py-2 font-medium">Giá</th>
                  <th className="text-right py-2 font-medium">Hoa hồng</th>
                  <th className="text-center py-2 font-medium">TT</th>
                  <th className="text-right py-2 font-medium">Ngày</th>
                </tr>
              </thead>
              <tbody>
                {(!orders || !orders.length) ? <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Chưa có giao dịch</td></tr>
                : orders.slice(0, 15).map((o: any, idx: number) => (
                  <tr key={`${o.created_at}-${idx}`} className="border-b border-border/30 last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="py-2 text-xs text-foreground truncate max-w-[140px]">{o.ctv_listings?.title ?? "—"}</td>
                    <td className="text-right text-xs text-muted-foreground">{(o.amount ?? 0).toLocaleString("vi-VN")}đ</td>
                    <td className="text-right text-xs text-primary font-medium">{(o.commission ?? 0).toLocaleString("vi-VN")}đ</td>
                    <td className="text-center">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${o.status === "refunded" ? "bg-orange-500/10 text-orange-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                        {o.status === "refunded" ? "Hoàn" : "TC"}
                      </span>
                    </td>
                    <td className="text-right text-[11px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM HH:mm")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
