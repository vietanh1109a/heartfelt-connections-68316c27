import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Clock, Wallet, AlertTriangle } from "lucide-react";

interface Props {
  profile: {
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

  const stats = [
    {
      label: "Tổng doanh thu",
      value: `${profile.total_sales.toLocaleString("vi-VN")}đ`,
      sub: `${profile.total_orders} đơn thành công`,
      icon: <DollarSign className="h-5 w-5" />,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Chờ duyệt",
      value: `${profile.pending_balance.toLocaleString("vi-VN")}đ`,
      sub: "Đang trong thời gian bảo hành",
      icon: <Clock className="h-5 w-5" />,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      label: "Khả dụng",
      value: `${profile.available_balance.toLocaleString("vi-VN")}đ`,
      sub: "Có thể rút",
      icon: <Wallet className="h-5 w-5" />,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Tỉ lệ hoàn",
      value: `${refundRate}%`,
      sub: `${profile.refund_count} đơn hoàn`,
      icon: <AlertTriangle className="h-5 w-5" />,
      color: parseFloat(refundRate) > 10 ? "text-destructive" : "text-muted-foreground",
      bg: parseFloat(refundRate) > 10 ? "bg-destructive/10" : "bg-muted/50",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Tổng quan</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map((s, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${s.bg} ${s.color}`}>
                  {s.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
