import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, Shield, Award, TrendingUp } from "lucide-react";

interface Props {
  profile: {
    user_id: string;
    display_name: string;
    phone?: string | null;
    zalo?: string | null;
    fb_link?: string | null;
    commission_rate?: number;
    total_earned?: number;
    total_withdrawn?: number;
    balance?: number;
    [key: string]: any;
  };
  onSuccess: () => void;
}

// CTV Level based on total_earned
function getCTVLevel(totalEarned: number) {
  if (totalEarned >= 5000000) return { name: "Gold", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/30" };
  if (totalEarned >= 1000000) return { name: "Silver", color: "text-foreground", bg: "bg-secondary", border: "border-border" };
  return { name: "Bronze", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/30" };
}

export const CTVSettings = ({ profile, onSuccess }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [zalo, setZalo] = useState(profile.zalo ?? "");
  const [fbLink, setFbLink] = useState(profile.fb_link ?? "");
  const [saving, setSaving] = useState(false);

  const level = getCTVLevel(profile.total_earned ?? 0);

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
        phone: phone.trim() || null,
        zalo: zalo.trim() || null,
        fb_link: fbLink.trim() || null,
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
    <div className="space-y-4">
      {/* CTV Level badge + quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className={`border ${level.border}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${level.bg}`}>
              <Award className={`h-5 w-5 ${level.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">CTV Level</p>
              <p className={`text-lg font-bold ${level.color}`}>{level.name}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Hoa hồng</p>
              <p className="text-lg font-bold text-primary">{profile.commission_rate ?? 10}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-400/10">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tổng thu</p>
              <p className="text-lg font-bold text-green-400">{(profile.total_earned ?? 0).toLocaleString("vi-VN")}đ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Form */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Thông tin cá nhân
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Tên hiển thị</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Số điện thoại</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Zalo</label>
                  <Input value={zalo} onChange={e => setZalo(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Facebook</label>
                  <Input placeholder="Link FB" value={fbLink} onChange={e => setFbLink(e.target.value)} className="h-9" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full h-9" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>

        {/* Info sidebar */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Phí mặc định</span>
                <span className="text-primary font-bold">{profile.commission_rate ?? 10}%</span>
              </div>
              <div className="h-px bg-border/30" />
              <div className="text-[10px] text-muted-foreground space-y-1">
                <p>• Phí thực tế tính theo giá SP (5–10%)</p>
                <p>• Doanh thu giải phóng sau bảo hành</p>
                <p>• Rút tiền xử lý trong 24h</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-secondary/50">
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">
                💡 Điền đầy đủ thông tin ngân hàng để rút tiền nhanh hơn. Tên chủ TK phải trùng với CMND/CCCD.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
