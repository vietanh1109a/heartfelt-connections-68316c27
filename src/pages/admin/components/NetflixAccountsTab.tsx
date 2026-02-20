import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, UserPlus, Edit2, Save, ToggleLeft, ToggleRight, Package } from "lucide-react";

// ─── Default plans to seed ───────────────────────────────────────────────────
const DEFAULT_PLANS = [
  { name: "1 Tháng", duration_months: 1, price: 79000, description: "Gói cơ bản 1 tháng", is_active: true },
  { name: "3 Tháng", duration_months: 3, price: 219000, description: "Tiết kiệm 8%", is_active: true },
  { name: "6 Tháng", duration_months: 6, price: 399000, description: "Tiết kiệm 16%", is_active: true },
  { name: "1 Năm",   duration_months: 12, price: 699000, description: "Tiết kiệm 26%", is_active: true },
];

const emptyNewPlan = { name: "", duration_months: "", price: "", description: "" };

export const NetflixAccountsTab = () => {
  const queryClient = useQueryClient();

  // Account states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPlanId, setNewPlanId] = useState("");

  // Plan states
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState<typeof emptyNewPlan>({ ...emptyNewPlan });
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPlanData, setEditPlanData] = useState<any>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [seedingPlans, setSeedingPlans] = useState(false);

  const invalidatePlans = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-netflix-plans"] });
    queryClient.invalidateQueries({ queryKey: ["netflix-plans"] });
    queryClient.invalidateQueries({ queryKey: ["netflix-stock-by-plan"] });
  };

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["admin-netflix-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netflix_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ["admin-netflix-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("netflix_plans")
        .select("*")
        .order("duration_months", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingPurchases } = useQuery({
    queryKey: ["admin-pending-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_purchases")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // ─── Account handlers ───────────────────────────────────────────────────────
  const handleAddAccount = async () => {
    if (!newEmail || !newPassword) { toast.error("Vui lòng nhập email và password"); return; }
    const { error } = await supabase.from("netflix_accounts").insert({
      email: newEmail, password: newPassword, plan_id: newPlanId || null,
    });
    if (error) { toast.error("Lỗi: " + error.message); return; }
    toast.success("Đã thêm tài khoản Netflix");
    setNewEmail(""); setNewPassword(""); setNewPlanId("");
    setShowAddAccount(false);
    queryClient.invalidateQueries({ queryKey: ["admin-netflix-accounts"] });
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm("Xóa tài khoản này?")) return;
    const { error } = await supabase.from("netflix_accounts").delete().eq("id", id);
    if (error) { toast.error("Lỗi: " + error.message); return; }
    toast.success("Đã xóa");
    queryClient.invalidateQueries({ queryKey: ["admin-netflix-accounts"] });
  };

  const handleAssign = async (accountId: string, purchaseId: string, userId: string, durationMonths: number) => {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);
    const { error: accErr } = await supabase.from("netflix_accounts").update({
      is_assigned: true, assigned_to: userId,
      assigned_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    }).eq("id", accountId);
    if (accErr) { toast.error("Lỗi gán tài khoản: " + accErr.message); return; }
    const { error: purErr } = await supabase.from("plan_purchases")
      .update({ account_id: accountId, status: "assigned" }).eq("id", purchaseId);
    if (purErr) { toast.error("Lỗi cập nhật purchase: " + purErr.message); return; }
    toast.success("Đã gán tài khoản cho user");
    queryClient.invalidateQueries({ queryKey: ["admin-netflix-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pending-purchases"] });
  };

  // ─── Plan handlers ───────────────────────────────────────────────────────────
  const handleCreatePlan = async () => {
    const price = parseInt(newPlan.price);
    const months = parseInt(newPlan.duration_months);
    if (!newPlan.name.trim()) { toast.error("Vui lòng nhập tên gói"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Giá không hợp lệ"); return; }
    if (isNaN(months) || months <= 0) { toast.error("Số tháng không hợp lệ"); return; }
    setSavingPlan(true);
    const { error } = await supabase.from("netflix_plans").insert({
      name: newPlan.name.trim(),
      duration_months: months,
      price,
      description: newPlan.description.trim() || null,
      is_active: true,
    });
    if (error) { toast.error("Lỗi tạo: " + error.message); setSavingPlan(false); return; }
    toast.success("✅ Đã tạo gói Netflix!");
    setNewPlan({ ...emptyNewPlan });
    setShowAddPlan(false);
    invalidatePlans();
    setSavingPlan(false);
  };

  const handleSeedDefaultPlans = async () => {
    setSeedingPlans(true);
    const { error } = await supabase.from("netflix_plans").upsert(
      DEFAULT_PLANS, { onConflict: "name" }
    );
    if (error) { toast.error("Lỗi: " + error.message); setSeedingPlans(false); return; }
    toast.success("✅ Đã tạo 4 gói mặc định (1/3/6/12 tháng)!");
    invalidatePlans();
    setSeedingPlans(false);
  };

  const handleEditPlanSave = async () => {
    if (!editPlanData) return;
    const price = parseInt(editPlanData.price);
    const months = parseInt(editPlanData.duration_months);
    if (isNaN(price) || price <= 0) { toast.error("Giá không hợp lệ"); return; }
    if (isNaN(months) || months <= 0) { toast.error("Số tháng không hợp lệ"); return; }
    setSavingPlan(true);
    const { error } = await supabase.from("netflix_plans").update({
      name: editPlanData.name,
      description: editPlanData.description || null,
      price,
      duration_months: months,
    }).eq("id", editPlanData.id);
    if (error) { toast.error("Lỗi: " + error.message); setSavingPlan(false); return; }
    toast.success("Đã cập nhật gói!");
    setEditingPlanId(null);
    setEditPlanData(null);
    invalidatePlans();
    setSavingPlan(false);
  };

  const handleTogglePlan = async (plan: any) => {
    const { error } = await supabase.from("netflix_plans")
      .update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (error) { toast.error("Lỗi"); return; }
    toast.success(`Đã ${!plan.is_active ? "kích hoạt" : "ẩn"} gói ${plan.name}`);
    invalidatePlans();
  };

  const handleDeletePlan = async (plan: any) => {
    if (!confirm(`Xóa gói "${plan.name}"? Hành động không thể hoàn tác.`)) return;
    const { error } = await supabase.from("netflix_plans").delete().eq("id", plan.id);
    if (error) { toast.error("Lỗi: " + error.message); return; }
    toast.success(`Đã xóa gói ${plan.name}`);
    invalidatePlans();
  };

  const unassignedAccounts = accounts?.filter((a) => !a.is_assigned) || [];

  return (
    <div className="space-y-6">

      {/* ─── Plans Management ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="font-bold text-foreground">Gói dịch vụ Netflix chính chủ</h3>
            <span className="text-xs text-muted-foreground">({plans?.length ?? 0} gói)</span>
          </div>
          <div className="flex gap-2">
            {(!plans || plans.length === 0) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSeedDefaultPlans}
                disabled={seedingPlans}
                className="gap-1.5 text-xs"
              >
                {seedingPlans ? "Đang tạo..." : "⚡ Tạo 4 gói mặc định"}
              </Button>
            )}
            <Button size="sm" className="gap-1.5" onClick={() => setShowAddPlan(true)}>
              <Plus className="h-3.5 w-3.5" /> Thêm gói
            </Button>
          </div>
        </div>

        {(!plans || plans.length === 0) ? (
          <div className="py-12 text-center space-y-3">
            <Package className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <div>
              <p className="text-foreground font-semibold">Chưa có gói nào</p>
              <p className="text-muted-foreground text-sm mt-1">
                Nhấn <strong>"⚡ Tạo 4 gói mặc định"</strong> để tạo nhanh 4 gói 1/3/6/12 tháng<br/>
                hoặc nhấn <strong>"Thêm gói"</strong> để tạo gói tuỳ chỉnh.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên gói</TableHead>
                <TableHead className="text-center">Thời hạn</TableHead>
                <TableHead className="text-right">Giá</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-semibold text-foreground">{plan.name}</TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {plan.duration_months >= 12
                      ? `${Math.round(plan.duration_months / 12)} năm`
                      : `${plan.duration_months} tháng`}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {(plan.price ?? 0).toLocaleString("vi-VN")}đ
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{plan.description || "—"}</TableCell>
                  <TableCell>
                    {plan.is_active ? (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Đang bán</span>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Ẩn</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm" variant="outline"
                        onClick={() => { setEditingPlanId(plan.id); setEditPlanData({ ...plan }); }}
                        title="Sửa"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleTogglePlan(plan)}
                        title={plan.is_active ? "Ẩn" : "Kích hoạt"}
                      >
                        {plan.is_active
                          ? <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                          : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={() => handleDeletePlan(plan)}
                        className="text-destructive hover:text-destructive hover:border-destructive/50"
                        title="Xóa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ─── Pending Purchases ────────────────────────────────────────────── */}
      {(pendingPurchases?.length ?? 0) > 0 && (
        <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-yellow-500" />
            Đơn hàng chờ gán ({pendingPurchases?.length})
          </h3>
          <div className="space-y-2">
            {pendingPurchases?.map((purchase) => {
              const plan = plans?.find((p) => p.id === purchase.plan_id);
              return (
                <div key={purchase.id} className="flex items-center justify-between bg-card/60 rounded-lg p-3 border border-border/30">
                  <div>
                    <p className="text-sm text-foreground font-medium">
                      {plan?.name || "N/A"} — <span className="text-primary">{(purchase.amount_paid ?? 0).toLocaleString("vi-VN")}đ</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      User: {purchase.user_id.slice(0, 8)}... • {new Date(purchase.created_at).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  {unassignedAccounts.length > 0 ? (
                    <Select onValueChange={(accId) => handleAssign(accId, purchase.id, purchase.user_id, plan?.duration_months ?? 1)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Chọn tài khoản gán" />
                      </SelectTrigger>
                      <SelectContent className="z-[300] bg-card border border-border/60">
                        {unassignedAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-destructive">Hết tài khoản trống</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Accounts Table ───────────────────────────────────────────────── */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-bold text-foreground">Tài khoản Netflix ({accounts?.length ?? 0})</h3>
          <Button onClick={() => setShowAddAccount(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Thêm tài khoản
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Gói</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Hết hạn</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : !accounts?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chưa có tài khoản nào</TableCell></TableRow>
            ) : (
              accounts.map((acc) => {
                const planName = plans?.find((p) => p.id === acc.plan_id)?.name;
                return (
                  <TableRow key={acc.id}>
                    <TableCell className="font-mono text-sm">{acc.email}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{acc.password}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{planName || "—"}</TableCell>
                    <TableCell>
                      {acc.is_assigned ? (
                        <Badge variant="default" className="bg-green-500/20 text-green-400 border-0">Đã gán</Badge>
                      ) : (
                        <Badge variant="secondary">Trống</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.expires_at ? new Date(acc.expires_at).toLocaleDateString("vi-VN") : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(acc.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Add Plan Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showAddPlan} onOpenChange={(o) => { if (!o) { setShowAddPlan(false); setNewPlan({ ...emptyNewPlan }); } }}>
        <DialogContent className="max-w-sm bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" /> Thêm gói dịch vụ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Tên gói *</label>
              <Input
                value={newPlan.name}
                onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                placeholder="VD: 1 Tháng, 3 Tháng..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Số tháng *</label>
                <Input
                  type="number" min="1"
                  value={newPlan.duration_months}
                  onChange={(e) => setNewPlan({ ...newPlan, duration_months: e.target.value })}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Giá (đ) *</label>
                <Input
                  type="number" min="1"
                  value={newPlan.price}
                  onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                  placeholder="79000"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Mô tả</label>
              <Input
                value={newPlan.description}
                onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                placeholder="VD: Tiết kiệm 16%"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowAddPlan(false); setNewPlan({ ...emptyNewPlan }); }}>Huỷ</Button>
            <Button onClick={handleCreatePlan} disabled={savingPlan}>
              {savingPlan ? "Đang tạo..." : "Tạo gói"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Plan Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editingPlanId} onOpenChange={(o) => { if (!o) { setEditingPlanId(null); setEditPlanData(null); } }}>
        <DialogContent className="max-w-sm bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-4 w-4" /> Chỉnh sửa gói
            </DialogTitle>
          </DialogHeader>
          {editPlanData && (
            <div className="space-y-4 mt-1">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Tên gói</label>
                <Input
                  value={editPlanData.name}
                  onChange={(e) => setEditPlanData({ ...editPlanData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Số tháng</label>
                  <Input
                    type="number" min="1"
                    value={editPlanData.duration_months}
                    onChange={(e) => setEditPlanData({ ...editPlanData, duration_months: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Giá (đ)</label>
                  <Input
                    type="number" min="1"
                    value={editPlanData.price}
                    onChange={(e) => setEditPlanData({ ...editPlanData, price: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Mô tả</label>
                <Input
                  value={editPlanData.description || ""}
                  onChange={(e) => setEditPlanData({ ...editPlanData, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditingPlanId(null); setEditPlanData(null); }}>Huỷ</Button>
            <Button onClick={handleEditPlanSave} disabled={savingPlan}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {savingPlan ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Account Dialog ───────────────────────────────────────────── */}
      <Dialog open={showAddAccount} onOpenChange={setShowAddAccount}>
        <DialogContent className="max-w-sm bg-card border-border/40">
          <DialogHeader>
            <DialogTitle>Thêm tài khoản Netflix</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Email Netflix" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Select value={newPlanId} onValueChange={setNewPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Gói (tùy chọn)" />
              </SelectTrigger>
              <SelectContent className="z-[300] bg-card border border-border/60">
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months} tháng</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddAccount(false)}>Huỷ</Button>
            <Button onClick={handleAddAccount}>Thêm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
