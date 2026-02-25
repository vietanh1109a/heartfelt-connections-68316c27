import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, Building2, Shield } from "lucide-react";

interface Props {
  profile: {
    user_id: string;
    display_name: string;
    phone?: string | null;
    zalo?: string | null;
    fb_link?: string | null;
    commission_rate?: number;
    [key: string]: any;
  };
  onSuccess: () => void;
}

export const CTVSettings = ({ profile, onSuccess }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [zalo, setZalo] = useState(profile.zalo ?? "");
  const [fbLink, setFbLink] = useState(profile.fb_link ?? "");
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
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Forms */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Thông tin cá nhân
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tên hiển thị</label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Số điện thoại</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Zalo</label>
                  <Input value={zalo} onChange={e => setZalo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Facebook</label>
                  <Input placeholder="Link FB" value={fbLink} onChange={e => setFbLink(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>

        {/* Info sidebar */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" /> Thông tin tài khoản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phí nền tảng mặc định</span>
                <span className="text-primary font-bold">{profile.commission_rate ?? 10}%</span>
              </div>
              <div className="h-px bg-border/30" />
              <div className="text-xs text-muted-foreground space-y-1.5">
                <p>• Phí thực tế tính theo giá sản phẩm (5–10%)</p>
                <p>• Doanh thu được giải phóng sau thời gian bảo hành</p>
                <p>• Rút tiền xử lý trong 24h ngày làm việc</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-primary/5">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
                💡 Điền đầy đủ thông tin ngân hàng để rút tiền nhanh hơn. Tên chủ TK phải trùng với CMND/CCCD.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
