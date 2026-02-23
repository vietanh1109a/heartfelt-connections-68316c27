import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";
import { format } from "date-fns";

interface Props {
  profile: {
    user_id: string;
    available_balance: number;
    bank_name: string | null;
    bank_account: string | null;
    bank_holder: string | null;
  };
  onSuccess: () => void;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Chờ xử lý", variant: "secondary" },
  approved: { label: "Đã duyệt", variant: "default" },
  paid: { label: "Đã chuyển", variant: "default" },
  rejected: { label: "Từ chối", variant: "destructive" },
};

export const CTVWithdraw = ({ profile, onSuccess }: Props) => {
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState(profile.bank_name ?? "");
  const [bankAccount, setBankAccount] = useState(profile.bank_account ?? "");
  const [bankHolder, setBankHolder] = useState(profile.bank_holder ?? "");
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
    if (amountNum > profile.available_balance) {
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
      bank_name: bankName.trim(),
      bank_account: bankAccount.trim(),
      bank_holder: bankHolder.trim(),
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
    <div className="space-y-6 max-w-lg">
      <h2 className="text-xl font-bold text-foreground">Rút tiền</h2>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Số dư khả dụng</p>
            <p className="text-2xl font-bold text-primary">{profile.available_balance.toLocaleString("vi-VN")}đ</p>
          </div>
          <Wallet className="h-8 w-8 text-primary/50" />
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Yêu cầu rút tiền</CardTitle>
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
            <label className="text-sm font-medium text-foreground">Tên chủ tài khoản</label>
            <Input placeholder="NGUYEN VAN A" value={bankHolder} onChange={e => setBankHolder(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={submitting || profile.available_balance <= 0}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
          </Button>
        </CardContent>
      </Card>

      {/* Payout history */}
      {payouts && payouts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Lịch sử rút tiền</h3>
          {payouts.map((p) => {
            const st = statusMap[p.status] ?? { label: p.status, variant: "outline" as const };
            return (
              <Card key={p.id} className="border-border/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground text-sm">{p.amount.toLocaleString("vi-VN")}đ</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd/MM/yy HH:mm")}</p>
                  </div>
                  <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
