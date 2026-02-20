import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Crown, Pencil, ToggleLeft, ToggleRight, Plus, Trash2 } from "lucide-react";

const emptyPlan = { name: "", description: "", price: "", duration_days: "" };

export function VipPlansTab() {
  const queryClient = useQueryClient();
  const [editPlan, setEditPlan] = useState<any>(null);
  const [newPlan, setNewPlan] = useState<typeof emptyPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["admin-vip-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_plans")
        .select("*")
        .order("duration_days", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-vip-plans"] });
    queryClient.invalidateQueries({ queryKey: ["vip-plans"] });
  };

  const handleSave = async () => {
    if (!editPlan) return;
    const price = parseInt(editPlan.price);
    const durationDays = parseInt(editPlan.duration_days);
    if (isNaN(price) || price <= 0) { toast.error("Giá không hợp lệ"); return; }
    if (isNaN(durationDays) || durationDays <= 0) { toast.error("Số ngày không hợp lệ"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("vip_plans")
      .update({ name: editPlan.name, description: editPlan.description, price, duration_days: durationDays })
      .eq("id", editPlan.id);
    if (error) { toast.error("Lỗi lưu: " + error.message); setSaving(false); return; }
    toast.success("✅ Đã cập nhật gói VIP!");
    invalidate();
    setEditPlan(null);
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newPlan) return;
    const price = parseInt(newPlan.price);
    const durationDays = parseInt(newPlan.duration_days);
    if (!newPlan.name.trim()) { toast.error("Vui lòng nhập tên gói"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Giá không hợp lệ"); return; }
    if (isNaN(durationDays) || durationDays <= 0) { toast.error("Số ngày không hợp lệ"); return; }
    setSaving(true);
    const { error } = await supabase.from("vip_plans").insert({
      name: newPlan.name.trim(),
      description: newPlan.description.trim() || null,
      price,
      duration_days: durationDays,
      is_active: true,
    });
    if (error) { toast.error("Lỗi tạo: " + error.message); setSaving(false); return; }
    toast.success("✅ Đã tạo gói VIP mới!");
    invalidate();
    setNewPlan(null);
    setSaving(false);
  };

  const handleToggleActive = async (plan: any) => {
    const { error } = await supabase
      .from("vip_plans")
      .update({ is_active: !plan.is_active })
      .eq("id", plan.id);
    if (error) { toast.error("Lỗi cập nhật trạng thái"); return; }
    toast.success(`Đã ${!plan.is_active ? "kích hoạt" : "ẩn"} gói ${plan.name}`);
    invalidate();
  };

  const handleDelete = async (plan: any) => {
    if (!confirm(`Xóa gói "${plan.name}"? Hành động này không thể hoàn tác.`)) return;
    setDeleting(plan.id);
    const { error } = await supabase.from("vip_plans").delete().eq("id", plan.id);
    if (error) { toast.error("Lỗi xóa: " + error.message); }
    else { toast.success(`Đã xóa gói ${plan.name}`); invalidate(); }
    setDeleting(null);
  };

  const months = (days: number) => {
    if (days >= 360) return `${Math.round(days / 365)} năm`;
    if (days >= 28) return `${Math.round(days / 30)} tháng`;
    return `${days} ngày`;
  };

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-400" />
            <h3 className="font-bold text-foreground">Quản lý gói VIP</h3>
            <span className="text-xs text-muted-foreground">({plans?.length ?? 0} gói)</span>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setNewPlan({ ...emptyPlan })}>
            <Plus className="h-3.5 w-3.5" /> Thêm gói VIP
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên gói</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="text-right">Giá (đ)</TableHead>
              <TableHead className="text-right">Thời hạn</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Đang tải...</TableCell>
              </TableRow>
            ) : !plans?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Crown className="h-8 w-8 text-yellow-400/30 mx-auto mb-2" />
                  <p>Chưa có gói VIP nào.</p>
                  <p className="text-xs mt-1">Nhấn <strong>"Thêm gói VIP"</strong> để tạo gói đầu tiên.</p>
                </TableCell>
              </TableRow>
            ) : plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-yellow-400" />
                    {plan.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{plan.description || "—"}</TableCell>
                <TableCell className="text-right font-bold text-primary">{(plan.price ?? 0).toLocaleString("vi-VN")}đ</TableCell>
                <TableCell className="text-right text-muted-foreground">{months(plan.duration_days)}</TableCell>
                <TableCell>
                  {plan.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                      Đang bán
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      Ẩn
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setEditPlan({ ...plan })} title="Chỉnh sửa">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(plan)} title={plan.is_active ? "Ẩn gói" : "Kích hoạt"}>
                      {plan.is_active
                        ? <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                        : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(plan)}
                      disabled={deleting === plan.id}
                      title="Xóa gói"
                      className="text-destructive hover:text-destructive hover:border-destructive/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={!!newPlan} onOpenChange={(o) => { if (!o) setNewPlan(null); }}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Tạo gói VIP mới
            </DialogTitle>
          </DialogHeader>
          {newPlan && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Tên gói *</label>
                <Input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="VD: VIP 1 tháng"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Mô tả</label>
                <Input
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  placeholder="Mô tả ngắn về gói..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Giá (đ) *</label>
                  <Input
                    type="number"
                    min="1"
                    value={newPlan.price}
                    onChange={(e) => setNewPlan({ ...newPlan, price: e.target.value })}
                    placeholder="50000"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Số ngày *</label>
                  <Input
                    type="number"
                    min="1"
                    value={newPlan.duration_days}
                    onChange={(e) => setNewPlan({ ...newPlan, duration_days: e.target.value })}
                    placeholder="30"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                Gói sẽ được kích hoạt ngay và hiển thị cho người dùng.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewPlan(null)}>Huỷ</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
              {saving ? "Đang tạo..." : "Tạo gói"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPlan} onOpenChange={() => setEditPlan(null)}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              Chỉnh sửa gói VIP
            </DialogTitle>
          </DialogHeader>
          {editPlan && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Tên gói</label>
                <Input
                  value={editPlan.name}
                  onChange={(e) => setEditPlan({ ...editPlan, name: e.target.value })}
                  placeholder="VIP 1 tháng"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Mô tả</label>
                <Input
                  value={editPlan.description || ""}
                  onChange={(e) => setEditPlan({ ...editPlan, description: e.target.value })}
                  placeholder="Mô tả ngắn..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Giá (đ)</label>
                  <Input
                    type="number"
                    min="1"
                    value={editPlan.price}
                    onChange={(e) => setEditPlan({ ...editPlan, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Số ngày</label>
                  <Input
                    type="number"
                    min="1"
                    value={editPlan.duration_days}
                    onChange={(e) => setEditPlan({ ...editPlan, duration_days: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Giá trên trang người dùng sẽ được cập nhật ngay sau khi lưu.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlan(null)}>Huỷ</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
