import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Save, RefreshCw } from "lucide-react";
import { ModeratorPermissionsPanel } from "./ModeratorPermissionsPanel";

const SETTINGS_META: Record<string, { label: string; description: string; prefix?: string; suffix?: string; type?: string }> = {
  bank_id:              { label: "Mã ngân hàng", description: "VD: MB, VCB, TCB, ACB, BIDV..." },
  account_no:           { label: "Số tài khoản", description: "Số tài khoản ngân hàng nhận tiền" },
  account_name:         { label: "Tên chủ tài khoản", description: "Tên chủ tài khoản (viết hoa không dấu)" },
  exchange_rate:        { label: "Tỷ giá quy đổi", description: "1.000 VNĐ = X $", suffix: "$ / 1.000 VNĐ", type: "number" },
  min_deposit_vnd:      { label: "Nạp tối thiểu (VNĐ)", description: "Số tiền nạp tối thiểu mỗi lần", suffix: "VNĐ", type: "number" },
  allowed_origin:       { label: "Domain cho phép (CORS)", description: "Chỉ domain này được gọi API. Dùng * để cho phép tất cả. VD: https://yourapp.com" },
  link_extension:       { label: "Link tải Extension", description: "Link Google Drive hoặc link tải file extension về máy" },
  link_guide_youtube:   { label: "Link hướng dẫn YouTube", description: "Link video hướng dẫn cài đặt Extension trên YouTube" },
  link_facebook:        { label: "Link Facebook", description: "Link trang Facebook fanpage" },
  link_instagram:       { label: "Link Instagram", description: "Link tài khoản Instagram" },
  link_threads:         { label: "Link Threads", description: "Link tài khoản Threads" },
  link_tiktok:          { label: "Link TikTok", description: "Link tài khoản TikTok" },
  link_telegram:        { label: "Link Telegram", description: "Link nhóm/kênh Telegram" },
  link_support:         { label: "Link Contact Support", description: "Link hỗ trợ khách hàng (Messenger, Zalo, email...)" },
  free_bonus_views:     { label: "Lượt xem miễn phí", description: "Số lượt xem bonus cấp cho người mới đăng ký", suffix: "lượt", type: "number" },
  free_bonus_days:      { label: "Hết hạn lượt xem (ngày)", description: "Số ngày bonus_expires_at từ ngày đăng ký", suffix: "ngày", type: "number" },
  free_cookie_slots:    { label: "Tài khoản cấp cho Free", description: "Số slot cookie cấp cho mỗi user FREE", suffix: "slot", type: "number" },
  vip_cookie_slots:     { label: "Tài khoản cấp cho VIP", description: "Số slot cookie cấp cho mỗi user VIP", suffix: "slot", type: "number" },
  free_monthly_switches:{ label: "Lượt đổi/tháng (Free)", description: "Số lần đổi tài khoản cho user Free mỗi tháng", suffix: "lượt", type: "number" },
  vip_monthly_switches: { label: "Lượt đổi/tháng (VIP)", description: "Số lần đổi tài khoản cho user VIP mỗi tháng", suffix: "lượt", type: "number" },
};

async function saveKeys(keys: string[], editValues: Record<string, string>) {
  const updates = keys.map((id) =>
    supabase.from("app_settings").upsert({ id, value: editValues[id] ?? "", updated_at: new Date().toISOString() })
  );
  const results = await Promise.all(updates);
  return results.some((r) => r.error);
}

