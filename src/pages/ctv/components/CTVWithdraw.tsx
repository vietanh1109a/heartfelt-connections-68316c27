import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wallet, Clock, ArrowDownToLine, CheckCircle, XCircle, AlertTriangle, Banknote } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; className: string }> = {
  pending: { label: "Chờ xử lý", icon: Clock, className: "text-yellow-400" },
  approved: { label: "Đã duyệt", icon: CheckCircle, className: "text-green-400" },
  paid: { label: "Đã chuyển", icon: CheckCircle, className: "text-green-400" },
  rejected: { label: "Từ chối", icon: XCircle, className: "text-destructive" },
};

interface Props {
  profile: {
    user_id: string;
    balance?: number;
    total_withdrawn?: number;
    [key: string]: any;
  };
  onSuccess: () => void;
}

export const CTVWithdraw = ({ profile, onSuccess }: Props) => {
  const availableBalance = profile.balance ?? 0;
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: payouts, refetch } = useQuery({
    queryKey: ["ctv-payouts", profile.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ctv_payout_requests")
        .select("*")
        .eq("ctv_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const pendingAmount = useMemo(() => {
    if (!payouts) return 0;
    return payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  }, [payouts]);

  const totalWithdrawn = useMemo(() => {
    if (!payouts) return profile.total_withdrawn ?? 0;
    return payouts.filter(p => p.status === "paid" || p.status === "approved").reduce((sum, p) => sum + p.amount, 0);
  }, [payouts, profile.total_withdrawn]);

  const amountNum = parseInt(amount) || 0;
  const fee = Math.round(amountNum * 0); // No fee currently
  const receive = amountNum - fee;

  const handleSubmit = async () => {
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: "Số tiền không hợp lệ", variant: "destructive" });
      return;
    }
    if (amountNum > availableBalance) {
      toast({ title: "Số dư không đủ", variant: "destructive" });
      return;
    }
    if (!bankName.trim() || !bankAccount.trim() || !bankHolder.trim()) {
      toast({ title: "Vui lòng điền đầy đủ thông tin ngân hàng", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("ctv_payout_requests").insert({
      ctv_user_id: profile.user_id,
      amount: amountNum,
      note: `${bankName.trim()} - ${bankAccount.trim()} - ${bankHolder.trim()}`,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Lỗi gửi yêu cầu", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Đã gửi yêu cầu rút tiền" });
      setAmount("");
      refetch();
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      {/* 3 KPI cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Khả dụng", value: availableBalance, icon: Wallet, color: "text-primary", iconBg: "bg-primary/10" },
          { label: "Đang chờ", value: pendingAmount, icon: Clock, color: "text-yellow-400", iconBg: "bg-yellow-400/10" },
          { label: "Đã rút", value: totalWithdrawn, icon: Banknote, color: "text-green-400", iconBg: "bg-green-400/10" },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="ctv-card ctv-card-hover">
              <CardContent className="p-3 flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${s.iconBg}`}>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value.toLocaleString("vi-VN")}đ</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 50/50 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Form */}
        <Card className="ctv-card">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ArrowDownToLine className="h-3.5 w-3.5" /> Yêu cầu rút tiền
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Số tiền (VNĐ)</label>
              <Input type="number" placeholder="100000" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 rounded-xl" />
              {amountNum > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Bạn sẽ nhận: <span className="text-primary font-semibold">{receive.toLocaleString("vi-VN")}đ</span>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Ngân hàng</label>
              <Input placeholder="VD: Vietcombank" value={bankName} onChange={e => setBankName(e.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Số tài khoản</label>
                <Input placeholder="Số TK" value={bankAccount} onChange={e => setBankAccount(e.target.value)} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Chủ TK</label>
                <Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="h-9 rounded-xl" />
              </div>
            </div>
            <Button
              className="w-full h-9 rounded-xl ctv-glow-btn"
              onClick={handleSubmit}
              disabled={submitting || availableBalance <= 0 || amountNum <= 0 || amountNum > availableBalance}
            >
              {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
            </Button>
            {availableBalance <= 0 && (
              <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Không có số dư để rút
              </p>
            )}
          </CardContent>
        </Card>

        {/* History */}
        <Card className="ctv-card">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Lịch sử rút tiền</h3>
            {(!payouts || payouts.length === 0) ? (
              <div className="py-10 text-center space-y-2">
                <Wallet className="h-7 w-7 mx-auto text-muted-foreground/15" />
                <p className="text-xs text-muted-foreground">Chưa có yêu cầu nào</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {payouts.map((p) => {
                  const st = statusConfig[p.status] ?? statusConfig.pending;
                  const Icon = st.icon;
                  return (
                    <div key={p.id} className="flex items-center gap-2.5 py-2.5">
                      <div className={`p-1.5 rounded-lg bg-accent ${st.className}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{p.amount.toLocaleString("vi-VN")}đ</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {p.note || "—"} • {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
                        </p>
                      </div>
                      <span className={`text-[10px] font-semibold ${st.className}`}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
