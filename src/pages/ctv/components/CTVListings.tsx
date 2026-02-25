import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Package, Search, Eye, Edit, ImageIcon, Rocket, ArrowRight, BookOpen, Zap } from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending_review: { label: "Chờ duyệt", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  approved: { label: "Đang bán", className: "bg-green-500/10 text-green-400 border-green-500/20" },
  rejected: { label: "Từ chối", className: "bg-destructive/10 text-destructive border-destructive/20" },
  suspended: { label: "Tạm dừng", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  sold_out: { label: "Hết hàng", className: "bg-secondary text-muted-foreground border-border" },
};

interface Props {
  userId: string;
  onAddNew: () => void;
}

export const CTVListings = ({ userId, onAddNew }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filtered = useMemo(() => {
    if (!listings) return [];
    return listings.filter(l => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search && !l.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [listings, search, statusFilter]);

  const counts = useMemo(() => {
    if (!listings) return { total: 0, active: 0, pending: 0, rejected: 0 };
    return {
      total: listings.length,
      active: listings.filter(l => l.status === "approved").length,
      pending: listings.filter(l => l.status === "pending_review").length,
      rejected: listings.filter(l => l.status === "rejected").length,
    };
  }, [listings]);

  const miniStats = [
    { label: "Tổng SP", value: counts.total, color: "text-foreground" },
    { label: "Đang bán", value: counts.active, color: "text-green-400" },
    { label: "Chờ duyệt", value: counts.pending, color: "text-yellow-400" },
    { label: "Từ chối", value: counts.rejected, color: "text-destructive" },
  ];

  return (
    <div className="space-y-4">
      {/* Mini Stats */}
      <div className="grid grid-cols-4 gap-2">
        {miniStats.map((s, i) => (
          <Card key={i} className="ctv-card ctv-card-hover">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 rounded-xl">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="approved">Đang bán</SelectItem>
              <SelectItem value="pending_review">Chờ duyệt</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
              <SelectItem value="suspended">Tạm dừng</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={onAddNew} className="h-9 rounded-xl ctv-glow-btn">
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Thêm SP
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => (
            <Card key={i} className="ctv-card animate-pulse">
              <CardContent className="p-0">
                <div className="aspect-video bg-accent/50 rounded-t-2xl" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-accent rounded w-3/4" />
                  <div className="h-3 bg-accent rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filtered.length ? (
        /* Enhanced empty state with motivation */
        <div className="relative rounded-2xl border border-dashed border-border/30 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(240 6% 10%), hsl(357 92% 47% / 0.04))" }}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(357_92%_47%_/_0.06),transparent_70%)]" />
          <div className="relative py-14 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-foreground">🔥 Bắt đầu kiếm tiền ngay!</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                "Sản phẩm đầu tiên quyết định 80% doanh thu của bạn"
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {[
                { step: "1", text: "Tạo sản phẩm", icon: Package },
                { step: "2", text: "Admin duyệt", icon: Zap },
                { step: "3", text: "Kiếm tiền", icon: Rocket },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/50 border border-border/20 text-[11px]">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px]">{s.step}</span>
                    <span className="text-foreground font-medium">{s.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button onClick={onAddNew} className="ctv-glow-btn rounded-xl">
                <PlusCircle className="h-4 w-4 mr-1.5" /> Tạo sản phẩm ngay
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl text-xs border-border/30 hover:border-border/50">
                <BookOpen className="h-3.5 w-3.5 mr-1" /> Hướng dẫn
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((l) => {
            const st = statusConfig[l.status] ?? { label: l.status, className: "bg-secondary text-muted-foreground" };
            return (
              <Card key={l.id} className="ctv-card ctv-card-hover overflow-hidden group">
                <CardContent className="p-0">
                  <div className="aspect-video bg-accent/20 relative overflow-hidden rounded-t-2xl">
                    {l.thumbnail_url ? (
                      <img src={l.thumbnail_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground/10" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm truncate">{l.title}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {l.category === "account" ? "Tài khoản" : l.category === "key" ? "Key" : l.category === "service" ? "Dịch vụ" : "Khác"}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold text-sm">{l.price.toLocaleString("vi-VN")}đ</span>
                      <span className="text-[10px] text-muted-foreground">Bán: {l.total_sold}</span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] rounded-lg border-border/30">
                        <Eye className="h-3 w-3 mr-1" /> Xem
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] rounded-lg border-border/30">
                        <Edit className="h-3 w-3 mr-1" /> Sửa
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg px-2 border-border/30">
                        <Package className="h-3 w-3" />
                      </Button>
                    </div>
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
