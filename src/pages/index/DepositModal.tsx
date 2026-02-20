import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
  X, Wallet, Copy, CheckCircle2, Clock,
  Loader2, RefreshCw, Zap, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";

const PRESET_AMOUNTS = [
  { label: "30k",  value: 30000 },
  { label: "50k",  value: 50000 },
  { label: "100k", value: 100000 },
  { label: "200k", value: 200000 },
];

const DEPOSIT_SESSION_KEY = "deposit_session_v1";

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

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedAmount({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const displayed = useTransform(motionVal, (v) => Math.round(v).toLocaleString("vi-VN"));
  const [display, setDisplay] = useState("0");
  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.4, ease: "easeOut" });
    const unsub = displayed.on("change", (v) => setDisplay(v));
    return () => { controls.stop(); unsub(); };
  }, [value]);
  return <span>{display}</span>;
}

// ─── Ring timer ───────────────────────────────────────────────────────────────
function RingTimer({ timeLeft, totalTime = 1800 }: { timeLeft: number; totalTime?: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, timeLeft / totalTime);
  const isLow = timeLeft < 120;
  return (
    <div className="relative flex items-center justify-center h-12 w-12 shrink-0">
      <svg width="48" height="48" className="-rotate-90 absolute inset-0">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={isLow ? "#E50914" : "rgba(229,9,20,0.6)"}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ - circ * progress}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className={`font-mono font-bold text-[11px] leading-none z-10 ${isLow ? "text-destructive" : "text-foreground"}`}>
        {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

export const DepositModal = ({ open, onClose }: Props) => {
  const { data: profile, refetch: refetchProfile } = useProfile();
  const queryClient = useQueryClient();

  const [selectedAmount, setSelectedAmount] = useState<number>(100000);
  const [customRaw, setCustomRaw] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [session, setSession] = useState<DepositSession | null>(() => {
    try {
      const saved = localStorage.getItem(DEPOSIT_SESSION_KEY);
      if (!saved) return null;
      const parsed: DepositSession = JSON.parse(saved);
      // Drop if already expired
      if (new Date(parsed.expires_at) < new Date()) {
        localStorage.removeItem(DEPOSIT_SESSION_KEY);
        return null;
      }
      return parsed;
    } catch { return null; }
  });
  const [status, setStatus] = useState<"pending" | "paid" | "expired" | null>(() => {
    try {
      const saved = localStorage.getItem(DEPOSIT_SESSION_KEY);
      if (!saved) return null;
      const parsed: DepositSession = JSON.parse(saved);
      if (new Date(parsed.expires_at) < new Date()) return null;
      return "pending";
    } catch { return null; }
  });
  const [timeLeft, setTimeLeft] = useState(0);
  const [ripple, setRipple] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const finalAmount = customRaw ? Number(customRaw) : selectedAmount;

  // Persist session to localStorage whenever it changes
  useEffect(() => {
    if (session) {
      localStorage.setItem(DEPOSIT_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(DEPOSIT_SESSION_KEY);
    }
  }, [session]);

  // Only stop timers when modal closes — do NOT reset session
  useEffect(() => {
    if (!open) {
      clearInterval(pollRef.current!);
      clearInterval(timerRef.current!);
    }
  }, [open]);

  // Countdown
  useEffect(() => {
    if (!session || status !== "pending") return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(diff);
      if (diff === 0) { setStatus("expired"); clearInterval(timerRef.current!); }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current!);
  }, [session, status]);

  // Poll
  useEffect(() => {
    if (!session || status !== "pending") { clearInterval(pollRef.current!); return; }
    const poll = async () => {
      const { data } = await (supabase as any).from("deposits").select("status").eq("id", session.deposit_id).single();
      if (data?.status === "paid") {
        setStatus("paid"); clearInterval(pollRef.current!);
        localStorage.removeItem(DEPOSIT_SESSION_KEY);
        await refetchProfile();
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        toast.success("🎉 Nạp tiền thành công!");
      } else if (data?.status === "expired") {
        setStatus("expired"); clearInterval(pollRef.current!);
        localStorage.removeItem(DEPOSIT_SESSION_KEY);
      }
    };
    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current!);
  }, [session, status]);

  const handleCreateDeposit = async () => {
    if (!finalAmount || finalAmount < 30000) { toast.error("Số tiền tối thiểu là 30.000đ"); return; }
    setIsCreating(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      if (!token) throw new Error("Not authenticated");
      const projectId = import.meta.env.VITE_SUPABASE_URL?.split("//")[1]?.split(".")[0];
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/create-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? "Lỗi tạo mã nạp"); }
      const data: DepositSession = await res.json();
      setSession(data);
      setStatus("pending");
    } catch (err: any) {
      toast.error(err.message ?? "Không thể tạo mã nạp tiền");
    } finally {
      setIsCreating(false);
    }
  };

  // Reset session (user explicitly requests new code)
  const handleResetSession = () => {
    clearInterval(pollRef.current!); clearInterval(timerRef.current!);
    setSession(null); setStatus(null); setTimeLeft(0);
    localStorage.removeItem(DEPOSIT_SESSION_KEY);
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã copy ${label}!`);
  };

  const triggerRipple = (key: string) => {
    setRipple(key); setTimeout(() => setRipple(null), 600);
  };

  if (!open) return null;

  const balance = (profile?.balance ?? 0) + (profile?.bonus_balance ?? 0);
  const isSuccess = status === "paid";
  const isExpired = status === "expired";
  const hasPendingSession = session && status === "pending";

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200]"
            style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.72)" }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="fixed inset-0 z-[201] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="pointer-events-auto w-full overflow-hidden flex flex-col"
              style={{
                maxWidth: "860px",
                maxHeight: "95dvh",
                background: "linear-gradient(160deg, #181818 0%, #111111 100%)",
                boxShadow: "0 0 0 1px rgba(229,9,20,0.18), 0 32px 80px rgba(0,0,0,0.75)",
                borderRadius: "24px 24px 0 0",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ──────────────────────────────────────────────── */}
              <div
                className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #E50914, #B20710)", boxShadow: "0 4px 16px rgba(229,9,20,0.4)" }}
                  >
                    <Wallet className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-black tracking-widest" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.1rem" }}>
                      NẠP TIỀN
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">SỐ DƯ:</span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(229,9,20,0.12)", color: "#ff4444", border: "1px solid rgba(229,9,20,0.25)" }}
                      >
                        {balance.toLocaleString("vi-VN")}đ
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* ── Body ────────────────────────────────────────────────── */}
              <AnimatePresence mode="wait">

                {/* ── SUCCESS ─────────────────────────────────────────── */}
                {isSuccess && session && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-6 pb-8 pt-6 text-center space-y-5"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 260, delay: 0.1 }}
                      className="flex justify-center"
                    >
                      <div
                        className="h-20 w-20 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(34,197,94,0.12)", boxShadow: "0 0 40px rgba(34,197,94,0.2)" }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-green-400" />
                      </div>
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-black text-foreground">Nạp tiền thành công!</h3>
                      <p className="text-muted-foreground text-sm mt-2">
                        Đã cộng <span className="text-green-400 font-bold">+{session.amount.toLocaleString("vi-VN")}đ</span> vào tài khoản
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={handleResetSession}>Nạp thêm</Button>
                      <Button
                        className="flex-1 font-bold"
                        onClick={onClose}
                        style={{ background: "linear-gradient(90deg,#E50914,#FF3333)", boxShadow: "0 6px 20px rgba(229,9,20,0.35)" }}
                      >
                        Về trang chủ
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ── EXPIRED ─────────────────────────────────────────── */}
                {isExpired && (
                  <motion.div
                    key="expired"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-6 pb-8 pt-6 text-center space-y-4"
                  >
                    <div
                      className="h-16 w-16 rounded-full flex items-center justify-center mx-auto"
                      style={{ background: "rgba(229,9,20,0.1)", boxShadow: "0 0 32px rgba(229,9,20,0.15)" }}
                    >
                      <Clock className="h-8 w-8" style={{ color: "#E50914" }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-foreground">Mã nạp đã hết hạn</h3>
                      <p className="text-muted-foreground text-sm mt-1">Vui lòng tạo mã mới để tiếp tục.</p>
                    </div>
                    <Button
                      onClick={handleResetSession}
                      className="w-full h-12 font-bold"
                      style={{ background: "linear-gradient(90deg,#E50914,#FF3333)", boxShadow: "0 8px 24px rgba(229,9,20,0.3)" }}
                    >
                      Tạo mã mới
                    </Button>
                  </motion.div>
                )}

                {/* ── MAIN: 2-column layout ────────────────────────────── */}
                {!isSuccess && !isExpired && (
                  <motion.div
                    key="main"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col sm:flex-row overflow-hidden flex-1"
                    style={{ minHeight: 0 }}
                  >
                    {/* ── LEFT: Amount selector ── */}
                    <div
                      className="sm:w-[340px] shrink-0 flex flex-col px-6 py-5 space-y-4 overflow-y-auto"
                      style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {/* Trust badge */}
                      <div
                        className="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "#E50914" }} />
                        <span className="text-xs text-muted-foreground">Thanh toán bảo mật · Tự xác nhận &lt;1 phút</span>
                      </div>

                      {/* Big amount display */}
                      <div
                        className="rounded-2xl px-5 py-5 text-center"
                        style={{
                          background: "linear-gradient(145deg,#1a1a1a,#141414)",
                          border: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <p className="text-[10px] text-muted-foreground tracking-widest mb-2">SỐ TIỀN NẠP</p>
                        <div className="font-black text-foreground leading-none" style={{ fontSize: "clamp(28px,7vw,36px)", fontVariantNumeric: "tabular-nums" }}>
                          <AnimatedAmount value={finalAmount} />
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground tracking-widest mt-2">VND</p>
                        <input
                          type="number"
                          value={customRaw}
                          onChange={(e) => {
                            if (hasPendingSession) return; // locked
                            const val = e.target.value.replace(/\D/g, "");
                            setCustomRaw(val);
                            if (val) setSelectedAmount(0);
                          }}
                          disabled={hasPendingSession}
                          placeholder={hasPendingSession ? "" : "Nhập số khác..."}
                          className="mt-3 w-full text-center bg-transparent border-b text-sm text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none pb-1 disabled:cursor-not-allowed disabled:opacity-0"
                          style={{ borderColor: "rgba(255,255,255,0.1)" }}
                        />
                      </div>

                      {/* Preset pills */}
                      <div>
                        <p className="text-[10px] text-muted-foreground tracking-widest mb-2">ĐỔI SỐ TIỀN</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {PRESET_AMOUNTS.map(({ label, value }) => {
                            const isActive = selectedAmount === value && !customRaw;
                            return (
                              <button
                                key={value}
                                disabled={hasPendingSession}
                                onClick={() => {
                                  if (hasPendingSession) return;
                                  setSelectedAmount(value);
                                  setCustomRaw("");
                                  triggerRipple(String(value));
                                }}
                                className="relative overflow-hidden rounded-xl py-2.5 flex flex-col items-center gap-0.5 text-xs font-bold transition-all duration-200 disabled:cursor-not-allowed"
                                style={{
                                  background: isActive ? "linear-gradient(135deg,#E50914,#C0080F)" : "rgba(255,255,255,0.05)",
                                  border: isActive ? "1px solid rgba(229,9,20,0.6)" : "1px solid rgba(255,255,255,0.08)",
                                  boxShadow: isActive ? "0 0 12px rgba(229,9,20,0.4)" : "none",
                                  color: isActive ? "#fff" : hasPendingSession ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.55)",
                                  opacity: hasPendingSession && !isActive ? 0.45 : 1,
                                }}
                              >
                                <AnimatePresence>
                                  {ripple === String(value) && (
                                    <motion.span
                                      key="rpl"
                                      initial={{ scale: 0, opacity: 0.5 }}
                                      animate={{ scale: 3.5, opacity: 0 }}
                                      exit={{ opacity: 0 }}
                                      transition={{ duration: 0.5 }}
                                      className="absolute inset-0 rounded-xl"
                                      style={{ background: "rgba(229,9,20,0.3)", transformOrigin: "center" }}
                                    />
                                  )}
                                </AnimatePresence>
                                <span>{label}</span>
                              </button>
                            );
                          })}
                        </div>
                        </div>

                      {/* Conversion info text */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Tối thiểu <span className="text-foreground font-medium">30.000đ</span> · 1 lượt xem = <span className="text-foreground font-medium">500đ</span> · Xác nhận <span className="text-foreground font-medium">&lt;1 phút</span>
                      </p>

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* CTA */}
                      {hasPendingSession ? (
                        <button
                          onClick={handleResetSession}
                          className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Tạo giao dịch mới
                        </button>
                      ) : (
                        <motion.button
                          onClick={handleCreateDeposit}
                          disabled={isCreating || !finalAmount || finalAmount < 30000}
                          whileHover={{ y: -2, boxShadow: "0 12px 40px rgba(229,9,20,0.52)" }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                          style={{
                            background: "linear-gradient(90deg,#E50914 0%,#FF3333 100%)",
                            boxShadow: "0 8px 30px rgba(229,9,20,0.38)",
                            fontSize: "0.88rem",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {isCreating ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> ĐANG TẠO MÃ...</>
                          ) : (
                            <>
                              <Zap className="h-4 w-4" />
                              TẠO MÃ NẠP {finalAmount > 0 ? `${finalAmount.toLocaleString("vi-VN")}đ` : ""}
                            </>
                          )}
                        </motion.button>
                      )}
                    </div>

                    {/* ── RIGHT: QR panel ── */}
                    <div className="flex-1 flex flex-col px-6 py-5 space-y-4 overflow-y-auto">
                      {/* Status bar */}
                      <div
                        className="flex items-center justify-between rounded-2xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        <div className="flex items-center gap-2.5">
                          {hasPendingSession ? (
                            <>
                              <div
                                className="h-2 w-2 rounded-full animate-pulse shrink-0"
                                style={{ background: "#E50914", boxShadow: "0 0 8px rgba(229,9,20,0.8)" }}
                              />
                              <span className="text-sm text-foreground font-medium">Đang chờ thanh toán</span>
                            </>
                          ) : (
                            <>
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.2)" }} />
                              <span className="text-sm text-muted-foreground">Vui lòng chọn số tiền muốn nạp</span>
                            </>
                          )}
                        </div>
                        {hasPendingSession && <RingTimer timeLeft={timeLeft} totalTime={1800} />}
                      </div>

                      {/* QR image — blurred when no session */}
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <div
                            className="bg-white rounded-2xl p-3 transition-all duration-500"
                            style={{
                              boxShadow: hasPendingSession
                                ? "0 0 0 1px rgba(229,9,20,0.2), 0 0 40px rgba(229,9,20,0.1), 0 12px 40px rgba(0,0,0,0.5)"
                                : "0 0 0 1px rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.4)",
                            }}
                          >
                            <img
                              src={session?.qr_url ?? `https://api.qrserver.com/v1/create-qr-code/?size=176x176&data=placeholder`}
                              alt="VietQR"
                              className="w-44 h-44 block object-cover transition-all duration-500"
                              style={{
                                filter: hasPendingSession ? "none" : "blur(8px)",
                                opacity: hasPendingSession ? 1 : 0.35,
                              }}
                              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                            />
                          </div>
                          {/* Overlay when no session */}
                          {!hasPendingSession && (
                            <div
                              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
                              style={{ background: "rgba(0,0,0,0.45)" }}
                            >
                              <Zap className="h-8 w-8 mb-2" style={{ color: "#E50914" }} />
                              <p className="text-xs font-bold text-white text-center px-4">Tạo mã để hiển thị QR</p>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {hasPendingSession ? "Quét bằng app ngân hàng bất kỳ" : "QR sẽ hiển thị sau khi tạo mã"}
                        </p>
                      </div>

                      {/* Transfer info table */}
                      <div
                        className="rounded-2xl overflow-hidden transition-opacity duration-300"
                        style={{
                          border: "1px solid rgba(255,255,255,0.07)",
                          opacity: hasPendingSession ? 1 : 0.4,
                        }}
                      >
                        {[
                          { label: "Ngân hàng", value: session?.bank_id ?? "—", copy: false, highlight: false },
                          { label: "Số tài khoản", value: session?.account_no ?? "—", copy: !!session, highlight: false },
                          { label: "Tên TK", value: session?.account_name ?? "—", copy: false, highlight: false },
                          { label: "Số tiền", value: session ? `${session.amount.toLocaleString("vi-VN")}đ` : "—", copy: !!session, highlight: false },
                          { label: "Nội dung CK", value: session?.deposit_code ?? "—", copy: !!session, highlight: true },
                        ].map(({ label, value, copy, highlight }, i) => (
                          <div
                            key={label}
                            className="flex justify-between items-center px-4 py-2.5"
                            style={{
                              background: highlight
                                ? "linear-gradient(90deg,rgba(229,9,20,0.1),rgba(229,9,20,0.05))"
                                : i % 2 === 0 ? "rgba(255,255,255,0.025)" : "transparent",
                              borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            }}
                          >
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <div className="flex items-center gap-2">
                              <span
                                className="font-mono font-bold text-sm"
                                style={{ color: highlight ? "#E50914" : "rgba(255,255,255,0.9)" }}
                              >
                                {value}
                              </span>
                              {copy && session && (
                                <button
                                  onClick={() => copyText(value, label)}
                                  style={{ color: "rgba(255,255,255,0.3)" }}
                                  className="hover:text-primary transition-colors"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Warning */}
                      {hasPendingSession && session && (
                        <div
                          className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                          style={{ background: "rgba(229,9,20,0.07)", border: "1px solid rgba(229,9,20,0.18)" }}
                        >
                          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "#E50914" }} />
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Nhập đúng nội dung chuyển khoản{" "}
                            <span className="font-bold" style={{ color: "#E50914" }}>{session.deposit_code}</span>{" "}
                            để hệ thống tự động cộng tiền.
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default DepositModal;
