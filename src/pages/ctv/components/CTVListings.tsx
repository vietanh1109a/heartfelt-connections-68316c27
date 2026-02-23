import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Package } from "lucide-react";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_review: { label: "Chờ duyệt", variant: "secondary" },
  approved: { label: "Đã duyệt", variant: "default" },
  rejected: { label: "Từ chối", variant: "destructive" },
  suspended: { label: "Tạm dừng", variant: "destructive" },
  sold_out: { label: "Hết hàng", variant: "outline" },
};

interface Props {
  userId: string;
  onAddNew: () => void;
}

export const CTVListings = ({ userId, onAddNew }: Props) => {
  const { data: listings, isLoading } = useQuery({
    queryKey: ["ctv-listings", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_listings")
        .select("*")
        .eq("ctv_user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Sản phẩm của tôi</h2>
        <Button size="sm" onClick={onAddNew}>
          <PlusCircle className="h-4 w-4 mr-1" /> Thêm SP
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground animate-pulse py-8 text-center">Đang tải...</div>
      ) : !listings?.length ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-3">
            <Package className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Chưa có sản phẩm nào</p>
            <Button size="sm" variant="outline" onClick={onAddNew}>Thêm sản phẩm đầu tiên</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_80px_60px_100px_70px] gap-3 px-4 text-xs font-semibold text-muted-foreground uppercase">
            <span>Tên SP</span>
            <span className="text-right">Giá</span>
            <span className="text-center">Đã bán</span>
            <span className="text-center">Trạng thái</span>
            <span className="text-center">Lỗi</span>
          </div>

          {listings.map((l) => {
            const st = statusMap[l.status] ?? { label: l.status, variant: "outline" as const };
            const errorRate = l.total_sold > 0 ? ((l.refund_count / l.total_sold) * 100).toFixed(0) : "0";
            return (
              <Card key={l.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="md:grid md:grid-cols-[1fr_80px_60px_100px_70px] md:gap-3 md:items-center space-y-2 md:space-y-0">
                    <div>
                      <p className="font-medium text-foreground text-sm">{l.title}</p>
                      <p className="text-xs text-muted-foreground">{l.category}</p>
                    </div>
                    <p className="text-sm text-foreground text-right font-semibold">{l.price.toLocaleString("vi-VN")}đ</p>
                    <p className="text-sm text-muted-foreground text-center">{l.total_sold}</p>
                    <div className="text-center">
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </div>
                    <p className={`text-sm text-center font-medium ${parseFloat(errorRate) > 10 ? "text-destructive" : "text-muted-foreground"}`}>
                      {errorRate}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
