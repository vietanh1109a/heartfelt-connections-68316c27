import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

type TabPermission = {
  id: string;
  tab: string;
  can_view: boolean;
  can_edit: boolean;
  updated_at: string;
};

const TAB_LABELS: Record<string, string> = {
  stats: "📊 Thống kê",
  users: "👥 Quản lý Users",
  cookies: "🍪 Cookie Stock",
  "netflix-accounts": "🎬 Netflix Accounts",
  transactions: "💲 Giao dịch",
  deposits: "💳 Nạp tiền",
  "vip-plans": "👑 Gói VIP",
  moderators: "🛡️ Moderators",
  settings: "⚙️ Cài đặt",
};

export function ModeratorPermissionsPanel() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [localPerms, setLocalPerms] = useState<TabPermission[]>([]);

  const { data: perms, isLoading } = useQuery<TabPermission[]>({
    queryKey: ["admin-moderator-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderator_permissions")
        .select("*")
        .order("tab");
      if (error) throw error;
      return (data ?? []) as TabPermission[];
    },
  });

  useEffect(() => {
    if (perms && localPerms.length === 0) {
      setLocalPerms(perms);
    }
  }, [perms]);

  const toggle = (tab: string, field: "can_view" | "can_edit") => {
    setLocalPerms(prev =>
      prev.map(p => {
        if (p.tab !== tab) return p;
        if (field === "can_view") {
          const newView = !p.can_view;
          return { ...p, can_view: newView, can_edit: newView ? p.can_edit : false };
        } else {
          const newEdit = !p.can_edit;
          return { ...p, can_edit: newEdit, can_view: newEdit ? true : p.can_view };
        }
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = localPerms.map(p =>
        supabase.from("moderator_permissions").update({
          can_view: p.can_view,
          can_edit: p.can_edit,
          updated_at: new Date().toISOString(),
        }).eq("tab", p.tab)
      );
      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);
      if (hasError) { toast.error("Lỗi lưu quyền"); return; }
      toast.success("✅ Đã lưu quyền Moderator");
      queryClient.invalidateQueries({ queryKey: ["admin-moderator-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["moderator-permissions"] });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="text-muted-foreground text-sm py-4">Đang tải...</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Cấu hình quyền truy cập cho Moderator (CTV). Super Admin luôn có toàn quyền.
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Đang lưu..." : "Lưu quyền"}
        </Button>
      </div>
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-secondary/20">
          <div className="grid grid-cols-[1fr_100px_100px] gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <span>Tab</span>
            <span className="text-center">Xem</span>
            <span className="text-center">Chỉnh sửa</span>
          </div>
        </div>
        <div className="divide-y divide-border/20">
          {localPerms.map(p => (
            <div key={p.tab} className="grid grid-cols-[1fr_100px_100px] gap-2 px-5 py-3 items-center hover:bg-secondary/10">
              <span className="text-sm text-foreground">{TAB_LABELS[p.tab] ?? p.tab}</span>
              <div className="flex justify-center">
                <button
                  onClick={() => toggle(p.tab, "can_view")}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${p.can_view ? "bg-primary" : "bg-border"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${p.can_view ? "left-4" : "left-0.5"}`} />
                </button>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => toggle(p.tab, "can_edit")}
                  className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${p.can_edit ? "bg-primary" : "bg-border"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${p.can_edit ? "left-4" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        💡 Bật "Chỉnh sửa" tự động bật "Xem". Tắt "Xem" tự động tắt "Chỉnh sửa".
      </p>
    </div>
  );
}
