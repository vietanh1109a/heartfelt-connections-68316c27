import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { format } from "date-fns";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Đã thanh toán", variant: "default" },
  delivered: { label: "Đã giao", variant: "default" },
  refunded: { label: "Hoàn tiền", variant: "destructive" },
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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Đơn hàng</h2>

      {isLoading ? (
        <div className="text-muted-foreground animate-pulse py-8 text-center">Đang tải...</div>
      ) : !orders?.length ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-3">
            <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có đơn hàng nào</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="hidden md:grid grid-cols-[1fr_80px_80px_100px_100px] gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
            <span>Sản phẩm</span>
            <span className="text-right">Giá</span>
            <span className="text-right">Bạn nhận</span>
            <span className="text-center">Trạng thái</span>
            <span className="text-right">Ngày</span>
          </div>

          {orders.map((o: any) => {
            const st = statusMap[o.status] ?? { label: o.status, variant: "outline" as const };
            return (
              <Card key={o.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="md:grid md:grid-cols-[1fr_80px_80px_100px_100px] md:gap-3 md:items-center space-y-2 md:space-y-0">
                    <div>
                      <p className="font-medium text-foreground text-sm">{o.ctv_listings?.title ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{o.id.slice(0, 8)}</p>
                    </div>
                    <p className="text-sm text-foreground text-right">{o.price.toLocaleString("vi-VN")}đ</p>
                    <p className="text-sm text-primary text-right font-semibold">{o.ctv_earning.toLocaleString("vi-VN")}đ</p>
                    <div className="text-center">
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {format(new Date(o.created_at), "dd/MM/yy HH:mm")}
                    </p>
                  </div>
                  {o.status !== "refunded" && (
                    <p className="text-xs text-muted-foreground mt-2 md:mt-1">
                      Phí nền tảng: {o.platform_fee.toLocaleString("vi-VN")}đ • Bạn nhận: <span className="text-primary font-medium">{o.ctv_earning.toLocaleString("vi-VN")}đ</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
