import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatCurrency";
import { format } from "date-fns";
import {
  Users, Clock, CheckCircle, XCircle, Ban, ShieldCheck, Eye,
  Percent, Search, UserPlus, DollarSign, ShoppingCart, TrendingUp, Unlock, Trash2,
} from "lucide-react";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "banned";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  pending: { label: "Chờ duyệt", variant: "secondary", color: "text-yellow-500" },
  approved: { label: "Đã duyệt", variant: "default", color: "text-green-500" },
  rejected: { label: "Từ chối", variant: "destructive", color: "text-red-500" },
  banned: { label: "Bị khóa", variant: "destructive", color: "text-red-600" },
};

export const CTVManagementTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedCTV, setSelectedCTV] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; ctv: any } | null>(null);
  const [reason, setReason] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [processing, setProcessing] = useState(false);

  // Fetch all CTV profiles
  const { data: ctvProfiles, isLoading } = useQuery({
    queryKey: ["admin-ctv-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctv_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch CTV registrations for extra info
  const { data: ctvRegistrations } = useQuery({
    queryKey: ["admin-ctv-registrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_registrations")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch orders for selected CTV
  const { data: ctvOrders } = useQuery({
    queryKey: ["admin-ctv-orders", selectedCTV?.user_id],
    queryFn: async () => {
      if (!selectedCTV) return [];
      const { data } = await supabase
        .from("ctv_orders")
        .select("*")
        .eq("ctv_user_id", selectedCTV.user_id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!selectedCTV,
  });

  // Fetch listings for selected CTV
  const { data: ctvListings } = useQuery({
    queryKey: ["admin-ctv-listings-detail", selectedCTV?.user_id],
    queryFn: async () => {
      if (!selectedCTV) return [];
      const { data } = await supabase
        .from("ctv_listings")
        .select("*")
        .eq("ctv_user_id", selectedCTV.user_id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!selectedCTV,
  });

  // Log audit
  const logAudit = async (action: string, targetUserId?: string, details?: any) => {
    if (!user) return;
    await supabase.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action,
      target_user_id: targetUserId ?? null,
      details: details ?? null,
    });
  };

  // Stats
  const stats = {
    pending: ctvProfiles?.filter(c => c.status === "pending").length ?? 0,
    approved: ctvProfiles?.filter(c => c.status === "approved").length ?? 0,
    totalOrders: 0,
    totalCommission: ctvProfiles?.reduce((sum, c) => sum + (c.balance ?? 0), 0) ?? 0,
  };

  // Filter & search
  const filtered = (ctvProfiles ?? [])
    .filter(c => statusFilter === "all" || c.status === statusFilter)
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.display_name?.toLowerCase().includes(q) ||
        c.user_id?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      );
    })
    // Pending first, then by created_at desc
    .sort((a, b) => {
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (b.status === "pending" && a.status !== "pending") return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Actions
  const handleApprove = async (ctv: any) => {
    setProcessing(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({ status: "approved" })
      .eq("user_id", ctv.user_id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      // Also update registration status
      await supabase.from("ctv_registrations").update({ status: "approved" }).eq("user_id", ctv.user_id);
      await logAudit("ctv_approve", ctv.user_id);
      toast({ title: "Đã duyệt CTV: " + ctv.display_name });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    }
    setProcessing(false);
    setActionDialog(null);
  };

  const handleReject = async (ctv: any) => {
    if (!reason.trim()) {
      toast({ title: "Vui lòng nhập lý do từ chối", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({ status: "rejected" })
      .eq("user_id", ctv.user_id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("ctv_registrations").update({ status: "rejected" }).eq("user_id", ctv.user_id);
      await logAudit("ctv_reject", ctv.user_id, { reason: reason.trim() });
      toast({ title: "Đã từ chối CTV: " + ctv.display_name });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    }
    setProcessing(false);
    setActionDialog(null);
    setReason("");
  };

  const handleBan = async (ctv: any) => {
    setProcessing(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({ status: "banned" })
      .eq("user_id", ctv.user_id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("ctv_registrations").update({ status: "banned" }).eq("user_id", ctv.user_id);
      await logAudit("ctv_ban", ctv.user_id, { reason: reason.trim() || null });
      toast({ title: "Đã khóa CTV: " + ctv.display_name });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    }
    setProcessing(false);
    setActionDialog(null);
    setReason("");
  };

  const handleUnban = async (ctv: any) => {
    setProcessing(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({ status: "approved" })
      .eq("user_id", ctv.user_id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      await supabase.from("ctv_registrations").update({ status: "approved" }).eq("user_id", ctv.user_id);
      await logAudit("ctv_unban", ctv.user_id);
      toast({ title: "Đã mở khóa CTV: " + ctv.display_name });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    }
    setProcessing(false);
    setActionDialog(null);
  };

  const handleUpdateCommission = async (ctv: any) => {
    const rate = parseInt(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast({ title: "% hoa hồng không hợp lệ (0-100)", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({ commission_rate: rate })
      .eq("user_id", ctv.user_id);
    if (error) {
      toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    } else {
      await logAudit("ctv_update_commission", ctv.user_id, { old_rate: ctv.commission_rate, new_rate: rate });
      toast({ title: `Đã cập nhật hoa hồng ${ctv.display_name}: ${rate}%` });
      queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    }
    setProcessing(false);
    setActionDialog(null);
    setCommissionRate("");
  };

  const handleDelete = async (ctv: any) => {
    setProcessing(true);
    // Delete related data first to avoid FK violations
    await supabase.from("ctv_listing_items").delete().eq("ctv_user_id", ctv.user_id);
    await supabase.from("ctv_orders").delete().eq("ctv_user_id", ctv.user_id);
    await supabase.from("ctv_listings").delete().eq("ctv_user_id", ctv.user_id);
    await supabase.from("ctv_payout_requests").delete().eq("ctv_user_id", ctv.user_id);
    const { error: profileErr } = await supabase.from("ctv_profiles").delete().eq("user_id", ctv.user_id);
    if (profileErr) {
      toast({ title: "Lỗi xóa CTV profile", description: profileErr.message, variant: "destructive" });
      setProcessing(false);
      setActionDialog(null);
      return;
    }
    await supabase.from("ctv_registrations").delete().eq("user_id", ctv.user_id);
    await logAudit("ctv_delete", ctv.user_id, { display_name: ctv.display_name });
    toast({ title: "Đã xóa CTV: " + ctv.display_name });
    queryClient.invalidateQueries({ queryKey: ["admin-ctv-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-ctv-registrations"] });
    setProcessing(false);
    setActionDialog(null);
    setSelectedCTV(null);
  };

  const getRegistration = (userId: string) => ctvRegistrations?.find(r => r.user_id === userId);

  if (isLoading) return <div className="text-muted-foreground animate-pulse py-8 text-center">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" /> Quản lý Cộng tác viên
      </h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="h-5 w-5 text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Chờ duyệt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="h-5 w-5 text-green-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Đã duyệt</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
              <p className="text-xs text-muted-foreground">Tổng đơn CTV</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalCommission)}</p>
              <p className="text-xs text-muted-foreground">Tổng hoa hồng</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tên, user_id, SĐT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
            <SelectItem value="banned">Bị khóa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CTV Table */}
      {!filtered.length ? (
        <p className="text-muted-foreground text-sm text-center py-8">Không có CTV nào.</p>
      ) : (
        <div className="rounded-lg border border-border/50 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CTV</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">% HH</TableHead>
                <TableHead className="text-right">Đơn</TableHead>
                <TableHead className="text-right">Doanh thu</TableHead>
                <TableHead className="text-right">Hoa hồng</TableHead>
                <TableHead>Ngày ĐK</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ctv => {
                const st = statusConfig[ctv.status] ?? statusConfig.pending;
                const totalCommission = ctv.balance ?? 0;
                return (
                  <TableRow key={ctv.id} className={ctv.status === "pending" ? "bg-yellow-500/5" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground text-sm">{ctv.display_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ctv.user_id.slice(0, 8)}...</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-sm">{ctv.commission_rate}%</TableCell>
                    <TableCell className="text-right text-sm">{(ctv as any).total_sold ?? 0}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(ctv.total_earned ?? 0)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(totalCommission)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ctv.created_at), "dd/MM/yy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedCTV(ctv)}>
                          <Eye className="h-3 w-3 mr-1" /> Xem
                        </Button>
                        {ctv.status === "pending" && (
                          <>
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleApprove(ctv)} disabled={processing}>
                              <CheckCircle className="h-3 w-3 mr-1" /> Duyệt
                            </Button>
                            <Button variant="destructive" size="sm" className="h-7 text-xs"
                              onClick={() => { setActionDialog({ type: "reject", ctv }); setReason(""); }}>
                              <XCircle className="h-3 w-3 mr-1" /> Từ chối
                            </Button>
                          </>
                        )}
                        {ctv.status === "approved" && (
                          <>
                            <Button variant="outline" size="sm" className="h-7 text-xs"
                              onClick={() => { setActionDialog({ type: "commission", ctv }); setCommissionRate(String(ctv.commission_rate)); }}>
                              <Percent className="h-3 w-3 mr-1" /> HH
                            </Button>
                            <Button variant="destructive" size="sm" className="h-7 text-xs"
                              onClick={() => { setActionDialog({ type: "ban", ctv }); setReason(""); }}>
                              <Ban className="h-3 w-3 mr-1" /> Khóa
                            </Button>
                          </>
                        )}
                        {ctv.status === "rejected" && (
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleApprove(ctv)} disabled={processing}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Duyệt lại
                          </Button>
                        )}
                        {ctv.status === "banned" && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleUnban(ctv)} disabled={processing}>
                            <Unlock className="h-3 w-3 mr-1" /> Mở khóa
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setActionDialog({ type: "delete", ctv })}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedCTV} onOpenChange={open => !open && setSelectedCTV(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Chi tiết CTV: {selectedCTV?.display_name}
            </DialogTitle>
          </DialogHeader>
          {selectedCTV && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">User ID:</span> <span className="text-foreground font-mono text-xs">{selectedCTV.user_id}</span></div>
                <div><span className="text-muted-foreground">Trạng thái:</span> <Badge variant={statusConfig[selectedCTV.status]?.variant ?? "outline"} className="ml-1 text-xs">{statusConfig[selectedCTV.status]?.label ?? selectedCTV.status}</Badge></div>
                <div><span className="text-muted-foreground">Liên hệ:</span> <span className="text-foreground">{selectedCTV.contact_info || "—"}</span></div>
                <div><span className="text-muted-foreground">Hoa hồng:</span> <span className="text-foreground font-semibold">{selectedCTV.commission_rate}%</span></div>
                <div><span className="text-muted-foreground">Ngân hàng:</span> <span className="text-foreground">{selectedCTV.bank_name ? `${selectedCTV.bank_name} - ${selectedCTV.bank_account} - ${selectedCTV.bank_holder}` : "Chưa cập nhật"}</span></div>
                <div><span className="text-muted-foreground">Ngày ĐK:</span> <span className="text-foreground">{format(new Date(selectedCTV.created_at), "dd/MM/yyyy HH:mm")}</span></div>
                {(() => {
                  const reg = getRegistration(selectedCTV.user_id);
                  return reg?.bank_info ? (
                    <div className="col-span-2"><span className="text-muted-foreground">Bank info (đăng ký):</span> <span className="text-foreground">{reg.bank_info}</span></div>
                  ) : null;
                })()}
              </div>

              {/* Performance */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Hiệu suất
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{selectedCTV.total_orders}</p>
                      <p className="text-xs text-muted-foreground">Tổng đơn</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(selectedCTV.total_sales)}</p>
                      <p className="text-xs text-muted-foreground">Doanh thu</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(selectedCTV.available_balance)}</p>
                      <p className="text-xs text-muted-foreground">Khả dụng</p>
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold text-foreground">{formatCurrency(selectedCTV.pending_balance)}</p>
                      <p className="text-xs text-muted-foreground">Chờ duyệt</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Listings */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Sản phẩm đã đăng ({ctvListings?.length ?? 0})</h4>
                {ctvListings?.length ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {ctvListings.map(l => (
                      <div key={l.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded-lg px-3 py-2">
                        <span className="text-foreground font-medium">{l.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{formatCurrency(l.price)}</span>
                          <Badge variant={l.status === "approved" ? "default" : "secondary"} className="text-[10px]">{l.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Chưa có sản phẩm</p>
                )}
              </div>

              {/* Recent Orders */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Đơn hàng gần đây ({ctvOrders?.length ?? 0})</h4>
                {ctvOrders?.length ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {ctvOrders.slice(0, 20).map(o => (
                      <div key={o.id} className="flex items-center justify-between text-xs bg-secondary/30 rounded-lg px-3 py-2">
                        <span className="text-foreground font-mono">{o.id.slice(0, 8)}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-foreground">{formatCurrency(o.amount)}</span>
                          <span className="text-primary">{formatCurrency(o.commission)}</span>
                          <Badge variant={o.status === "completed" ? "default" : o.status === "refunded" ? "destructive" : "secondary"} className="text-[10px]">
                            {o.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Chưa có đơn hàng</p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                {selectedCTV.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => handleApprove(selectedCTV)} disabled={processing}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Duyệt
                    </Button>
                    <Button variant="destructive" size="sm"
                      onClick={() => { setActionDialog({ type: "reject", ctv: selectedCTV }); setReason(""); }}>
                      <XCircle className="h-3 w-3 mr-1" /> Từ chối
                    </Button>
                  </>
                )}
                {selectedCTV.status === "approved" && (
                  <>
                    <Button variant="outline" size="sm"
                      onClick={() => { setActionDialog({ type: "commission", ctv: selectedCTV }); setCommissionRate(String(selectedCTV.commission_rate)); }}>
                      <Percent className="h-3 w-3 mr-1" /> Chỉnh % HH
                    </Button>
                    <Button variant="destructive" size="sm"
                      onClick={() => { setActionDialog({ type: "ban", ctv: selectedCTV }); setReason(""); }}>
                      <Ban className="h-3 w-3 mr-1" /> Khóa
                    </Button>
                  </>
                )}
                {selectedCTV.status === "rejected" && (
                  <Button size="sm" onClick={() => handleApprove(selectedCTV)} disabled={processing}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Duyệt lại
                  </Button>
                )}
                {selectedCTV.status === "banned" && (
                  <Button variant="outline" size="sm" onClick={() => handleUnban(selectedCTV)} disabled={processing}>
                    <Unlock className="h-3 w-3 mr-1" /> Mở khóa
                  </Button>
                )}
                <Button variant="destructive" size="sm"
                  onClick={() => setActionDialog({ type: "delete", ctv: selectedCTV })}>
                  <Trash2 className="h-3 w-3 mr-1" /> Xóa CTV
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog?.type === "reject"} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối CTV: {actionDialog?.ctv?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Lý do từ chối <span className="text-destructive">*</span></label>
            <Textarea placeholder="Nhập lý do từ chối..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => handleReject(actionDialog!.ctv)} disabled={processing}>
              {processing ? "Đang xử lý..." : "Từ chối"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban Dialog */}
      <Dialog open={actionDialog?.type === "ban"} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khóa CTV: {actionDialog?.ctv?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Lý do khóa (tuỳ chọn)</label>
            <Textarea placeholder="Nhập lý do..." value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => handleBan(actionDialog!.ctv)} disabled={processing}>
              {processing ? "Đang xử lý..." : "Khóa CTV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Dialog */}
      <Dialog open={actionDialog?.type === "commission"} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh % hoa hồng: {actionDialog?.ctv?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">% Hoa hồng mới</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={commissionRate}
                onChange={e => setCommissionRate(e.target.value)}
                className="w-24"
              />
              <span className="text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground">Hiện tại: {actionDialog?.ctv?.commission_rate}%</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button onClick={() => handleUpdateCommission(actionDialog!.ctv)} disabled={processing}>
              {processing ? "Đang xử lý..." : "Cập nhật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={actionDialog?.type === "delete"} onOpenChange={open => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Xóa CTV: {actionDialog?.ctv?.display_name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Thao tác này sẽ xóa toàn bộ dữ liệu CTV bao gồm profile, đăng ký, sản phẩm, đơn hàng và yêu cầu rút tiền. <strong className="text-foreground">Không thể hoàn tác.</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => handleDelete(actionDialog!.ctv)} disabled={processing}>
              {processing ? "Đang xóa..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
