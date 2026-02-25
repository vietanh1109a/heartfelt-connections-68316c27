import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wallet, Clock, ArrowDownToLine, CheckCircle, XCircle, AlertTriangle, Banknote } from "lucide-react";
import { format } from "date-fns";

const stCfg: Record<string, { label: string; icon: typeof CheckCircle; cls: string }> = {
  pending: { label: "Chờ", icon: Clock, cls: "text-yellow-400" },
  approved: { label: "Duyệt", icon: CheckCircle, cls: "text-emerald-400" },
  paid: { label: "Đã TT", icon: CheckCircle, cls: "text-emerald-400" },
  rejected: { label: "Từ chối", icon: XCircle, cls: "text-red-400" },
};

interface Props { profile: { user_id: string; balance?: number; total_withdrawn?: number; [k: string]: any }; onSuccess: () => void; }

export const CTVWithdraw = ({ profile, onSuccess }: Props) => {
  const bal = profile.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: payouts, refetch } = useQuery({
    queryKey: ["ctv-payouts", profile.user_id],
    queryFn: async () => { const { data } = await supabase.from("ctv_payout_requests").select("*").eq("ctv_user_id", profile.user_id).order("created_at", { ascending: false }).limit(20); return data ?? []; },
  });

  const pending = useMemo(() => payouts?.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0) ?? 0, [payouts]);
  const withdrawn = useMemo(() => payouts?.filter(p => ["paid","approved"].includes(p.status)).reduce((s, p) => s + p.amount, 0) ?? profile.total_withdrawn ?? 0, [payouts, profile.total_withdrawn]);

  const num = parseInt(amount) || 0;
  const receive = num;

  const handleSubmit = async () => {
    if (num <= 0) { toast({ title: "Số tiền không hợp lệ", variant: "destructive" }); return; }
    if (num > bal) { toast({ title: "Số dư không đủ", variant: "destructive" }); return; }
    if (!bankName.trim() || !bankAccount.trim() || !bankHolder.trim()) { toast({ title: "Điền đầy đủ thông tin", variant: "destructive" }); return; }
    setSubmitting(true);
    const { error } = await supabase.from("ctv_payout_requests").insert({ ctv_user_id: profile.user_id, amount: num, note: `${bankName.trim()} - ${bankAccount.trim()} - ${bankHolder.trim()}` });
    setSubmitting(false);
    if (error) toast({ title: "Lỗi", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Đã gửi yêu cầu rút tiền" }); setAmount(""); refetch(); onSuccess(); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Khả dụng", value: bal, icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
          { label: "Đang chờ", value: pending, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
          { label: "Đã rút", value: withdrawn, icon: Banknote, color: "text-emerald-400", bg: "bg-emerald-500/10" },
        ].map((s, i) => { const Icon = s.icon; return (
          <Card key={i} className="dash-card dash-card-hover">
            <CardContent className="p-4">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString("vi-VN")}đ</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ); })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="dash-card">
          <CardContent className="p-5 space-y-4">
            <h3 className="dash-section-title flex items-center gap-2"><ArrowDownToLine className="h-3.5 w-3.5" /> Rút tiền</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Số tiền (VNĐ)</label>
              <Input type="number" placeholder="100000" value={amount} onChange={e => setAmount(e.target.value)} className="h-9" />
              {num > 0 && <p className="text-[11px] text-muted-foreground">Nhận: <span className="text-primary font-medium">{receive.toLocaleString("vi-VN")}đ</span></p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Ngân hàng</label>
              <Input placeholder="VD: Vietcombank" value={bankName} onChange={e => setBankName(e.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Số TK</label><Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Chủ TK</label><Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="h-9" /></div>
            </div>
            <Button className="w-full h-9 dash-glow-btn" onClick={handleSubmit} disabled={submitting || bal <= 0 || num <= 0 || num > bal}>
              {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </Button>
            {bal <= 0 && <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" /> Không có số dư</p>}
          </CardContent>
        </Card>

        <Card className="dash-card">
          <CardContent className="p-5">
            <h3 className="dash-section-title mb-4">Lịch sử</h3>
            {!payouts?.length ? (
              <div className="py-10 text-center"><Wallet className="h-6 w-6 mx-auto text-muted-foreground/10 mb-2" /><p className="text-xs text-muted-foreground">Chưa có yêu cầu</p></div>
            ) : (
              <div className="space-y-1">
                {payouts.map(p => { const st = stCfg[p.status] ?? stCfg.pending; const Icon = st.icon; return (
                  <div key={p.id} className="flex items-center gap-2.5 py-2.5 px-1 rounded-lg hover:bg-accent/30 transition-colors">
                    <div className={`w-7 h-7 rounded-md bg-accent flex items-center justify-center ${st.cls}`}><Icon className="h-3.5 w-3.5" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{p.amount.toLocaleString("vi-VN")}đ</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.note || "—"} · {format(new Date(p.created_at), "dd/MM HH:mm")}</p>
                    </div>
                    <span className={`text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                ); })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
