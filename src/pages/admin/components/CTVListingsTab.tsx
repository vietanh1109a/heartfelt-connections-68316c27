import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_review: { label: "Chờ duyệt", variant: "secondary" },
  approved: { label: "Đã duyệt", variant: "default" },
  rejected: { label: "Từ chối", variant: "destructive" },
  suspended: { label: "Tạm dừng", variant: "destructive" },
};

export const CTVListingsTab = () => {
  const queryClient = useQueryClient();
  const [selectedListing, setSelectedListing] = useState<any>(null);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin-ctv-listings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_listings")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("ctv_listings")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Đã ${status === "approved" ? "duyệt" : "từ chối"} sản phẩm` });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-listings"] });
    }
  };

  // Fetch items for detail view
  const { data: listingItems } = useQuery({
    queryKey: ["admin-ctv-listing-items", selectedListing?.id],
    queryFn: async () => {
      if (!selectedListing) return [];
      const { data } = await supabase
        .from("ctv_listing_items")
        .select("*")
        .eq("listing_id", selectedListing.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedListing,
  });

  if (isLoading) return <div className="text-muted-foreground animate-pulse py-8 text-center">Đang tải...</div>;

  const pendingCount = listings?.filter(l => l.status === "pending_review").length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-foreground">Sản phẩm CTV</h2>
        {pendingCount > 0 && (
          <Badge variant="secondary" className="text-xs">{pendingCount} chờ duyệt</Badge>
        )}
      </div>

      {!listings?.length ? (
        <p className="text-muted-foreground text-sm">Chưa có sản phẩm CTV nào.</p>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => {
            const st = statusMap[l.status] ?? { label: l.status, variant: "outline" as const };
            return (
              <Card key={l.id} className={`border-border/50 ${l.status === "pending_review" ? "border-yellow-500/30 bg-yellow-500/5" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    {l.thumbnail_url && (
                      <img
                        src={l.thumbnail_url}
                        alt={l.title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0 border border-border/30"
                      />
                    )}

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm">{l.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.category} • {l.price.toLocaleString("vi-VN")}đ • CTV: {l.ctv_user_id.slice(0, 8)}
                          </p>
                        </div>
                        <Badge variant={st.variant} className="text-xs shrink-0">{st.label}</Badge>
                      </div>

                      {l.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{l.description}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedListing(l)}>
                          <Eye className="h-3 w-3 mr-1" /> Chi tiết
                        </Button>
                        {l.status === "pending_review" && (
                          <>
                            <Button size="sm" className="h-7 text-xs" onClick={() => updateStatus(l.id, "approved")}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Duyệt
                            </Button>
                            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => updateStatus(l.id, "rejected")}>
                              <XCircle className="h-3 w-3 mr-1" /> Từ chối
                            </Button>
                          </>
                        )}
                        {l.status === "approved" && (
                          <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => updateStatus(l.id, "suspended")}>
                            Tạm dừng
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedListing} onOpenChange={(open) => !open && setSelectedListing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedListing?.title}</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              {selectedListing.thumbnail_url && (
                <img src={selectedListing.thumbnail_url} alt="" className="w-full rounded-lg border border-border/30" />
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Loại:</span> <span className="text-foreground">{selectedListing.category}</span></div>
                <div><span className="text-muted-foreground">Giá:</span> <span className="text-foreground font-semibold">{selectedListing.price.toLocaleString("vi-VN")}đ</span></div>
                <div><span className="text-muted-foreground">Đã bán:</span> <span className="text-foreground">{selectedListing.total_sold}</span></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> <span className="text-foreground">{format(new Date(selectedListing.created_at), "dd/MM/yy")}</span></div>
              </div>
              {selectedListing.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mô tả:</p>
                  <p className="text-sm text-foreground">{selectedListing.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stock ({listingItems?.length ?? 0} items):</p>
                <div className="max-h-40 overflow-y-auto bg-secondary/30 rounded-lg p-3 space-y-1">
                  {listingItems?.length ? listingItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-xs font-mono">
                      <span className="text-foreground truncate flex-1">{item.content}</span>
                      <Badge variant={item.is_sold ? "destructive" : "outline"} className="text-[10px] ml-2 shrink-0">
                        {item.is_sold ? "Đã bán" : "Còn"}
                      </Badge>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">Không có items</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
