import { memo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Crown, Puzzle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MIN_EXTENSION_VERSION, useCookieActions } from "@/hooks/useIndexData";
import type { Tables } from "@/integrations/supabase/types";
import { useAppSettings } from "@/hooks/useAppSettings";

type Profile = Tables<"profiles">;

// ─── Info Modal ───────────────────────────────────────────────────────────────
export const InfoModal = memo(({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-md bg-card border-border/40">
      <DialogHeader>
        <DialogTitle className="text-lg">Thông tin tài khoản</DialogTitle>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        {[
          { title: "Số dư:", desc: "Số tiền bạn đã nạp vào tài khoản (đơn vị: đ). Dùng để mua gói hoặc nâng cấp VIP." },
          { title: "Lượt xem:", desc: "Số lượt xem Netflix miễn phí còn lại. Người mới nhận 10 lượt, mời bạn nhận thêm 5 lượt/người." },
          { title: "Hết hạn:", desc: "Ngày hết hạn lượt xem miễn phí. Gói Free có hiệu lực 7 ngày từ lúc đăng ký." },
          { title: "Tài khoản đang dùng:", desc: "Tài khoản Netflix đang được cấp cho bạn." },
          { title: "Lượt đổi còn lại:", desc: "Số lần đổi tài khoản còn lại trong tháng." },
        ].map((item, i) => (
          <p key={i} className="text-sm">
            <strong className="text-yellow-400">{item.title}</strong>{" "}
            <span className="text-muted-foreground">{item.desc}</span>
          </p>
        ))}
        <Button onClick={onClose} className="w-full mt-2">Đã hiểu</Button>
      </div>
    </DialogContent>
  </Dialog>
));
InfoModal.displayName = "InfoModal";

// ─── Extension Modal ──────────────────────────────────────────────────────────
export const ExtensionModal = memo(({
  open, onClose, extensionVersion, extensionOutdated,
}: {
  open: boolean; onClose: () => void;
  extensionVersion: string | null; extensionOutdated: boolean;
}) => {
  const { linkExtension } = useAppSettings();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border/40">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            Cài đặt Extension
            {extensionVersion && (
              <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${extensionOutdated ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}>
                {extensionOutdated ? `v${extensionVersion} — Cần cập nhật!` : `v${extensionVersion} ✓`}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {extensionOutdated && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Phiên bản ({extensionVersion}) đã cũ. Tải Extension mới nhất (v{MIN_EXTENSION_VERSION}+).</span>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            Để sử dụng <strong className="text-foreground">XEM NETFLIX</strong>, cần cài Extension trên Chrome/Edge.
          </p>
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-primary font-bold text-xs">1</span>
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium text-sm">Tải Extension</p>
                <p className="text-muted-foreground text-xs mb-2">Tải file Extension về máy và giải nén</p>
                <a
                  href={linkExtension || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
                  style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
                >
                  <ArrowRight className="h-3 w-3" />
                  Tải Extension
                </a>
              </div>
            </div>
            {/* Steps 2–4 */}
            {[
              { step: 2, title: "Mở trang Extensions", desc: "Vào chrome://extensions và bật Developer Mode" },
              { step: 3, title: "Cài đặt", desc: 'Nhấn "Load unpacked" và chọn thư mục đã giải nén' },
              { step: 4, title: "Hoàn tất", desc: "Quay lại trang web và nhấn XEM NETFLIX" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-xs">{item.step}</span>
                </div>
                <div>
                  <p className="text-foreground font-medium text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={onClose} className="w-full">
            Đã hiểu <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
ExtensionModal.displayName = "ExtensionModal";

// ─── VIP Plans Modal ──────────────────────────────────────────────────────────
export const VipPlansModal = memo(({
  open, onClose, vipPlans, profile,
}: {
  open: boolean; onClose: () => void;
  vipPlans: { id: string; name: string; description: string | null; price: number; duration_days: number }[] | undefined;
  profile: Profile | null | undefined;
}) => {
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const formatVipDuration = (days: number): string => {
    if (days >= 3650) return "Vĩnh viễn";
    if (days >= 365 && days % 365 === 0) return `${days / 365} năm`;
    if (days >= 30 && days % 30 === 0) return `${days / 30} tháng`;
    return `${days} ngày`;
  };

  const isLifetime = (days: number) => days >= 3650;

  const handlePurchase = async (plan: { id: string; name: string; price: number; duration_days: number }) => {
    if (!profile) return;
    const effectiveBalance = (profile as any).effective_balance ?? ((profile.balance ?? 0) + (profile.bonus_balance ?? 0));
    if (effectiveBalance < plan.price) {
      toast.error(`Số dư không đủ. Cần ${plan.price.toLocaleString("vi-VN")}đ, bạn có ${effectiveBalance.toLocaleString("vi-VN")}đ.`);
      return;
    }
    setPurchasing(plan.id);
    try {
      // Use direct fetch to bypass supabase.functions.invoke wrapper (avoids gateway 401 bug with ES256)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại."); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/purchase-vip-v2`;
      console.log("[purchase-vip] calling", url);

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ vip_plan_id: plan.id }),
        });
      } catch (netErr: any) {
        console.error("[purchase-vip] network error (function not deployed yet?):", netErr.message);
        toast.error("Function chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
        return;
      }

      console.log("[purchase-vip] response status:", res.status);
      let data: any = {};
      try { data = await res.json(); } catch {}
      console.log("[purchase-vip] response data:", data);

      if (!res.ok || data?.error) {
        toast.error(data?.error || `Lỗi ${res.status}: Vui lòng thử lại.`);
        return;
      }
      const expiryText = plan.duration_days >= 3650 ? "Vĩnh viễn" : new Date(data.vip_expires_at).toLocaleDateString("vi-VN");
      toast.success(`🎉 Đã kích hoạt ${plan.name}! Hạn VIP: ${expiryText}`, { duration: 5000 });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (e: any) {
      console.error("[purchase-vip] unexpected error:", e);
      toast.error("Lỗi không xác định. Vui lòng thử lại.");
    } finally {
      setPurchasing(null);
    }
  };

  if (!open) return null;

  // Split plans: regular vs lifetime (exclude 6-month = 180 days)
  const regularPlans = (vipPlans ?? []).filter(p => !isLifetime(p.duration_days) && p.duration_days !== 180);
  const lifetimePlan = (vipPlans ?? []).find(p => isLifetime(p.duration_days));

  // Find the "most popular" plan — prefer 3-month (90 days), fallback to middle index
  const popularIndex = (() => {
    const threeMonth = regularPlans.findIndex(p => p.duration_days === 90);
    if (threeMonth !== -1) return threeMonth;
    return regularPlans.length >= 3
      ? Math.floor(regularPlans.length / 2)
      : regularPlans.length === 2 ? 1 : 0;
  })();

  // Savings calculation: compare vs first plan monthly price
  const basePricePerDay = regularPlans[0]
    ? regularPlans[0].price / regularPlans[0].duration_days
    : 0;

  const getSavings = (plan: { price: number; duration_days: number }) => {
    if (!basePricePerDay || plan.duration_days <= regularPlans[0]?.duration_days) return 0;
    const fullPrice = basePricePerDay * plan.duration_days;
    return Math.round((1 - plan.price / fullPrice) * 100);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-6 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-yellow-500/15 border border-yellow-500/40 rounded-full px-4 py-1.5 mb-4">
            <Crown className="h-4 w-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm tracking-wide">THÀNH VIÊN VIP</span>
          </div>
          <h2 className="text-3xl font-bold text-foreground">Nâng cấp tài khoản</h2>
          <p className="text-muted-foreground text-sm mt-2">Trải nghiệm VIP độc quyền · Hỗ trợ ưu tiên</p>
        </div>

        {(!vipPlans || vipPlans.length === 0) ? (
          <div className="bg-card border border-border/40 rounded-2xl p-8 text-center">
            <Crown className="h-10 w-10 text-yellow-400/40 mx-auto mb-3" />
            <p className="text-foreground font-semibold">Chưa có gói VIP nào</p>
            <p className="text-muted-foreground text-sm mt-1">Admin chưa thêm gói VIP. Vui lòng liên hệ hỗ trợ.</p>
          </div>
        ) : (
          <>
            {/* Regular plans grid */}
            <div className={`grid gap-4 ${regularPlans.length === 1 ? "grid-cols-1 max-w-xs mx-auto" : regularPlans.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {regularPlans.map((plan, i) => {
                const isPopular = i === popularIndex && regularPlans.length > 1;
                const savings = getSavings(plan);
                const monthlyPrice = plan.price / (plan.duration_days / 30);

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`relative flex flex-col rounded-2xl border transition-all duration-200 ${
                      isPopular
                        ? "border-yellow-400/70 scale-[1.06] shadow-[0_0_40px_rgba(234,179,8,0.2)] z-10"
                        : "border-yellow-500/20 hover:border-yellow-500/40"
                    }`}
                    style={{
                      background: isPopular
                        ? "linear-gradient(145deg, rgba(234,179,8,0.12), rgba(15,15,15,0.95))"
                        : "linear-gradient(145deg, rgba(234,179,8,0.05), rgba(15,15,15,0.9))",
                    }}
                  >
                    {/* Popular badge */}
                    {isPopular && (
                      <div className="absolute -top-3.5 left-0 right-0 flex justify-center">
                        <span className="bg-yellow-400 text-black text-[11px] font-extrabold px-4 py-1 rounded-full tracking-wider shadow-lg">
                          ⭐ PHỔ BIẾN NHẤT
                        </span>
                      </div>
                    )}

                    <div className={`p-5 flex flex-col flex-1 ${isPopular ? "pt-7" : ""}`}>
                      {/* Savings badge */}
                      {savings > 0 && (
                        <div className="self-start mb-2">
                          <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-green-500/30">
                            Tiết kiệm {savings}%
                          </span>
                        </div>
                      )}

                      <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mb-1">
                        {formatVipDuration(plan.duration_days)}
                      </p>
                      <h3 className="text-foreground font-bold text-base mb-3">{plan.name}</h3>

                      {/* Price */}
                      <div className="mb-1">
                        <span className="text-yellow-400 font-extrabold text-3xl leading-none">
                          {plan.price.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      {plan.duration_days > 30 && (
                        <p className="text-muted-foreground text-xs mb-4">
                          ~{Math.round(monthlyPrice).toLocaleString("vi-VN")}đ/tháng
                        </p>
                      )}

                      <div className="space-y-1.5 mb-5 flex-1">
                        {(() => {
                          const viewsLabel = plan.duration_days === 30 ? "60 lượt xem VIP/tháng" : plan.duration_days === 90 ? "222 lượt xem VIP/3 tháng" : plan.duration_days === 365 ? "500 lượt xem VIP/năm" : "Lượt xem VIP không giới hạn";
                          return ["Badge VIP độc quyền", "Ưu tiên hỗ trợ 24/7", "Nhiều tài khoản hơn", viewsLabel, "Trải nghiệm không quảng cáo"].map((f) => (
                            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                              {f}
                            </div>
                          ));
                        })()}
                      </div>

                      <button
                        onClick={() => handlePurchase(plan)}
                        disabled={purchasing === plan.id}
                        className={`w-full mt-auto rounded-xl py-3 font-bold text-sm transition-all duration-200 disabled:opacity-50 ${
                          isPopular
                            ? "bg-yellow-400 text-black hover:bg-yellow-300 shadow-[0_4px_20px_rgba(234,179,8,0.4)] hover:shadow-[0_4px_28px_rgba(234,179,8,0.6)] active:scale-[0.97]"
                            : "border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/15 hover:border-yellow-400/60 active:scale-[0.97]"
                        }`}
                      >
                        {purchasing === plan.id ? "Đang xử lý..." : isPopular ? "🚀 Mua ngay" : "Mua ngay"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Lifetime plan — special offer row */}
            {lifetimePlan && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: regularPlans.length * 0.08 + 0.1 }}
                className="mt-4 relative rounded-2xl border border-yellow-500/40 overflow-hidden"
                style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.08), rgba(120,53,15,0.15), rgba(15,15,15,0.95))" }}
              >
                {/* Subtle shine line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent" />
                <div className="p-4 flex items-center gap-4">
                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-yellow-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-foreground font-bold text-sm">{lifetimePlan.name}</p>
                      <span className="bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ✦ SPECIAL OFFER
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs">Trả một lần · Dùng mãi mãi · Không lo hết hạn</p>
                  </div>
                  <div className="shrink-0 text-right mr-2">
                    <p className="text-yellow-400 font-extrabold text-xl leading-none">
                      {lifetimePlan.price.toLocaleString("vi-VN")}đ
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">một lần duy nhất</p>
                  </div>
                  <button
                    onClick={() => handlePurchase(lifetimePlan)}
                    disabled={purchasing === lifetimePlan.id}
                    className="shrink-0 rounded-xl px-4 py-2.5 font-bold text-sm bg-yellow-400 text-black hover:bg-yellow-300 shadow-[0_2px_16px_rgba(234,179,8,0.3)] transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    {purchasing === lifetimePlan.id ? "Đang xử lý..." : "Mua"}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}

        <div className="text-center mt-6">
          <button onClick={onClose} className="text-muted-foreground text-sm font-medium hover:text-foreground transition-colors px-4 py-2">
            Đóng
          </button>
        </div>
      </motion.div>
    </div>
  );
});
VipPlansModal.displayName = "VipPlansModal";

// ─── TV Confirm Modal ─────────────────────────────────────────────────────────
export const TvConfirmModal = memo(({
  open, onClose, onConfirm, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; loading: boolean;
}) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-sm rounded-2xl border border-border/40 bg-card shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">📺</span>
          <h3 className="text-lg font-bold text-foreground">Xác nhận kích hoạt Netflix TV</h3>
        </div>
        <div className="rounded-xl border border-border/30 bg-secondary/40 p-4 mb-6 space-y-2">
          <p className="text-sm text-muted-foreground">
          Kích hoạt Netflix trên TV sẽ trừ <strong className="text-foreground">5 lượt xem</strong> hoặc <strong className="text-foreground">2.500đ</strong> từ tài khoản của bạn.
          </p>
          <p className="text-sm text-muted-foreground">Bạn có muốn tiếp tục?</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border/40 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors">
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Đang kích hoạt..." : "Kích hoạt (-5 lượt / 2.500đ)"}
          </button>
        </div>
      </motion.div>
    </div>
  );
});
TvConfirmModal.displayName = "TvConfirmModal";


// ─── Report Cookie Dialog ─────────────────────────────────────────────────────
export const ReportCookieDialog = memo(({
  open, onClose, user, extensionVersion, setExtensionVersion, switchesLeft, maxSwitches,
}: {
  open: boolean; onClose: () => void;
  user: { id: string } | null | undefined;
  extensionVersion: string | null; setExtensionVersion: (v: string) => void;
  switchesLeft: number; maxSwitches: number;
}) => {
  const [reportReason, setReportReason] = useState("Tài khoản bị khóa");
  const [reportDetails, setReportDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const queryClient = useQueryClient();

  const handleClose = (val: boolean) => {
    if (!val) { onClose(); setReportSuccess(false); setReportDetails(""); }
  };

  const handleReport = async () => {
    if (switchesLeft <= 0) { toast.error("Bạn đã hết lượt đổi tháng này!"); return; }
    setReportLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-cookie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) { toast.error(data?.error || "Lỗi đổi cookie"); return; }
      setReportSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["cookie-assignments", user?.id] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-card border-border/40">
        {reportSuccess ? (
          <div className="py-4 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Báo cáo đã được ghi nhận!</h3>
              <p className="text-sm text-muted-foreground">Hệ thống đã tự động cấp tài khoản mới. Admin sẽ kiểm tra sớm.</p>
            </div>
            <p className="text-xs text-muted-foreground">Còn lại <span className="text-primary font-bold">{switchesLeft}/{maxSwitches === Infinity ? "∞" : maxSwitches}</span> lượt đổi tháng này</p>
            <Button className="w-full" onClick={() => { onClose(); setReportSuccess(false); }}>Đóng</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <RefreshCw className="h-5 w-5 text-yellow-500" /> Báo hỏng tài khoản
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-1">
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-yellow-400">Thông tin quan trọng:</p>
                <p className="text-muted-foreground">• Hệ thống sẽ <span className="text-foreground font-medium">tự động cấp tài khoản mới</span> ngay sau khi xác nhận.</p>
                <p className="text-muted-foreground">• Lượt đổi còn lại: <span className="text-yellow-400 font-bold">{switchesLeft}/{maxSwitches === Infinity ? "∞" : maxSwitches}</span></p>
              </div>
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium leading-relaxed">
                  ⚠️ Nếu admin kiểm tra và phát hiện tài khoản vẫn hoạt động bình thường, tài khoản của bạn sẽ bị <span className="font-bold underline">khóa vĩnh viễn</span>.
                </p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Lý do:</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-secondary border border-border/40 rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
                >
                  <option>Tài khoản bị khóa</option>
                  <option>Sai mật khẩu</option>
                  <option>Tài khoản đã bị thay đổi</option>
                  <option>Không vào được</option>
                  <option>Lý do khác</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Mô tả thêm (tuỳ chọn):</label>
                <Textarea
                  placeholder="Mô tả chi tiết..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="bg-secondary border-border/40 text-foreground placeholder:text-muted-foreground resize-none"
                  rows={2}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={reportLoading}>Hủy</Button>
                <Button
                  className="flex-1 font-bold gap-2"
                  onClick={handleReport}
                  disabled={reportLoading || switchesLeft <= 0}
                  style={{ background: switchesLeft <= 0 ? undefined : "linear-gradient(135deg, #E50914, #B20710)" }}
                >
                  <RefreshCw className={`h-4 w-4 ${reportLoading ? "animate-spin" : ""}`} />
                  {reportLoading ? "Đang xử lý..." : switchesLeft <= 0 ? "Hết lượt" : "Xác nhận đổi"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
});
ReportCookieDialog.displayName = "ReportCookieDialog";
