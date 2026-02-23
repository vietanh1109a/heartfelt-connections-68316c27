import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Props {
  profile: {
    user_id: string;
    display_name: string;
    contact_info: string | null;
    bank_name: string | null;
    bank_account: string | null;
    bank_holder: string | null;
    commission_rate: number;
  };
  onSuccess: () => void;
}

export const CTVSettings = ({ profile, onSuccess }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [contactInfo, setContactInfo] = useState(profile.contact_info ?? "");
  const [bankName, setBankName] = useState(profile.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(profile.bank_account ?? "");
  const [bankHolder, setBankHolder] = useState(profile.bank_holder ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      toast({ title: "Tên hiển thị không được để trống", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("ctv_profiles")
      .update({
        display_name: displayName.trim(),
        contact_info: contactInfo.trim() || null,
        bank_name: bankName.trim() || null,
        bank_account: bankAccount.trim() || null,
        bank_holder: bankHolder.trim() || null,
      })
      .eq("user_id", profile.user_id);
    setSaving(false);

    if (error) {
      toast({ title: "Lỗi cập nhật", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Đã lưu thông tin" });
      onSuccess();
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-xl font-bold text-foreground">Cài đặt CTV</h2>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thông tin cá nhân</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tên hiển thị</label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Liên hệ (Telegram/Zalo)</label>
            <Input value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thông tin ngân hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Ngân hàng</label>
            <Input placeholder="VD: Vietcombank" value={bankName} onChange={e => setBankName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Số tài khoản</label>
            <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tên chủ TK</label>
            <Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Phí nền tảng</span>
          <span className="text-sm font-bold text-primary">{(Number(profile.commission_rate) * 100).toFixed(0)}%</span>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </div>
  );
};
