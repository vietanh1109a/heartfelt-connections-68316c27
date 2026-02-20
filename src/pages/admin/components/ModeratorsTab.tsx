import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, UserPlus, Trash2, Crown, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export function ModeratorsTab() {
  const { user: adminUser } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<any>(null);

  // Fetch all moderators
  const { data: moderators, isLoading } = useQuery({
    queryKey: ["admin-moderators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles!user_roles_user_id_fkey(display_name, user_id, balance)")
        .eq("role", "moderator");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Search users to promote
  const { data: searchResults } = useQuery({
    queryKey: ["user-search-for-mod", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 3) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, balance")
        .ilike("display_name", `%${searchQuery.trim()}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: searchQuery.length >= 3,
  });

  const handleAssignModerator = async (profile: any) => {
    if (!adminUser) return;
    setAssigning(true);
    try {
      // Check not already a moderator
      const already = moderators?.some((m: any) => m.user_id === profile.user_id);
      if (already) { toast.error("User này đã là Moderator"); return; }

      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.user_id, role: "moderator" });
      if (error) { toast.error("Lỗi: " + error.message); return; }

      // Audit log
      await supabase.from("admin_audit_logs").insert({
        admin_user_id: adminUser.id,
        action: "assign_moderator",
        target_user_id: profile.user_id,
        details: { display_name: profile.display_name },
      });

      toast.success(`✅ Đã bổ nhiệm ${profile.display_name} làm Moderator`);
      setSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["admin-moderators"] });
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveModerator = async () => {
    if (!removeTarget || !adminUser) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("id", removeTarget.id);
    if (error) { toast.error("Lỗi: " + error.message); return; }

    await supabase.from("admin_audit_logs").insert({
      admin_user_id: adminUser.id,
      action: "remove_moderator",
      target_user_id: removeTarget.user_id,
      details: {},
    });

    toast.success("Đã thu hồi quyền Moderator");
    setRemoveTarget(null);
    queryClient.invalidateQueries({ queryKey: ["admin-moderators"] });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-foreground font-bold text-lg">Quản lý Moderator (CTV)</h2>
      </div>

      {/* Assign new moderator */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-secondary/20">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" /> Bổ nhiệm Moderator mới
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Tìm người dùng theo tên để bổ nhiệm làm CTV</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nhập tên người dùng (tối thiểu 3 ký tự)..."
              className="pl-9 bg-secondary border-border/40"
            />
          </div>
          {searchResults && searchResults.length > 0 && (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              {searchResults.map((u: any) => {
                const isAlreadyMod = moderators?.some((m: any) => m.user_id === u.user_id);
                return (
                  <div key={u.user_id} className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-secondary/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.display_name || "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.user_id.slice(0, 12)}...</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={isAlreadyMod || assigning}
                      onClick={() => handleAssignModerator(u)}
                    >
                      {isAlreadyMod ? "Đã là Mod" : "Bổ nhiệm"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          {searchQuery.length >= 3 && searchResults?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Không tìm thấy người dùng nào</p>
          )}
        </div>
      </div>

      {/* Current moderators list */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-secondary/20">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-400" /> Danh sách Moderator ({moderators?.length ?? 0})
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên hiển thị</TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Số dư</TableHead>
              <TableHead>Ngày bổ nhiệm</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : !moderators?.length ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Chưa có Moderator nào</TableCell></TableRow>
            ) : moderators.map((m: any) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-foreground">
                  {m.profiles?.display_name || "—"}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {m.user_id?.slice(0, 12)}...
                </TableCell>
                <TableCell className="text-primary font-bold">${m.profiles?.balance ?? 0}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(m.created_at).toLocaleDateString("vi-VN")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRemoveTarget(m)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Thu hồi
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirm remove dialog */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Thu hồi quyền Moderator</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn thu hồi quyền Moderator của <strong className="text-foreground">{removeTarget?.profiles?.display_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Huỷ</Button>
            <Button variant="destructive" onClick={handleRemoveModerator}>Thu hồi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
