import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Package, Search, Eye, Edit, ImageIcon, Rocket, ArrowRight, BookOpen } from "lucide-react";

const statusCfg: Record<string, { label: string; cls: string }> = {
  pending_review: { label: "Chờ duyệt", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  approved: { label: "Đang bán", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  rejected: { label: "Từ chối", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  suspended: { label: "Tạm dừng", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  sold_out: { label: "Hết hàng", cls: "bg-muted text-muted-foreground border-border" },
};

interface Props { userId: string; onAddNew: () => void; }

export const CTVListings = ({ userId, onAddNew }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["ctv-listings", userId],
    queryFn: async () => {
      const { data } = await supabase.from("ctv_listings").select("*").eq("ctv_user_id", userId).order("created_at", { ascending: false });
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

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Tổng", value: counts.total, color: "text-foreground" },
          { label: "Đang bán", value: counts.active, color: "text-emerald-400" },
          { label: "Chờ duyệt", value: counts.pending, color: "text-yellow-400" },
          { label: "Từ chối", value: counts.rejected, color: "text-red-400" },
        ].map((s, i) => (
          <Card key={i} className="dash-card">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="approved">Đang bán</SelectItem>
              <SelectItem value="pending_review">Chờ duyệt</SelectItem>
              <SelectItem value="rejected">Từ chối</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={onAddNew} className="h-9 dash-glow-btn">
          <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Thêm SP
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3].map(i => (
            <Card key={i} className="dash-card animate-pulse">
              <CardContent className="p-0">
                <div className="aspect-video bg-accent" />
                <div className="p-4 space-y-2"><div className="h-4 bg-accent rounded w-3/4" /><div className="h-3 bg-accent rounded w-1/2" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filtered.length ? (
        <Card className="dash-card border-dashed">
          <CardContent className="py-16 text-center space-y-5">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Rocket className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Chưa có sản phẩm nào</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Tạo sản phẩm đầu tiên để bắt đầu kiếm tiền.</p>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              {["Tạo sản phẩm", "Admin duyệt", "Kiếm tiền"].map((s, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {i > 0 && <ArrowRight className="h-3 w-3 text-border" />}
                  <span className="px-2 py-1 rounded-md bg-accent border border-border/50">{s}</span>
                </span>
              ))}
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <Button onClick={onAddNew} className="dash-glow-btn"><PlusCircle className="h-4 w-4 mr-1.5" /> Tạo sản phẩm</Button>
              <Button variant="outline" size="sm"><BookOpen className="h-3.5 w-3.5 mr-1" /> Hướng dẫn</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(l => {
            const st = statusCfg[l.status] ?? { label: l.status, cls: "bg-muted text-muted-foreground" };
            return (
              <Card key={l.id} className="dash-card dash-card-hover overflow-hidden group">
                <CardContent className="p-0">
                  <div className="aspect-video bg-accent/50 relative overflow-hidden">
                    {l.thumbnail_url ? (
                      <img src={l.thumbnail_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/10" /></div>
                    )}
                    <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <h3 className="font-semibold text-foreground text-sm truncate">{l.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-primary font-bold text-sm">{l.price.toLocaleString("vi-VN")}đ</span>
                      <span className="text-[11px] text-muted-foreground">{l.total_sold} đã bán</span>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px]"><Eye className="h-3 w-3 mr-1" />Xem</Button>
                      <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px]"><Edit className="h-3 w-3 mr-1" />Sửa</Button>
                      <Button variant="outline" size="sm" className="h-7 text-[11px] px-2"><Package className="h-3 w-3" /></Button>
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
