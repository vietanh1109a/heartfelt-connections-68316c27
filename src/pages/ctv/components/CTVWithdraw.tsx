import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wallet, Clock, ArrowDownToLine, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
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

  const handleSubmit = async () => {
    const amountNum = parseInt(amount);
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
    <div className="space-y-5">
      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Số dư khả dụng</p>
              <p className="text-3xl font-bold text-primary">{profile.available_balance.toLocaleString("vi-VN")}đ</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-400/10">
              <Clock className="h-7 w-7 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Đang chờ duyệt</p>
              <p className="text-3xl font-bold text-yellow-400">{profile.pending_balance.toLocaleString("vi-VN")}đ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowDownToLine className="h-4 w-4" /> Yêu cầu rút tiền
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Số tiền (VNĐ)</label>
                <Input type="number" placeholder="100000" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Ngân hàng</label>
                <Input placeholder="VD: Vietcombank" value={bankName} onChange={e => setBankName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Số tài khoản</label>
                <Input placeholder="Số tài khoản" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Tên chủ TK</label>
                <Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={submitting || availableBalance <= 0}>
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
              {availableBalance <= 0 && (
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Không có số dư để rút
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <div className="lg:col-span-3">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lịch sử rút tiền</CardTitle>
            </CardHeader>
            <CardContent>
              {(!payouts || payouts.length === 0) ? (
                <div className="py-12 text-center space-y-2">
                  <Wallet className="h-8 w-8 mx-auto text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Chưa có yêu cầu rút tiền nào</p>
                </div>
              ) : (
                <div className="space-y-0 divide-y divide-border/20">
                  {payouts.map((p) => {
                    const st = statusConfig[p.status] ?? statusConfig.pending;
                    const Icon = st.icon;
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-3">
                        <div className={`p-1.5 rounded-lg bg-secondary/50 ${st.className}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{p.amount.toLocaleString("vi-VN")}đ</p>
                          <p className="text-xs text-muted-foreground">
                            {p.note || "—"} • {format(new Date(p.created_at), "dd/MM/yy HH:mm")}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold ${st.className}`}>{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
