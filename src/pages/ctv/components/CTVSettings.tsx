import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, Shield, Award, TrendingUp, CreditCard, Info } from "lucide-react";

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

function getCTVLevel(totalEarned: number) {
  if (totalEarned >= 5000000) return { name: "Gold", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" };
  if (totalEarned >= 1000000) return { name: "Silver", color: "text-foreground", bg: "bg-secondary", border: "border-border" };
  return { name: "Bronze", color: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20" };
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
      {/* Level + Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Card className={`ctv-card ${level.border}`}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={`p-2 rounded-xl ${level.bg}`}>
              <Award className={`h-4 w-4 ${level.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">CTV Level</p>
              <p className={`text-lg font-bold ${level.color}`}>{level.name}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="ctv-card">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Hoa hồng</p>
              <p className="text-lg font-bold text-primary">{profile.commission_rate ?? 10}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="ctv-card">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-green-400/10">
              <Shield className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Tổng thu</p>
              <p className="text-lg font-bold text-green-400">{(profile.total_earned ?? 0).toLocaleString("vi-VN")}đ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3 Cards: Personal, Bank, Account info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Card 1: Personal */}
        <Card className="ctv-card">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Thông tin cá nhân
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Tên hiển thị</label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Số điện thoại</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Zalo</label>
                <Input value={zalo} onChange={e => setZalo(e.target.value)} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Facebook</label>
                <Input placeholder="Link FB" value={fbLink} onChange={e => setFbLink(e.target.value)} className="h-9 rounded-xl" />
              </div>
            </div>
            <Button className="w-full h-9 rounded-xl ctv-glow-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Account + Commission info */}
        <div className="space-y-3">
          <Card className="ctv-card">
            <CardContent className="p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5" /> Thông tin tài khoản
              </h3>
              {[
                { label: "Hoa hồng mặc định", value: `${profile.commission_rate ?? 10}%`, color: "text-primary" },
                { label: "Số dư hiện tại", value: `${(profile.balance ?? 0).toLocaleString("vi-VN")}đ`, color: "text-green-400" },
                { label: "Đã rút", value: `${(profile.total_withdrawn ?? 0).toLocaleString("vi-VN")}đ`, color: "text-foreground" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="ctv-card bg-accent/30">
            <CardContent className="p-3.5 space-y-1.5">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-muted-foreground" /> Lưu ý
              </h3>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p>• Phí thực tế tính theo giá SP (5–10%)</p>
                <p>• Doanh thu giải phóng sau bảo hành</p>
                <p>• Rút tiền xử lý trong 24h làm việc</p>
                <p>• Tên chủ TK phải trùng CMND/CCCD</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
