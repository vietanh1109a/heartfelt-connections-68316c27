import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Crown, Menu, ChevronDown, Globe } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/language";
import Products from "./Products";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIndexData, useCookieActions, MIN_EXTENSION_VERSION, compareVersions } from "@/hooks/useIndexData";
import BanOverlay from "./index/BanOverlay";
import AppSidebar from "./index/AppSidebar";
import WatchSection from "./index/WatchSection";
import SidePanel from "./index/SidePanel";
import PlanSelector from "./index/PlanSelector";
import GuestView from "./index/GuestView";
import {
  InfoModal, ExtensionModal, VipPlansModal,
  TvConfirmModal, ReportCookieDialog,
} from "./index/IndexModals";
import { DepositModal } from "./index/DepositModal";

/* Premium glass pill control group */
function TopBar({ sidebarCollapsed, onToggleSidebar, isVip, profile, userEmail }: {
  sidebarCollapsed: boolean; onToggleSidebar: () => void;
  isVip: boolean; profile: any; userEmail?: string;
}) {
  const { lang, setLang, t } = useLanguage();

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-border/30">
      <button onClick={onToggleSidebar} className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3">
        {isVip && (
          <span className="text-xs font-bold text-yellow-500 flex items-center gap-1 bg-yellow-500/10 px-2.5 py-1 rounded-full border border-yellow-500/20">
            <Crown className="h-3 w-3" /> VIP
          </span>
        )}

        {/* Premium language pill dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-9 flex items-center gap-2 px-3.5 rounded-full font-medium text-sm transition-all duration-200 border border-border/[0.1] bg-secondary/40 hover:bg-secondary/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{lang === "vi" ? "VI" : "EN"}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-card border-border/40">
            <DropdownMenuItem onClick={() => setLang("vi")} className="cursor-pointer gap-2.5">
              <span className="text-base">🇻🇳</span>
              <span className="flex-1">Tiếng Việt</span>
              {lang === "vi" && <span className="text-primary text-xs">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("en")} className="cursor-pointer gap-2.5">
              <span className="text-base">🇬🇧</span>
              <span className="flex-1">English</span>
              {lang === "en" && <span className="text-primary text-xs">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-foreground">{profile?.display_name || "User"}</p>
          <p className="text-[10px] text-muted-foreground">
            {t("Số dư", "Balance")}: {((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)).toLocaleString("vi-VN")}đ
          </p>
        </div>
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">
            {(profile?.display_name || userEmail || "U").charAt(0).toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}

const Index = () => {
  const {
    user, signOut, profile, isLoading, isAdmin,
    extensionVersion, setExtensionVersion, extensionOutdated,
    activeBan, activeCookieCount,
    isVip, vipExpiresAt, maxSwitches, switchesLeft,
    vipPlans,
  } = useIndexData();
  const { t } = useLanguage();

  const { data: isCTV } = useQuery({
    queryKey: ["is-ctv", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("ctv_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal state
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [showVipPlans, setShowVipPlans] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 768);

  // TV state
  const [tvCode, setTvCode] = useState("");
  const [tvLoading, setTvLoading] = useState(false);
  const [showTvConfirm, setShowTvConfirm] = useState(false);

  // Watch loading — delegated to WatchSection via ref
  const watchSectionRef = useRef<{ handleWatch: () => Promise<void> } | null>(null);
  const [activeTab, setActiveTab] = useState<"netflix" | "products" | "game_keys">("netflix");

  const { trySendCookie, checkExtensionAlive } = useCookieActions(user, extensionVersion, setExtensionVersion);

  const handleActivateTv = async () => {
    if (!user) { navigate("/auth"); return; }
    if (tvCode.length !== 8) { toast.error("Vui lòng nhập đủ 8 số từ TV"); return; }
    if (!extensionVersion) { toast.error("Cần cài Extension để dùng tính năng này"); return; }

    const freeViews = (profile as any)?.free_views_left ?? 0;
    const vipViews = (profile as any)?.vip_views_left ?? 0;
    const hasEnoughViews = freeViews >= 5 || vipViews >= 5;
    const effectiveBalance = (profile as any)?.effective_balance ?? ((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0));

    if (!hasEnoughViews && effectiveBalance < 2500) {
      toast.error("Không đủ lượt xem (cần 5 lượt) hoặc số dư (cần 2.500đ) để kích hoạt TV.");
      return;
    }
    setTvLoading(true);
    try {
      // Fetch cookies via edge function
      const { data: tvAssign, error: tvAssignError } = await supabase.functions.invoke("assign-cookie", {
        body: {},
      });
      if (tvAssignError || tvAssign?.error) {
        toast.error(tvAssign?.error || "Không thể lấy tài khoản.");
        return;
      }
      const activeCookies = (tvAssign.assignments || [])
        .filter((a: any) => a.is_active && a.cookie_data)
        .map((a: any) => a.cookie_data);

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
        // Deduct: 5 views first (vip → free), then 2500đ
        if (hasEnoughViews) {
          const useVip = vipViews >= 5;
          const updateField = useVip ? "vip_views_left" : "free_views_left";
          const currentVal = useVip ? vipViews : freeViews;
          const { error: viewErr } = await supabase
            .from("profiles")
            .update({ [updateField]: currentVal - 5 })
            .eq("user_id", user.id);
          if (viewErr) {
            toast.error("Kích hoạt thành công nhưng lỗi khi trừ lượt xem.");
          } else {
            const viewType = useVip ? "VIP" : "miễn phí";
            const remaining = currentVal - 5;
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            toast.success(`🎉 Kích hoạt TV thành công! Trừ 5 lượt xem ${viewType}. Còn lại: ${remaining} lượt.`);
          }
        } else {
          const { data: deductData, error: deductError } = await supabase.functions.invoke("deduct-balance", {
            body: { amount: 2500, memo: "📺 Kích hoạt Netflix TV" },
          });
          if (deductError || deductData?.error) {
            toast.error(deductData?.error || "Kích hoạt thành công nhưng lỗi khi trừ tiền.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["profile"] });
            toast.success("🎉 Kích hoạt TV thành công! Trừ 2.500đ.");
          }
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

      <div className="min-h-screen bg-background relative flex">
        {/* Background gradient */}
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-background" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>

        {/* Sidebar */}
        <AppSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          profile={profile}
          userEmail={user?.email}
          isAdmin={isAdmin}
          isCTV={!!isCTV}
          isVip={isVip}
          extensionVersion={extensionVersion}
          extensionOutdated={extensionOutdated}
          onShowExtension={() => setShowExtensionModal(true)}
          onShowDeposit={() => setShowDeposit(true)}
          onSignOut={signOut}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main area */}
        <div className={`flex-1 transition-all duration-300 relative z-10 ${sidebarCollapsed ? "md:ml-16" : "md:ml-[220px]"}`}>
          {/* Topbar */}
          <TopBar
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            isVip={isVip}
            profile={profile}
            userEmail={user?.email}
          />

          {/* Tab Content */}
          <main className="max-w-5xl mx-auto px-4 md:px-8 pb-16 pt-6">
            {activeTab === "netflix" && (
              <>
                <section className="text-center pb-6">
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-3xl md:text-4xl font-bold text-foreground"
                  >
                    {t(
                      `Xin chào, ${profile?.display_name || "bạn"} 👋`,
                      `Hello, ${profile?.display_name || "there"} 👋`
                    )}
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4 }}
                    className="text-muted-foreground mt-2 text-sm"
                  >
                    {t("Sẵn sàng xem phim chưa?", "Ready to watch?")}
                  </motion.p>
                </section>
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
                      onRegisterHandleWatch={(fn) => { watchSectionRef.current = { handleWatch: fn }; }}
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
                      freeViews={(profile as any)?.free_views_left ?? 0}
                      vipViews={(profile as any)?.vip_views_left ?? 0}
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
              </>
            )}

            {activeTab === "products" && (
              <Products embedded />
            )}

            {activeTab === "game_keys" && (
              <Products filterCategory="game_key" embedded />
            )}
          </main>
        </div>
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

      {/* Watch modal */}
      {showWatchModal && (() => {
        const freeV = (profile as any)?.free_views_left ?? 0;
        const vipV = (profile as any)?.vip_views_left ?? 0;
        const hasV = freeV > 0 || vipV > 0;
        const bal = (profile?.balance ?? 0) + (profile?.bonus_balance ?? 0);
        const canWatch = hasV || bal >= 500;
        const doWatch = () => { setShowWatchModal(false); watchSectionRef.current?.handleWatch(); };
        return (
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
            <h2 className="text-center text-2xl font-bold text-foreground mb-6">{t("Chọn gói xem phim", "Choose a plan")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* FREE */}
              <div className="relative rounded-2xl border border-border/40 bg-card/90 p-6 flex flex-col">
                <div className="absolute -top-3 left-5">
                  <span className="bg-secondary text-muted-foreground text-xs font-semibold px-3 py-1 rounded-full border border-border/40">
                    {isVip ? t("Gói thường", "Standard") : t("Gói hiện tại", "Current plan")}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2">Free</h3>
                <p className="text-muted-foreground text-xs mb-4">{t("Xem quảng cáo ngắn trước mỗi phiên", "Short ad before each session")}</p>
                <div className="mb-1">
                  <span className="text-3xl font-extrabold text-green-400">500đ</span>
                  <span className="text-muted-foreground text-sm">/{t("lượt xem", "view")}</span>
                </div>
                <div className="mb-6 mt-4 space-y-3 flex-1">
                  {[
                    t("Hệ thống tự động cấp riêng cho bạn 1 tài khoản Netflix cố định ngay khi tạo tài khoản.", "You get a dedicated Netflix account automatically upon signup."),
                    t("Ưu tiên trừ lượt xem miễn phí, hết lượt mới trừ 500đ/lượt.", "Free views used first, then 500đ/view."),
                    t("2 lượt đổi tài khoản mỗi tháng.", "2 account switches per month."),
                    t("Xem kèm quảng cáo: Cần xem một đoạn quảng cáo ngắn để hỗ trợ duy trì máy chủ trước mỗi phiên.", "Short ad before each session to support server costs."),
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={doWatch}
                  disabled={!canWatch}
                  className="w-full rounded-xl py-3 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
                >
                  {hasV ? t(`Bắt đầu xem (còn ${freeV + vipV} lượt)`, `Start watching (${freeV + vipV} views left)`) : bal >= 500 ? t("Bắt đầu xem — 500đ", "Start watching — 500đ") : t("Hết lượt xem & số dư không đủ", "No views & insufficient balance")}
                </button>
                {!canWatch && (
                  <button onClick={() => { setShowWatchModal(false); setShowDeposit(true); }} className="mt-2 w-full text-xs text-primary hover:underline">
                    {t("Nạp thêm", "Deposit")}
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
                <p className="text-yellow-400/80 text-xs mb-4">{t("Không quảng cáo, ưu tiên hỗ trợ", "No ads, priority support")}</p>
                {isVip ? (
                  <>
                    <div className="mb-1">
                      <span className="text-3xl font-extrabold text-yellow-400">500đ</span>
                      <span className="text-muted-foreground text-sm">/{t("lượt xem", "view")}</span>
                    </div>
                    <div className="text-xs text-yellow-400/70 mb-4">{t("Ưu đãi VIP đang hoạt động!", "VIP benefits active!")}</div>
                  </>
                ) : (
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-yellow-400">{(vipPlans?.[0]?.price ?? 50000).toLocaleString("vi-VN")}đ</span>
                    <span className="text-muted-foreground text-sm">/{vipPlans?.[0] ? Math.round(vipPlans[0].duration_days / 30) + ` ${t("tháng", "mo")}` : t("tháng", "mo")}</span>
                  </div>
                )}
                <div className="mb-6 space-y-3 flex-1">
                  {[
                    t("Sở hữu 1 tài khoản Premium chất lượng cao nhất.", "Get a top-quality Premium account."),
                    t("Ưu tiên đường truyền: Tốc độ cực nhanh, không phải chờ đợi dù trong giờ cao điểm.", "Priority bandwidth: Ultra-fast, no waiting even during peak hours."),
                    t("Hỗ trợ 10 lượt đổi tài khoản mỗi tháng.", "10 account switches per month."),
                    t("Trải nghiệm không gián đoạn: Hoàn toàn sạch bóng quảng cáo.", "Uninterrupted experience: Completely ad-free."),
                  ].map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                {isVip ? (
                  <button
                    onClick={doWatch}
                    disabled={!canWatch}
                    className="w-full rounded-xl py-3 font-bold text-sm text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50 bg-yellow-400 hover:bg-yellow-300"
                  >
                    {hasV ? t(`Xem ngay — VIP 👑 (còn ${vipV + freeV} lượt)`, `Watch now — VIP 👑 (${vipV + freeV} views left)`) : bal >= 500 ? t("Xem ngay — VIP 👑 (500đ)", "Watch now — VIP 👑 (500đ)") : t("Hết lượt xem & số dư không đủ", "No views & insufficient balance")}
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowWatchModal(false); setShowVipPlans(true); }}
                    className="w-full rounded-xl py-3 font-bold text-sm text-black bg-yellow-400 hover:bg-yellow-300 transition-all active:scale-[0.97]"
                  >
                    <Crown className="h-4 w-4 inline mr-1.5" />
                    {t("Nâng cấp VIP ngay", "Upgrade to VIP now")}
                  </button>
                )}
              </div>
            </div>
            <div className="text-center mt-5">
              <button onClick={() => setShowWatchModal(false)} className="bg-secondary/80 text-foreground text-sm font-medium px-8 py-2.5 rounded-xl hover:bg-secondary transition-colors">
                {t("Đóng", "Close")}
              </button>
            </div>
          </motion.div>
        </div>
        );
      })()}
    </>
  );
};

export default Index;