// ─── Section Save Button ──────────────────────────────────────────────────────
function SectionHeader({
  title, subtitle, keys, editValues, savedValues, onSave, onReset, saving,
}: {
  title: string; subtitle: string; keys: string[];
  editValues: Record<string, string>; savedValues: Record<string, string>;
  onSave: () => void; onReset: () => void; saving: boolean;
}) {
  const hasChanges = keys.some((k) => editValues[k] !== savedValues[k]);
  return (
    <div className="px-5 py-3 border-b border-border/30 bg-secondary/20 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
      {hasChanges && (
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onReset} className="gap-1 text-xs h-7 px-2">
            <RefreshCw className="h-3 w-3" /> Hoàn tác
          </Button>
          <Button size="sm" onClick={onSave} disabled={saving} className="gap-1 text-xs h-7 px-2">
            <Save className="h-3 w-3" />
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("id");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((s) => { map[s.id] = s.value; });
      setEditValues({ ...map });
      setSavedValues({ ...map });
      return map;
    },
  });

  const handleSaveSection = async (sectionKey: string, keys: string[]) => {
    setSaving(sectionKey);
    const hasError = await saveKeys(keys, editValues);
    if (hasError) {
      toast.error("Lỗi lưu một số cài đặt");
    } else {
      toast.success("✅ Đã lưu!");
      setSavedValues((prev) => {
        const next = { ...prev };
        keys.forEach((k) => { next[k] = editValues[k] ?? ""; });
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    }
    setSaving(null);
  };

  const handleResetSection = (keys: string[]) => {
    setEditValues((prev) => {
      const next = { ...prev };
      keys.forEach((k) => { next[k] = savedValues[k] ?? ""; });
      return next;
    });
  };

  const set = (key: string, val: string) =>
    setEditValues((prev) => ({ ...prev, [key]: val }));

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Đang tải cài đặt...</div>;
  }

  const BANK_KEYS = ["bank_id", "account_no", "account_name"];
  const RATE_KEYS = ["exchange_rate", "min_deposit_vnd"];
  const CORS_KEYS = ["allowed_origin"];
  const LINK_KEYS = ["link_extension", "link_guide_youtube", "link_facebook", "link_instagram", "link_threads", "link_tiktok", "link_telegram", "link_support"];
  const GAME_KEYS = ["free_bonus_views", "free_bonus_days", "free_cookie_slots", "vip_cookie_slots", "free_monthly_switches", "vip_monthly_switches"];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-foreground font-bold text-lg">Cấu hình hệ thống</h2>
      </div>

      {/* Bank Info */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <SectionHeader
          title="💳 Thông tin ngân hàng"
          subtitle="Dùng để tạo mã VietQR trên trang nạp tiền"
          keys={BANK_KEYS}
          editValues={editValues}
          savedValues={savedValues}
          onSave={() => handleSaveSection("bank", BANK_KEYS)}
          onReset={() => handleResetSection(BANK_KEYS)}
          saving={saving === "bank"}
        />
        <div className="divide-y divide-border/20">
          {BANK_KEYS.map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-foreground">{meta.label}</label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
                <Input
                  value={editValues[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-52 bg-secondary border-border/40 text-sm font-mono"
                  placeholder={meta.label}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Exchange Rate */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <SectionHeader
          title="💰 Tỷ giá & Nạp tiền"
          subtitle="Điều chỉnh tỷ giá quy đổi VNĐ sang $"
          keys={RATE_KEYS}
          editValues={editValues}
          savedValues={savedValues}
          onSave={() => handleSaveSection("rate", RATE_KEYS)}
          onReset={() => handleResetSection(RATE_KEYS)}
          saving={saving === "rate"}
        />
        <div className="divide-y divide-border/20">
          {RATE_KEYS.map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-foreground">{meta.label}</label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editValues[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-32 bg-secondary border-border/40 text-sm font-mono"
                    placeholder="0"
                  />
                  {meta.suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{meta.suffix}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CORS */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <SectionHeader
          title="🔒 Bảo mật API (CORS)"
          subtitle="Giới hạn domain có thể gọi backend"
          keys={CORS_KEYS}
          editValues={editValues}
          savedValues={savedValues}
          onSave={() => handleSaveSection("cors", CORS_KEYS)}
          onReset={() => handleResetSection(CORS_KEYS)}
          saving={saving === "cors"}
        />
        <div className="divide-y divide-border/20">
          <div className="px-5 py-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-foreground">{SETTINGS_META["allowed_origin"].label}</label>
              <p className="text-xs text-muted-foreground mt-0.5">{SETTINGS_META["allowed_origin"].description}</p>
            </div>
            <Input
              value={editValues["allowed_origin"] ?? ""}
              onChange={(e) => set("allowed_origin", e.target.value)}
              className="w-64 bg-secondary border-border/40 text-sm font-mono"
              placeholder="https://yourapp.com"
            />
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <SectionHeader
          title="🔗 Liên kết & Mạng xã hội"
          subtitle="Link tải Extension, hướng dẫn YouTube, mạng xã hội và hỗ trợ"
          keys={LINK_KEYS}
          editValues={editValues}
          savedValues={savedValues}
          onSave={() => handleSaveSection("links", LINK_KEYS)}
          onReset={() => handleResetSection(LINK_KEYS)}
          saving={saving === "links"}
        />
        <div className="divide-y divide-border/20">
          {LINK_KEYS.map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-foreground">{meta.label}</label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
                <Input
                  value={editValues[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-72 bg-secondary border-border/40 text-sm font-mono"
                  placeholder="https://..."
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* VietQR Preview */}
      {editValues.bank_id && editValues.account_no && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-primary">Preview VietQR URL:</p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            https://img.vietqr.io/image/{editValues.bank_id}-{editValues.account_no}-compact.png
          </p>
          <p className="text-xs text-muted-foreground">
            Tỷ giá: 1.000 VNĐ = <strong className="text-foreground">${editValues.exchange_rate}</strong> &nbsp;|&nbsp;
            Tối thiểu: <strong className="text-foreground">{Number(editValues.min_deposit_vnd || 0).toLocaleString("vi-VN")} VNĐ</strong>
          </p>
        </div>
      )}

      {/* Game / User Settings */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <SectionHeader
          title="🎮 Cài đặt hệ thống người dùng"
          subtitle="Cấu hình lượt xem, hạn dùng và số tài khoản cấp cho từng loại user"
          keys={GAME_KEYS}
          editValues={editValues}
          savedValues={savedValues}
          onSave={() => handleSaveSection("game", GAME_KEYS)}
          onReset={() => handleResetSection(GAME_KEYS)}
          saving={saving === "game"}
        />
        <div className="divide-y divide-border/20">
          {GAME_KEYS.map((key) => {
            const meta = SETTINGS_META[key];
            return (
              <div key={key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <label className="text-sm font-medium text-foreground">{meta.label}</label>
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={editValues[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)}
                    className="w-24 bg-secondary border-border/40 text-sm font-mono text-center"
                    placeholder="0"
                  />
                  {meta.suffix && <span className="text-xs text-muted-foreground whitespace-nowrap">{meta.suffix}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Moderator Permissions */}
      <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30 bg-secondary/20">
          <p className="text-sm font-semibold text-foreground">🛡️ Quyền Moderator (CTV)</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cấu hình tab nào Moderator có thể xem và chỉnh sửa</p>
        </div>
        <div className="p-5">
          <ModeratorPermissionsPanel />
        </div>
      </div>
    </div>
  );
}
