import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Search, Ban, ShieldOff, ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DollarSign, ArrowLeft, Crown, Star } from "lucide-react";

export function UsersTab() {
  const queryClient = useQueryClient();
  const { user: adminUser } = useAuth();

  const [editUser, setEditUser] = useState<any>(null);
  const [viewUser, setViewUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditMemo, setCreditMemo] = useState("");
  const [grantVipUser, setGrantVipUser] = useState<any>(null);
  const [vipDays, setVipDays] = useState("30");
  const [grantingVip, setGrantingVip] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  // Ban state
  const [banUser, setBanUser] = useState<any>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("24");
  const [banPermanent, setBanPermanent] = useState(false);
  const [banning, setBanning] = useState(false);

  // Grant cookie state
  const [grantCookieUser, setGrantCookieUser] = useState<any>(null);
  const [grantingCookie, setGrantingCookie] = useState(false);

  const { data: adminRoles } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data ?? [];
    },
  });

  const getUserRoles = (userId: string): string[] =>
    (adminRoles ?? []).filter((r: { user_id: string; role: string }) => r.user_id === userId).map((r: { role: string }) => r.role);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users", page, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (searchQuery.trim()) {
        query = query.ilike("display_name", `%${searchQuery.trim()}%`);
      }

      const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return { users: data ?? [], total: count ?? 0 };
    },
  });

  const { data: activeBans } = useQuery({
    queryKey: ["admin-active-bans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_bans")
        .select("*")
        .or(`expires_at.gt.${new Date().toISOString()},is_permanent.eq.true`);
      return data ?? [];
    },
  });




  const users = usersData?.users ?? [];
  const totalUsers = usersData?.total ?? 0;
  const totalPages = Math.ceil(totalUsers / PAGE_SIZE);

  // Sort: admins và moderators lên đầu
  const sortedUsers = [...users].sort((a, b) => {
    const aRoles = getUserRoles(a.user_id);
    const bRoles = getUserRoles(b.user_id);
    const aIsAdmin = aRoles.includes("admin");
    const bIsAdmin = bRoles.includes("admin");
    const aIsMod = aRoles.includes("moderator");
    const bIsMod = bRoles.includes("moderator");
    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;
    if (aIsMod && !bIsMod) return -1;
    if (!aIsMod && bIsMod) return 1;
    return 0;
  });

  const isUserVip = (u: any) => u.vip_expires_at && new Date(u.vip_expires_at) > new Date();
  const isUserBanned = (userId: string) => activeBans?.some((b) => b.user_id === userId) ?? false;

  const { data: userTransactions } = useQuery({
    queryKey: ["admin-user-transactions", viewUser?.user_id],
    queryFn: async () => {
      if (!viewUser) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", viewUser.user_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!viewUser,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logAudit = async (action: string, targetUserId?: string, details?: any) => {
    if (!adminUser) return;
    await supabase.from("admin_audit_logs").insert({
      admin_user_id: adminUser.id,
      action,
      target_user_id: targetUserId ?? null,
      details: details ?? null,
    });
  };


  const handleBanUser = async () => {
    if (!banUser || !banReason.trim()) { toast.error("Vui lòng nhập lý do ban"); return; }
    if (!adminUser) return;
    setBanning(true);
    try {
      const expiresAt = banPermanent ? null : new Date(Date.now() + parseInt(banDuration) * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("user_bans").insert({
        user_id: banUser.user_id,
        banned_by: adminUser.id,
        reason: banReason,
        expires_at: expiresAt,
        is_permanent: banPermanent,
      });
      if (error) { toast.error("Lỗi ban: " + error.message); return; }
      await logAudit("ban_user", banUser.user_id, { reason: banReason, expiresAt, isPermanent: banPermanent });
      toast.success(`🚫 Đã ban ${banUser.display_name || "user"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-active-bans"] });
      setBanUser(null); setBanReason(""); setBanDuration("24"); setBanPermanent(false);
    } finally { setBanning(false); }
  };

  const handleUnbanUser = async (u: any) => {
    if (!adminUser) return;
    const ban = activeBans?.find((b) => b.user_id === u.user_id);
    if (!ban) return;
    const { error } = await supabase.from("user_bans").delete().eq("id", ban.id);
    if (error) { toast.error("Lỗi gỡ ban: " + error.message); return; }
    await logAudit("unban_user", u.user_id, {});
    toast.success(`✅ Đã gỡ ban ${u.display_name || "user"}`);
    queryClient.invalidateQueries({ queryKey: ["admin-active-bans"] });
  };

  const handleAdjustCredit = async () => {
    if (!editUser || !creditAmount) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount)) { toast.error("Số tiền không hợp lệ"); return; }

    // FIX: Use atomic RPC to prevent stale balance overwrite race condition
    const { data: newBalance, error: updateError } = await supabase
      .rpc("admin_adjust_balance", {
        target_user_id: editUser.user_id,
        delta: amount,
      });
    if (updateError) { toast.error("Lỗi cập nhật: " + updateError.message); return; }

    await supabase.from("transactions").insert({
      user_id: editUser.user_id,
      amount: Math.abs(amount),
      type: amount > 0 ? ("deposit" as const) : ("usage" as const),
      memo: creditMemo || (amount > 0 ? "Admin cộng tiền" : "Admin trừ tiền"),
    });

    await logAudit(amount > 0 ? "adjust_balance_add" : "adjust_balance_deduct", editUser.user_id, {
      amount, newBalance, memo: creditMemo,
    });

    toast.success(`Đã ${amount > 0 ? "cộng" : "trừ"} ${Math.abs(amount).toLocaleString("vi-VN")}đ cho ${editUser.display_name || "user"}`);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setEditUser(null); setCreditAmount(""); setCreditMemo("");
  };

  const handleGrantVip = async () => {
    if (!grantVipUser) return;
    const days = parseInt(vipDays);
    if (isNaN(days) || days <= 0) { toast.error("Số ngày không hợp lệ"); return; }
    setGrantingVip(true);

    const now = new Date();
    const currentExpiry = grantVipUser.vip_expires_at ? new Date(grantVipUser.vip_expires_at) : now;
    const baseDate = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from("profiles")
      .update({ vip_expires_at: newExpiry.toISOString() })
      .eq("user_id", grantVipUser.user_id);

    if (error) { toast.error("Lỗi cấp VIP: " + error.message); setGrantingVip(false); return; }

    // Ghi vip_purchases để thống kê (admin grant = amount_paid 0, granted_by admin)
    await supabase.from("vip_purchases").insert({
      user_id: grantVipUser.user_id,
      vip_plan_id: null,
      amount_paid: 0,
      vip_expires_at: newExpiry.toISOString(),
      granted_by: adminUser?.id,
    });

    // FIX: Lấy VIP cookie count từ app_settings hoặc mặc định 5
    await supabase.rpc("assign_cookies_to_user", {
      target_user_id: grantVipUser.user_id,
      desired_count: 5,
    });

    await logAudit("grant_vip", grantVipUser.user_id, { days, newExpiry: newExpiry.toISOString(), cookiesAssigned: 5 });
    toast.success(`✅ Đã cấp VIP ${days} ngày cho ${grantVipUser.display_name || "user"}. Hạn: ${newExpiry.toLocaleDateString("vi-VN")}`);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    setGrantVipUser(null); setVipDays("30"); setGrantingVip(false);
  };

  const handleRevokeVip = async (u: any) => {
    const { error } = await supabase
      .from("profiles")
      .update({ vip_expires_at: null, vip_views_left: 0 })
      .eq("user_id", u.user_id);
    if (error) { toast.error("Lỗi thu hồi VIP"); return; }

    // Thu hồi cookie VIP về mức Free (2 slot)
    await supabase
      .from("user_cookie_assignment")
      .delete()
      .eq("user_id", u.user_id);
    await supabase.rpc("assign_cookies_to_user", {
      target_user_id: u.user_id,
      desired_count: 2,
    });

    await logAudit("revoke_vip", u.user_id, { cookiesReducedTo: 2, vipViewsReset: true });
    toast.success(`Đã thu hồi VIP của ${u.display_name || "user"}`);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  // Cấp lại tài khoản Netflix từ kho active
  const handleGrantCookie = async () => {
    if (!grantCookieUser) return;
    setGrantingCookie(true);
    try {
      const isVip = grantCookieUser.vip_expires_at && new Date(grantCookieUser.vip_expires_at) > new Date();
      const desiredCount = isVip ? 5 : 2;

      const { error } = await supabase.rpc("assign_cookies_to_user", {
        target_user_id: grantCookieUser.user_id,
        desired_count: desiredCount,
      });

      if (error) { toast.error("Lỗi cấp tài khoản: " + error.message); return; }

      await logAudit("grant_cookie", grantCookieUser.user_id, { desiredCount, isVip });
      toast.success(`✅ Đã cấp ${desiredCount} tài khoản Netflix cho ${grantCookieUser.display_name || "user"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setGrantCookieUser(null);
    } finally {
      setGrantingCookie(false);
    }
  };

  const viewUserVip = viewUser ? isUserVip(viewUser) : false;
  const viewUserBanned = viewUser ? isUserBanned(viewUser.user_id) : false;

  return (
    <>
      {/* Detail view for a user */}
      {viewUser && (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setViewUser(null)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
          </Button>
          <div className="bg-card border border-border/50 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {viewUser.display_name || "User"}
                {viewUserBanned && <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded-full font-bold">BANNED</span>}
              </h3>
              {viewUserVip ? (
                <span className="inline-flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-bold px-3 py-1 rounded-full">
                  <Crown className="h-3.5 w-3.5" /> VIP — hết hạn {new Date(viewUser.vip_expires_at).toLocaleDateString("vi-VN")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-secondary text-muted-foreground text-xs px-3 py-1 rounded-full">
                  <Star className="h-3 w-3" /> Free
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Tên hiển thị:</span><p className="font-medium text-foreground">{viewUser.display_name || "—"}</p></div>
              <div><span className="text-muted-foreground">User ID:</span><p className="font-mono text-xs text-foreground">{viewUser.user_id}</p></div>
              <div><span className="text-muted-foreground">Số dư:</span><p className="font-bold text-primary">{(viewUser.balance ?? 0).toLocaleString("vi-VN")}đ</p></div>
              <div><span className="text-muted-foreground">Xác thực:</span><p>{viewUser.is_verified ? "✅ Đã xác thực" : "⏳ Chưa xác thực"}</p></div>
              <div><span className="text-muted-foreground">Ngày tạo:</span><p>{new Date(viewUser.created_at).toLocaleString("vi-VN")}</p></div>
              <div>
                <span className="text-muted-foreground">VIP hết hạn:</span>
                <p className={viewUserVip ? "text-yellow-400 font-semibold" : "text-muted-foreground"}>
                  {viewUser.vip_expires_at ? new Date(viewUser.vip_expires_at).toLocaleDateString("vi-VN") : "Không có"}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setGrantCookieUser(viewUser)} className="gap-1.5">
                <Tv className="h-3.5 w-3.5 text-primary" /> Cấp tài khoản
              </Button>
              <Button size="sm" variant="outline" onClick={() => setGrantVipUser(viewUser)} className="gap-1.5">
                <Crown className="h-3.5 w-3.5 text-yellow-400" /> Cấp VIP
              </Button>
              {viewUserVip && (
                <Button size="sm" variant="outline" onClick={() => handleRevokeVip(viewUser)} className="gap-1.5 text-destructive hover:text-destructive">
                  Thu hồi VIP
                </Button>
              )}
              {viewUserBanned ? (
                <Button size="sm" variant="outline" onClick={() => handleUnbanUser(viewUser)} className="gap-1.5 text-green-400 hover:text-green-300">
                  <ShieldOff className="h-3.5 w-3.5" /> Gỡ ban
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setBanUser(viewUser)} className="gap-1.5 text-destructive hover:text-destructive">
                  <Ban className="h-3.5 w-3.5" /> Ban user
                </Button>
              )}
            </div>
          </div>
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50"><h3 className="font-bold text-foreground">Lịch sử giao dịch</h3></div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ghi chú</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!userTransactions?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Chưa có giao dịch</TableCell></TableRow>
                ) : userTransactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${t.type === "deposit" ? "bg-green-500/20 text-green-400" : "bg-orange-500/20 text-orange-400"}`}>
                        {t.type === "deposit" ? "Nạp" : "Sử dụng"}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-bold ${t.type === "deposit" ? "text-green-400" : "text-orange-400"}`}>
                      {t.type === "deposit" ? "+" : "-"}{(t.amount ?? 0).toLocaleString("vi-VN")}đ
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.memo || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(t.created_at).toLocaleString("vi-VN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Main list view */}
      {!viewUser && <>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          placeholder="Tìm kiếm theo tên hiển thị..."
          className="pl-9 bg-secondary border-border/40"
        />
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead className="text-right">Số dư</TableHead>
              <TableHead>VIP hết hạn</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : sortedUsers.map((u) => {
              const vip = isUserVip(u);
              const banned = isUserBanned(u.user_id);
              const roles = getUserRoles(u.user_id);
              const isAdmin = roles.includes("admin");
              const isMod = roles.includes("moderator");
              return (
                <TableRow key={u.id} className={`cursor-pointer ${banned ? 'bg-destructive/5' : ''} ${isAdmin ? 'bg-blue-500/5' : ''}`} onClick={() => setViewUser(u)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2 flex-wrap">
                      {u.display_name || "—"}
                      {isAdmin && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>}
                      {isMod && !isAdmin && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full font-bold">MOD</span>}
                      {banned && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full font-bold">BANNED</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    {vip ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-semibold">
                        <Crown className="h-3 w-3" /> VIP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        <Star className="h-3 w-3" /> Free
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">{(u.balance ?? 0).toLocaleString("vi-VN")}đ</TableCell>
                  <TableCell className={`text-sm ${vip ? "text-yellow-400 font-medium" : "text-muted-foreground"}`}>
                    {(u as any).vip_expires_at ? new Date((u as any).vip_expires_at).toLocaleDateString("vi-VN") : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" title="Cấp tài khoản Netflix" onClick={() => setGrantCookieUser(u)}>
                        <Tv className="h-3 w-3 text-primary" />
                      </Button>
                      <Button size="sm" variant="outline" title="Cấp VIP" onClick={() => setGrantVipUser(u)}>
                        <Crown className="h-3 w-3 text-yellow-400" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditUser(u); setCreditAmount(""); setCreditMemo(""); }}>
                        <DollarSign className="h-3 w-3" />
                      </Button>
                      {banned ? (
                        <Button size="sm" variant="outline" title="Gỡ ban" onClick={() => handleUnbanUser(u)} className="text-green-400 hover:text-green-300">
                          <ShieldOff className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" title="Ban user" onClick={() => setBanUser(u)} className="text-destructive hover:text-destructive">
                          <Ban className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
          <span>Tổng {totalUsers} người dùng — Trang {page + 1}/{totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Điều chỉnh số dư — {editUser?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Số dư hiện tại: <span className="text-primary font-bold">{(editUser?.balance ?? 0).toLocaleString("vi-VN")}đ</span></p>
            <Input placeholder="Số tiền (dương = cộng, âm = trừ)" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} type="number" />
            <Input placeholder="Ghi chú (tuỳ chọn)" value={creditMemo} onChange={(e) => setCreditMemo(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Huỷ</Button>
            <Button onClick={handleAdjustCredit}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant VIP Dialog */}
      <Dialog open={!!grantVipUser} onOpenChange={() => setGrantVipUser(null)}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-400" />
              Cấp VIP — {grantVipUser?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(grantVipUser as any)?.vip_expires_at && new Date((grantVipUser as any).vip_expires_at) > new Date() && (
              <p className="text-sm text-yellow-400">
                VIP hiện tại hết hạn: {new Date((grantVipUser as any).vip_expires_at).toLocaleDateString("vi-VN")}
                <span className="text-muted-foreground"> (sẽ được gia hạn thêm)</span>
              </p>
            )}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Số ngày VIP</label>
              <Select value={vipDays} onValueChange={setVipDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 ngày</SelectItem>
                  <SelectItem value="30">30 ngày (1 tháng)</SelectItem>
                  <SelectItem value="90">90 ngày (3 tháng)</SelectItem>
                  <SelectItem value="180">180 ngày (6 tháng)</SelectItem>
                  <SelectItem value="365">365 ngày (1 năm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantVipUser(null)}>Huỷ</Button>
            <Button onClick={handleGrantVip} disabled={grantingVip} className="bg-yellow-500 hover:bg-yellow-600 text-black">
              <Crown className="h-4 w-4 mr-1" />
              {grantingVip ? "Đang cấp..." : "Cấp VIP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban User Dialog */}
      <Dialog open={!!banUser} onOpenChange={() => { setBanUser(null); setBanReason(""); setBanPermanent(false); }}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="h-5 w-5" />
              Ban user — {banUser?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Lý do ban <span className="text-destructive">*</span></label>
              <Textarea
                placeholder="Nhập lý do ban user..."
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="bg-secondary border-border/40 resize-none"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Thời gian ban</label>
              <Select value={banPermanent ? "permanent" : banDuration} onValueChange={(v) => { if (v === "permanent") { setBanPermanent(true); } else { setBanPermanent(false); setBanDuration(v); } }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 giờ</SelectItem>
                  <SelectItem value="6">6 giờ</SelectItem>
                  <SelectItem value="24">24 giờ (1 ngày)</SelectItem>
                  <SelectItem value="72">72 giờ (3 ngày)</SelectItem>
                  <SelectItem value="168">7 ngày</SelectItem>
                  <SelectItem value="720">30 ngày</SelectItem>
                  <SelectItem value="permanent">Vĩnh viễn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {banPermanent && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2">
                ⚠️ Ban vĩnh viễn sẽ khóa tài khoản này mãi mãi.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBanUser(null); setBanReason(""); }}>Huỷ</Button>
            <Button onClick={handleBanUser} disabled={banning || !banReason.trim()} variant="destructive">
              <Ban className="h-4 w-4 mr-1" />
              {banning ? "Đang ban..." : "Xác nhận ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Cookie Dialog */}
      <Dialog open={!!grantCookieUser} onOpenChange={() => setGrantCookieUser(null)}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              Cấp tài khoản Netflix — {grantCookieUser?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Hệ thống sẽ cấp tài khoản Netflix từ kho <strong className="text-foreground">active</strong> cho người dùng này.
            </p>
            <div className="bg-secondary/50 border border-border/40 rounded-lg px-4 py-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loại tài khoản:</span>
                <span className="font-semibold text-foreground">
                  {grantCookieUser?.vip_expires_at && new Date(grantCookieUser?.vip_expires_at) > new Date()
                    ? <span className="text-yellow-400">VIP</span>
                    : <span className="text-muted-foreground">Free</span>
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Số tài khoản sẽ cấp:</span>
                <span className="font-bold text-primary">
                  {grantCookieUser?.vip_expires_at && new Date(grantCookieUser?.vip_expires_at) > new Date() ? 5 : 2} slot
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ℹ️ Tài khoản được lấy từ kho active. Nếu kho không đủ, hệ thống sẽ cấp số lượng có sẵn.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantCookieUser(null)}>Huỷ</Button>
            <Button onClick={handleGrantCookie} disabled={grantingCookie}>
              <Tv className="h-4 w-4 mr-1" />
              {grantingCookie ? "Đang cấp..." : "Cấp tài khoản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>}
    </>
  );
}
