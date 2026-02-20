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

  const handlePurchase = async (plan: { id: string; name: string; price: number; duration_days: number }) => {
    if (!profile) return;
    const effectiveBalance = (profile.balance ?? 0) + (profile.bonus_balance ?? 0);
    if (effectiveBalance < plan.price) {
      toast.error(`Số dư không đủ. Cần ${plan.price.toLocaleString("vi-VN")}đ, bạn có ${effectiveBalance.toLocaleString("vi-VN")}đ.`);
      return;
    }
    setPurchasing(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-vip", {
        body: { vip_plan_id: plan.id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      toast.success(`🎉 Đã kích hoạt ${plan.name}! Hạn VIP: ${new Date(data.vip_expires_at).toLocaleDateString("vi-VN")}`, { duration: 5000 });
      onClose();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Lỗi khi mua gói VIP. Vui lòng thử lại.");
    } finally {
      setPurchasing(null);
    }
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-xl"
      >
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/30 rounded-full px-4 py-1.5 mb-3">
            <Crown className="h-4 w-4 text-yellow-400" />
            <span className="text-yellow-400 font-bold text-sm">Thành viên VIP</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Nâng cấp tài khoản</h2>
          <p className="text-muted-foreground text-sm mt-1">Hiển thị badge VIP cùng tên bạn trên hệ thống</p>
        </div>

        {(!vipPlans || vipPlans.length === 0) ? (
          <div className="bg-card border border-border/40 rounded-2xl p-8 text-center">
            <Crown className="h-10 w-10 text-yellow-400/40 mx-auto mb-3" />
            <p className="text-foreground font-semibold">Chưa có gói VIP nào</p>
            <p className="text-muted-foreground text-sm mt-1">Admin chưa thêm gói VIP. Vui lòng liên hệ hỗ trợ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {vipPlans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-card/80 to-card/60 p-4 flex flex-col"
              >
                <h3 className="text-foreground font-bold text-sm">{plan.name}</h3>
                {plan.description && <p className="text-muted-foreground text-[11px] mt-1 leading-snug">{plan.description}</p>}
                <div className="mt-3 mb-4">
                  <span className="text-yellow-400 font-extrabold text-2xl">{plan.price.toLocaleString("vi-VN")}đ</span>
                  <span className="text-muted-foreground text-xs ml-1">/{plan.duration_days} ngày</span>
                </div>
                <button
                  onClick={() => handlePurchase(plan)}
                  disabled={purchasing === plan.id}
                  className="w-full mt-auto rounded-lg py-2.5 font-bold text-sm border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                >
                  {purchasing === plan.id ? "Đang xử lý..." : "Mua ngay"}
                </button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="text-center mt-5">
          <button onClick={onClose} className="bg-secondary/80 text-foreground text-sm font-medium px-6 py-2 rounded-lg hover:bg-secondary transition-colors">
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
          Kích hoạt Netflix trên TV sẽ trừ <strong className="text-foreground">500đ</strong> từ tài khoản của bạn.
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
            {loading ? "Đang kích hoạt..." : "Kích hoạt (-500đ)"}
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
  const [reportAllLive, setReportAllLive] = useState(false);
  const queryClient = useQueryClient();
  const { checkCookiesBatch } = useCookieActions(user, extensionVersion, setExtensionVersion);

  const handleClose = (val: boolean) => {
    if (!val) { onClose(); setReportSuccess(false); setReportAllLive(false); setReportDetails(""); }
  };

  const handleReport = async () => {
    if (switchesLeft <= 0) { toast.error("Bạn đã hết lượt đổi tháng này!"); return; }
    setReportLoading(true);
    try {
      const { data: assignments } = await supabase
        .from("user_cookie_assignment")
        .select("cookie_id, slot, cookie_stock!inner(cookie_data, is_active)")
        .eq("user_id", user!.id)
        .order("slot", { ascending: true });

      const activeCookies: { cookie_id: string; cookie_data: string }[] = (assignments ?? [])
        .filter((a: { cookie_stock: { is_active: boolean; cookie_data: string } | null }) => a.cookie_stock?.is_active)
        .map((a: { cookie_id: string; cookie_stock: { cookie_data: string } | null }) => ({
          cookie_id: a.cookie_id,
          cookie_data: a.cookie_stock!.cookie_data,
        }));

      if (activeCookies.length === 0) { toast.error("Bạn chưa được cấp tài khoản nào."); return; }

      let deadCookieIds: string[];
      if (extensionVersion) {
        toast.info("Đang kiểm tra tài khoản...", { duration: 3000 });
        const liveMap = await checkCookiesBatch(activeCookies);
        deadCookieIds = activeCookies.filter((c) => !liveMap[c.cookie_id]).map((c) => c.cookie_id);
        if (deadCookieIds.length === 0) { setReportAllLive(true); return; }
      } else {
        deadCookieIds = activeCookies.map((c) => c.cookie_id);
      }

      const { data, error } = await supabase.functions.invoke("report-cookie", {
        body: { reason: reportReason, details: reportDetails, dead_cookie_ids: deadCookieIds },
      });
      if (error || data?.error) { toast.error(data?.error || error?.message || "Lỗi đổi cookie"); return; }
      setReportSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["cookie-assignments", user?.id] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setReportLoading(false);
    }
  };

  const handleForceSwap = async () => {
    setReportAllLive(false);
    setReportLoading(true);
    try {
      const { data: assigns } = await supabase
        .from("user_cookie_assignment")
        .select("cookie_id")
        .eq("user_id", user!.id);
      const allIds = (assigns ?? []).map((a: { cookie_id: string }) => a.cookie_id);
      const { data, error } = await supabase.functions.invoke("report-cookie", {
        body: { reason: reportReason, details: reportDetails, dead_cookie_ids: allIds },
      });
      if (error || data?.error) { toast.error(data?.error || error?.message || "Lỗi"); return; }
      setReportSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["cookie-assignments", user?.id] });
    } finally { setReportLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm bg-card border-border/40">
        {reportAllLive ? (
          <div className="py-4 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto text-3xl">😏</div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-2">Ủa... tài khoản vẫn ổn mà?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Anh nhắc em, anh vừa check vẫn vào được Netflix nếu em vẫn không xem được thì bấm vào đây để cãi{" "}
                <span className="text-yellow-400 font-bold">=)))</span>
              </p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              ⚠️ Nhớ nhé: Báo sai là ban vĩnh viễn đó nha!
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { onClose(); setReportAllLive(false); }}>Thôi được rồi</Button>
              <Button className="flex-1 font-bold" variant="destructive" onClick={handleForceSwap} disabled={reportLoading}>
                {reportLoading ? "Đang xử lý..." : "Cãi — đổi luôn đi!"}
              </Button>
            </div>
          </div>
        ) : reportSuccess ? (
          <div className="py-4 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Báo cáo đã được ghi nhận!</h3>
              <p className="text-sm text-muted-foreground">Hệ thống đã tự động cấp tài khoản mới. Admin sẽ kiểm tra sớm.</p>
            </div>
            <p className="text-xs text-muted-foreground">Còn lại <span className="text-primary font-bold">{Math.max(0, switchesLeft - 1)}/{maxSwitches}</span> lượt đổi tháng này</p>
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
                <p className="text-muted-foreground">• Lượt đổi còn lại: <span className="text-yellow-400 font-bold">{switchesLeft}/{maxSwitches}</span></p>
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
