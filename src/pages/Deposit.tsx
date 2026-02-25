import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Wallet, Copy, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const PRESET_AMOUNTS = [50000, 100000, 200000, 500000];

interface DepositSession {
  deposit_id: string;
  deposit_code: string;
  amount: number;
  expires_at: string;
  qr_url: string;
  account_no: string;
  account_name: string;
  bank_id: string;
}

const Deposit = () => {
  useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [session, setSession] = useState<DepositSession | null>(null);
  const [status, setStatus] = useState<"pending" | "paid" | "expired" | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finalAmount = customAmount ? Number(customAmount.replace(/\D/g, "")) : selectedAmount;

  // Countdown timer
  useEffect(() => {
    if (!session || status !== "pending") return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) {
        setStatus("expired");
        clearInterval(timerRef.current!);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current!);
  }, [session, status]);

  // Poll deposit status
  useEffect(() => {
    if (!session || status !== "pending") {
      clearInterval(pollRef.current!);
      return;
    }

    const poll = async () => {
      const { data } = await (supabase as any)
        .from("deposits")
        .select("status")
        .eq("id", session.deposit_id)
        .single();

      if (data?.status === "paid") {
        setStatus("paid");
        clearInterval(pollRef.current!);
        await refetchProfile();
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success("🎉 Nạp tiền thành công! Số dư đã được cập nhật.");
      } else if (data?.status === "expired") {
        setStatus("expired");
        clearInterval(pollRef.current!);
      }
    };

    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current!);
  }, [session, status]);

  const handleCreateDeposit = async () => {
    if (!finalAmount || finalAmount < 10000) {
      toast.error("Số tiền tối thiểu là 10,000đ");
      return;
    }

    setIsCreating(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-deposit`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ amount: finalAmount }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Lỗi tạo mã nạp");
      }

      const data: DepositSession = await res.json();
      setSession(data);
      setStatus("pending");
    } catch (err: any) {
      toast.error(err.message ?? "Không thể tạo mã nạp tiền");
    } finally {
      setIsCreating(false);
    }
  };

  const handleReset = () => {
    clearInterval(pollRef.current!);
    clearInterval(timerRef.current!);
    setSession(null);
    setStatus(null);
    setTimeLeft(0);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã copy ${label}!`);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-border/30">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          NẠP TIỀN
        </h1>
        <div className="ml-auto flex items-center gap-2 bg-secondary/80 rounded-full px-4 py-2">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-foreground font-semibold text-sm">
            {(profile?.balance ?? 0).toLocaleString("vi-VN")}đ
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: Choose amount */}
          {!session && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-border/50 bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Chọn số tiền nạp</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Preset amounts */}
                  <div className="grid grid-cols-2 gap-3">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                        className={`rounded-xl border-2 py-3 font-bold text-sm transition-all ${
                          selectedAmount === amt && !customAmount
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/40 bg-secondary/30 text-foreground hover:border-primary/50"
                        }`}
                      >
                        {amt.toLocaleString("vi-VN")}đ
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Hoặc nhập số tiền khác</label>
                    <Input
                      placeholder="Ví dụ: 150000"
                      value={customAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setCustomAmount(raw);
                        if (raw) setSelectedAmount(0);
                      }}
                      className="text-lg font-semibold"
                    />
                    {customAmount && Number(customAmount) > 0 && (
                      <p className="text-xs text-muted-foreground">
                        = {Number(customAmount).toLocaleString("vi-VN")}đ
                      </p>
                    )}
                  </div>

                  <div className="bg-secondary/30 rounded-lg p-3 text-sm text-muted-foreground space-y-1">
                    <p>• Nạp tối thiểu: <span className="text-foreground font-medium">10,000đ</span></p>
                    <p>• Tỉ lệ: <span className="text-foreground font-medium">1đ = 1 VNĐ · 500đ = 1 lượt xem</span></p>
                    <p>• Thời gian chờ: <span className="text-foreground font-medium">1–5 phút</span></p>
                  </div>

                  <Button
                    className="w-full h-12 text-base font-bold"
                    onClick={handleCreateDeposit}
                    disabled={isCreating || !finalAmount || finalAmount < 10000}
                  >
                    {isCreating ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Đang tạo mã...</>
                    ) : (
                      `Tạo mã nạp ${finalAmount > 0 ? finalAmount.toLocaleString("vi-VN") + "đ" : ""}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: QR + waiting */}
          {session && status === "pending" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Timer */}
              <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Mã hết hạn sau
                </div>
                <span className={`font-mono font-bold text-lg ${timeLeft < 120 ? "text-destructive" : "text-foreground"}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground text-base flex items-center justify-between">
                    Quét QR để chuyển khoản
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Đang chờ...
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* QR */}
                  <div className="flex justify-center">
                    <div className="bg-white rounded-xl p-4 shadow-lg">
                      <img
                        src={session.qr_url}
                        alt="VietQR"
                        className="w-60 h-auto"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder.svg";
                        }}
                      />
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-2">
                    {[
                      { label: "Ngân hàng", value: session.bank_id },
                      { label: "Số tài khoản", value: session.account_no, copy: true },
                      { label: "Tên TK", value: session.account_name },
                      { label: "Số tiền", value: `${session.amount.toLocaleString("vi-VN")}đ` },
                      { label: "Nội dung CK", value: session.deposit_code, copy: true, highlight: true },
                    ].map(({ label, value, copy, highlight }) => (
                      <div key={label} className={`flex justify-between items-center rounded-lg px-3 py-2 ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}>
                        <span className="text-muted-foreground text-sm">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-sm ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
                          {copy && (
                            <button onClick={() => copyText(value, label)} className="text-muted-foreground hover:text-primary">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning-foreground">
                    ⚡ Ghi <strong>đúng nội dung</strong> chuyển khoản{" "}
                    <strong className="text-primary">{session.deposit_code}</strong>{" "}
                    để hệ thống tự động cộng tiền. Số dư cập nhật trong 1–5 phút.
                  </div>

                  <Button variant="outline" className="w-full" onClick={handleReset}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Tạo mã mới
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3: Success */}
          {status === "paid" && session && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex justify-center"
              >
                <div className="p-6 rounded-full bg-chart-2/20">
                  <CheckCircle2 className="h-16 w-16 text-chart-2" />
                </div>
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Nạp tiền thành công!</h2>
                <p className="text-muted-foreground">
                  Đã cộng{" "}
                  <span className="text-chart-2 font-bold">
                    +{session.amount.toLocaleString("vi-VN")}đ
                  </span>{" "}
                  vào tài khoản của bạn.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Mã: <span className="font-mono text-primary">{session.deposit_code}</span>
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleReset}>Nạp thêm</Button>
                <Button onClick={() => navigate("/")}>Về trang chủ</Button>
              </div>
            </motion.div>
          )}

          {/* STEP 4: Expired */}
          {status === "expired" && (
            <motion.div
              key="expired"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 py-8"
            >
              <div className="p-5 rounded-full bg-destructive/10 inline-flex">
                <Clock className="h-12 w-12 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Mã nạp đã hết hạn</h2>
                <p className="text-muted-foreground text-sm mt-1">Vui lòng tạo mã mới để tiếp tục nạp tiền.</p>
              </div>
              <Button onClick={handleReset}>Tạo mã mới</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Deposit;
