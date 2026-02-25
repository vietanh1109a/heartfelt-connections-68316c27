import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, Shield, Award, TrendingUp, CreditCard, Info } from "lucide-react";

interface Props {
  profile: { user_id: string; display_name: string; phone?: string | null; zalo?: string | null; fb_link?: string | null; commission_rate?: number; total_earned?: number; total_withdrawn?: number; balance?: number; [k: string]: any; };
  onSuccess: () => void;
}

function getLevel(e: number) {
  if (e >= 5000000) return { name: "Gold", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: "🏆" };
  if (e >= 1000000) return { name: "Silver", color: "text-slate-300", bg: "bg-slate-400/10", icon: "🥈" };
  return { name: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10", icon: "🥉" };
}

export const CTVSettings = ({ profile, onSuccess }: Props) => {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [zalo, setZalo] = useState(profile.zalo ?? "");
  const [fbLink, setFbLink] = useState(profile.fb_link ?? "");
  const [saving, setSaving] = useState(false);
  const level = getLevel(profile.total_earned ?? 0);

  const handleSave = async () => {
    if (!displayName.trim()) { toast({ title: "Tên không được trống", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("ctv_profiles").update({ display_name: displayName.trim(), phone: phone.trim() || null, zalo: zalo.trim() || null, fb_link: fbLink.trim() || null }).eq("user_id", profile.user_id);
    setSaving(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Đã lưu" }); onSuccess(); }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Level", value: `${level.icon} ${level.name}`, icon: Award, color: level.color, bg: level.bg },
          { label: "Hoa hồng", value: `${profile.commission_rate ?? 10}%`, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" },
          { label: "Tổng thu", value: `${(profile.total_earned ?? 0).toLocaleString("vi-VN")}đ`, icon: Shield, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        ].map((s, i) => { const Icon = s.icon; return (
          <Card key={i} className="dash-card dash-card-hover">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center`}><Icon className={`h-4 w-4 ${s.color}`} /></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-base font-bold ${s.color}`}>{s.value}</p></div>
            </CardContent>
          </Card>
        ); })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="dash-card">
          <CardContent className="p-5 space-y-4">
            <h3 className="dash-section-title flex items-center gap-2"><User className="h-3.5 w-3.5" /> Thông tin cá nhân</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Tên hiển thị</label><Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Số điện thoại</label><Input value={phone} onChange={e => setPhone(e.target.value)} className="h-9" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Zalo</label><Input value={zalo} onChange={e => setZalo(e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Facebook</label><Input placeholder="Link FB" value={fbLink} onChange={e => setFbLink(e.target.value)} className="h-9" /></div>
            </div>
            <Button className="w-full h-9 dash-glow-btn" onClick={handleSave} disabled={saving}>{saving ? "Đang lưu..." : "Lưu thay đổi"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card className="dash-card">
            <CardContent className="p-5 space-y-3">
              <h3 className="dash-section-title flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" /> Tài khoản</h3>
              {[
                { label: "Hoa hồng", value: `${profile.commission_rate ?? 10}%`, color: "text-primary" },
                { label: "Số dư", value: `${(profile.balance ?? 0).toLocaleString("vi-VN")}đ`, color: "text-emerald-400" },
                { label: "Đã rút", value: `${(profile.total_withdrawn ?? 0).toLocaleString("vi-VN")}đ`, color: "text-foreground" },
              ].map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="dash-card">
            <CardContent className="p-4 space-y-1.5">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5 text-muted-foreground" /> Lưu ý</h3>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p>• Phí tính theo giá SP (5–10%)</p>
                <p>• Doanh thu sau bảo hành</p>
                <p>• Rút tiền xử lý 24h</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
