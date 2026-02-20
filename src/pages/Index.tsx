import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIndexData, useCookieActions, MIN_EXTENSION_VERSION, compareVersions } from "@/hooks/useIndexData";
import BanOverlay from "./index/BanOverlay";
import PageHeader from "./index/PageHeader";
import WatchSection from "./index/WatchSection";
import SidePanel from "./index/SidePanel";
import PlanSelector from "./index/PlanSelector";
import GuestView from "./index/GuestView";
import {
  InfoModal, ExtensionModal, VipPlansModal,
  TvConfirmModal, ReportCookieDialog,
} from "./index/IndexModals";
import { DepositModal } from "./index/DepositModal";

const Index = () => {
  const {
    user, signOut, profile, isLoading, isAdmin,
    extensionVersion, setExtensionVersion, extensionOutdated,
    activeBan, activeCookieCount,
    isVip, vipExpiresAt, maxSwitches, switchesLeft,
    vipPlans,
  } = useIndexData();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal state
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [showVipPlans, setShowVipPlans] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);

  // TV state
  const [tvCode, setTvCode] = useState("");
  const [tvLoading, setTvLoading] = useState(false);
  const [showTvConfirm, setShowTvConfirm] = useState(false);

  // Watch loading (used in WatchModal inline)
  const [watchLoading, setWatchLoading] = useState(false);

  const { trySendCookie, checkExtensionAlive } = useCookieActions(user, extensionVersion, setExtensionVersion);

  const handleWatch = async () => {
    if (!user) { navigate("/auth"); return; }
    const effectiveBalance = (profile?.balance ?? 0) + (profile?.bonus_balance ?? 0);
    if (!profile || effectiveBalance < 500) return;
    if (extensionOutdated) {
      toast.error(`Extension phiên bản ${extensionVersion} đã cũ. Vui lòng cập nhật lên v${MIN_EXTENSION_VERSION}+`);
      setShowExtensionModal(true);
      return;
    }
    setWatchLoading(true);
    try {
      const detectedVersion = await checkExtensionAlive();
      if (!detectedVersion) {
        setShowExtensionModal(true);
        toast.error("Extension chưa được cài đặt hoặc không phản hồi. Không trừ tiền.");
        return;
      }
      if (compareVersions(detectedVersion, MIN_EXTENSION_VERSION) < 0) {
        toast.error(`Extension phiên bản ${detectedVersion} đã cũ. Vui lòng cập nhật lên v${MIN_EXTENSION_VERSION}+`);
        setShowExtensionModal(true);
        return;
      }

      const { data: assignments } = await supabase
        .from("user_cookie_assignment")
        .select("cookie_id, slot, cookie_stock!inner(cookie_data, is_active)")
        .eq("user_id", user.id)
        .order("slot", { ascending: true });

      const activeCookies = (assignments ?? [])
        .filter((a: { cookie_stock: { is_active: boolean; cookie_data: string } | null }) => a.cookie_stock?.is_active)
        .map((a: { cookie_stock: { cookie_data: string } | null }) => ({ cookie_data: a.cookie_stock!.cookie_data }));

      if (activeCookies.length === 0) {
        toast.error("Hiện tại không có cookie khả dụng được gán cho bạn. Vui lòng liên hệ hỗ trợ.");
        return;
      }

      let extensionResponded = false;
      for (const cookie of activeCookies) {
        extensionResponded = await trySendCookie(cookie.cookie_data);
        if (extensionResponded) break;
      }

      if (!extensionResponded) {
        setShowExtensionModal(true);
        toast.error("Extension chưa được cài đặt hoặc không phản hồi. Không trừ tiền.");
        return;
      }

      const { data: deductData, error: deductError } = await supabase.functions.invoke("deduct-balance", {
        body: { amount: 500, memo: "Xem phim Netflix" },
      });
      if (deductError || deductData?.error) {
        toast.error(deductData?.error || "Lỗi khi trừ tiền. Vui lòng thử lại.");
        return;
      }
      toast.success("✅ Netflix đã được mở! Trừ 500đ. Chúc bạn xem phim vui vẻ!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } finally {
      setWatchLoading(false);
    }
  };

  const handleActivateTv = async () => {
    if (!user) { navigate("/auth"); return; }
    if (tvCode.length !== 8) { toast.error("Vui lòng nhập đủ 8 số từ TV"); return; }
    if (!extensionVersion) { toast.error("Cần cài Extension để dùng tính năng này"); return; }
    if (!profile || (profile.balance + (profile.bonus_balance ?? 0)) < 500) { toast.error("Số dư không đủ (500đ)"); return; }
    setTvLoading(true);
    try {
      const { data: assignments } = await supabase
        .from("user_cookie_assignment")
        .select("cookie_id, slot, cookie_stock!inner(cookie_data, is_active)")
        .eq("user_id", user!.id)
        .order("slot", { ascending: true });

      const activeCookies = (assignments ?? [])
        .filter((a: { cookie_stock: { is_active: boolean; cookie_data: string } | null }) => a.cookie_stock?.is_active)
        .map((a: { cookie_stock: { cookie_data: string } | null }) => a.cookie_stock!.cookie_data);

      window.postMessage({ type: "ACTIVATE_TV", code: tvCode, cookies: activeCookies }, "*");

      const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const timeout = setTimeout(() => resolve({ success: false, error: "Timeout — Extension không phản hồi" }), 60000);
        const handler = (event: MessageEvent) => {
          if (!event.data) return;
          if (event.data.type === "TV_ACTIVATE_SUCCESS") {
            clearTimeout(timeout); window.removeEventListener("message", handler); resolve({ success: true });
          }
          if (event.data.type === "TV_ACTIVATE_ERROR") {
            clearTimeout(timeout); window.removeEventListener("message", handler);
            resolve({ success: false, error: event.data.error });
          }
        };
        window.addEventListener("message", handler);
      });

      if (result.success) {
        const { data: deductData, error: deductError } = await supabase.functions.invoke("deduct-balance", {
          body: { amount: 500, memo: "📺 Kích hoạt Netflix TV" },
        });
        if (deductError || deductData?.error) {
          toast.error(deductData?.error || "Kích hoạt thành công nhưng lỗi khi trừ tiền.");
        } else {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          toast.success("🎉 Kích hoạt TV thành công! Trừ 500đ.");
        }
        setTvCode("");
      } else {
        toast.error(result.error || "Kích hoạt thất bại");
      }
    } catch {
      toast.error("Lỗi không xác định");
    } finally {
      setTvLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl">Đang tải...</div>
      </div>
    );
  }


  return (
    <>
      {activeBan && <BanOverlay ban={activeBan} onSignOut={signOut} />}

      <div className="min-h-screen bg-background relative">
        {/* Background gradient */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-background" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>

        <PageHeader
          profile={profile}
          userEmail={user?.email}
          isAdmin={isAdmin}
          isVip={isVip}
          extensionVersion={extensionVersion}
          extensionOutdated={extensionOutdated}
          onShowExtension={() => setShowExtensionModal(true)}
          onSignOut={signOut}
          onShowDeposit={() => setShowDeposit(true)}
        />

        {/* Hero */}
        <section className="text-center py-8 md:py-12 px-4 relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl md:text-4xl font-bold text-foreground"
          >
            Xin chào, {profile?.display_name || "bạn"} 👋
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-muted-foreground mt-2 text-sm"
          >
            Sẵn sàng xem phim chưa?
          </motion.p>
        </section>

        {/* Main content */}
        <main className="max-w-5xl mx-auto px-4 md:px-6 pb-16 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <WatchSection
                user={user}
                profile={profile}
                isVip={isVip}
                maxSwitches={maxSwitches}
                switchesLeft={switchesLeft}
                extensionVersion={extensionVersion}
                setExtensionVersion={setExtensionVersion}
                extensionOutdated={extensionOutdated}
                onShowExtensionModal={() => setShowExtensionModal(true)}
                onShowWatchModal={() => setShowWatchModal(true)}
                onShowReportDialog={() => setShowReportDialog(true)}
                tvCode={tvCode}
                setTvCode={setTvCode}
                onShowTvConfirm={() => setShowTvConfirm(true)}
              />
            </div>
            <div className="lg:col-span-2">
              <SidePanel
                profile={profile}
                isVip={isVip}
                vipExpiresAt={vipExpiresAt}
                maxSwitches={maxSwitches}
                switchesLeft={switchesLeft}
                activeCookieCount={activeCookieCount}
                freeViews={Math.floor((profile?.bonus_balance ?? 0) / 500)}
                onShowInfo={() => setShowInfoModal(true)}
                onShowVipPlans={() => setShowVipPlans(true)}
                onShowReportDialog={() => setShowReportDialog(true)}
                onShowDeposit={() => setShowDeposit(true)}
                isGuest={!user}
                extensionVersion={extensionVersion}
                onShowExtensionModal={() => setShowExtensionModal(true)}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Deposit Modal */}
      <DepositModal open={showDeposit} onClose={() => setShowDeposit(false)} />

      {/* Modals */}
      <InfoModal open={showInfoModal} onClose={() => setShowInfoModal(false)} />

      <ExtensionModal
        open={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        extensionVersion={extensionVersion}
        extensionOutdated={extensionOutdated}
      />

      <VipPlansModal
        open={showVipPlans}
        onClose={() => setShowVipPlans(false)}
        vipPlans={vipPlans}
        profile={profile}
      />

      <TvConfirmModal
        open={showTvConfirm}
        onClose={() => setShowTvConfirm(false)}
        onConfirm={() => { setShowTvConfirm(false); handleActivateTv(); }}
        loading={tvLoading}
      />

      <ReportCookieDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        user={user}
        extensionVersion={extensionVersion}
        setExtensionVersion={setExtensionVersion}
        switchesLeft={switchesLeft}
        maxSwitches={maxSwitches}
      />

      {/* Watch modal — kept here to avoid navigate prop drilling */}
      {showWatchModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowWatchModal(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl"
          >
            <h2 className="text-center text-2xl font-bold text-foreground mb-6">Chọn gói xem phim</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FREE */}
              <div className="relative rounded-2xl border border-border/40 bg-card/90 p-6 flex flex-col">
                <div className="absolute -top-3 left-5">
                  <span className="bg-secondary text-muted-foreground text-xs font-semibold px-3 py-1 rounded-full border border-border/40">
                    {isVip ? "Gói thường" : "Gói hiện tại"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2">Free</h3>
                <p className="text-muted-foreground text-xs mb-4">Xem quảng cáo ngắn trước mỗi phiên</p>
                <div className="mb-1">
                  <span className="text-3xl font-extrabold text-green-400">500đ</span>
                  <span className="text-muted-foreground text-sm">/lượt xem</span>
                </div>
                <div className="mb-6 mt-4 space-y-3 flex-1">
                  {[
                    "Hệ thống tự động cấp riêng cho bạn 2 hồ sơ đăng nhập Netflix cố định ngay khi tạo tài khoản.",
                    "Chỉ tốn 500đ cho mỗi lần kích hoạt Extension để xem phim.",
                    "1 lượt đổi tài khoản mỗi tháng.",
                    "Xem kèm quảng cáo: Cần xem một đoạn quảng cáo ngắn để hỗ trợ duy trì máy chủ trước mỗi phiên.",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setShowWatchModal(false); handleWatch(); }}
                  disabled={watchLoading || ((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500}
                  className="w-full rounded-xl py-3 font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
                >
                  {((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500 ? "Số dư không đủ (500đ)" : "Bắt đầu xem — 500đ"}
                </button>
                {((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500 && (
                  <button onClick={() => { setShowWatchModal(false); setShowDeposit(true); }} className="mt-2 w-full text-xs text-primary hover:underline">
                    Nạp thêm
                  </button>
                )}
              </div>

              {/* VIP */}
              <div className="relative rounded-2xl border-2 border-yellow-500/60 bg-gradient-to-br from-yellow-500/10 via-card/90 to-card/80 p-6 flex flex-col">
                <div className="absolute -top-3 left-5">
                  <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Crown className="h-3 w-3" /> HOT
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2 flex items-center gap-2">
                  VIP <Crown className="h-5 w-5 text-yellow-400" />
                </h3>
                <p className="text-yellow-400/80 text-xs mb-4">Không quảng cáo, ưu tiên hỗ trợ</p>
                {isVip ? (
                  <>
                    <div className="mb-1">
                      <span className="text-3xl font-extrabold text-yellow-400">500đ</span>
                      <span className="text-muted-foreground text-sm">/lượt xem</span>
                    </div>
                    <div className="text-xs text-yellow-400/70 mb-4">Ưu đãi VIP đang hoạt động!</div>
                  </>
                ) : (
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-yellow-400">{(vipPlans?.[0]?.price ?? 50000).toLocaleString("vi-VN")}đ</span>
                    <span className="text-muted-foreground text-sm">/{vipPlans?.[0] ? Math.round(vipPlans[0].duration_days / 30) + " tháng" : "tháng"}</span>
                  </div>
                )}
                <div className="mb-6 space-y-3 flex-1">
                  {[
                    "Sở hữu danh sách riêng lên tới 5 tài khoản Premium chất lượng cao nhất.",
                    "Ưu tiên đường truyền: Tốc độ cực nhanh, không phải chờ đợi dù trong giờ cao điểm.",
                    "Hỗ trợ 2 lượt đổi tài khoản mỗi tháng.",
                    "Trải nghiệm không gián đoạn: Hoàn toàn sạch bóng quảng cáo.",
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                {isVip ? (
                  <button
                    onClick={() => { setShowWatchModal(false); handleWatch(); }}
                    disabled={watchLoading || ((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500}
                    className="w-full rounded-xl py-3 font-bold text-sm text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 bg-yellow-400 hover:bg-yellow-300"
                  >
                    {((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500 ? "Số dư không đủ (500đ)" : "Xem ngay — VIP 👑"}
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowWatchModal(false); setShowVipPlans(true); }}
                    className="w-full rounded-xl py-3 font-bold text-sm text-black bg-yellow-400 hover:bg-yellow-300 transition-all active:scale-[0.97]"
                  >
                    <Crown className="h-4 w-4 inline mr-1.5" />
                    Nâng cấp VIP ngay
                  </button>
                )}
              </div>
            </div>
            <div className="text-center mt-5">
              <button onClick={() => setShowWatchModal(false)} className="bg-secondary/80 text-foreground text-sm font-medium px-8 py-2.5 rounded-xl hover:bg-secondary transition-colors">
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Index;
