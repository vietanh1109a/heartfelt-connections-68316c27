import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Star, HelpCircle, ExternalLink, CreditCard, RefreshCw, Headphones, Eye, LogIn, Puzzle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useAppSettings } from "@/hooks/useAppSettings";

type Profile = Tables<"profiles">;

function fmtVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

interface Props {
  profile: Profile | null | undefined;
  isVip: boolean;
  vipExpiresAt: Date | null;
  maxSwitches: number;
  switchesLeft: number;
  activeCookieCount: number;
  freeViews: number;
  vipViews: number;
  onShowInfo: () => void;
  onShowVipPlans: () => void;
  onShowReportDialog: () => void;
  onShowDeposit?: () => void;
  isGuest?: boolean;
  extensionVersion?: string | null;
  onShowExtensionModal?: () => void;
}

const SidePanel = memo(({
  profile, isVip, vipExpiresAt, maxSwitches, switchesLeft,
  activeCookieCount, freeViews, vipViews, onShowInfo, onShowVipPlans, onShowReportDialog,
  onShowDeposit, isGuest = false, extensionVersion, onShowExtensionModal: _onShowExtensionModal,
}: Props) => {
  const navigate = useNavigate();
  const { isLoading: settingsLoading, linkExtension, linkGuideYoutube, linkFacebook, linkInstagram, linkTelegram, linkTiktok, linkThreads, linkSupport } = useAppSettings();

  const permanentBalance = profile?.balance ?? 0;
  const bonusBalance = profile?.bonus_balance ?? 0;
  const bonusActive = profile?.bonus_expires_at && new Date(profile.bonus_expires_at) > new Date();

  const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date();
  const bonusExpiry = profile?.bonus_expires_at ? new Date(profile.bonus_expires_at) : new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeft = bonusActive ? Math.max(0, Math.ceil((bonusExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const isExpired = !bonusActive;
  const expiresDateStr = bonusExpiry.toLocaleDateString("vi-VN");

  return (
    <div className="space-y-4">
      {/* Plan info card — Guest or Logged-in */}
      <div className="border border-border/40 rounded-xl overflow-hidden bg-card/40">
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-foreground font-bold text-sm mb-4">Account Overview</h3>
        </div>

        {isGuest ? (
          /* ── Guest state ── */
          <div className="px-5 pb-5 space-y-4">
            <div className="text-center py-2">
              <p className="text-foreground font-bold text-base">Chưa đăng nhập</p>
              <p className="text-muted-foreground text-sm mt-1">Đăng nhập để xem Netflix miễn phí</p>
            </div>

            <button
              onClick={() => navigate("/auth")}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập / Đăng ký
            </button>

            {/* Extension status */}
            <div className="border-t border-border/20 pt-4">
              <p className="text-foreground font-semibold text-sm mb-3">Trạng thái Extension</p>
              {extensionVersion ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                  <p className="text-green-400 font-medium text-sm">Đã cài Extension ✓</p>
                  <p className="text-green-400/70 text-xs mt-0.5">Phiên bản v{extensionVersion}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2">
                  <p className="text-destructive font-medium text-sm">Chưa cài Extension</p>
                  <p className="text-muted-foreground text-xs">
                    Để sử dụng XEM NETFLIX, cần cài Extension trên Chrome/Edge.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <a
                      href={linkExtension || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
                      style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Tải Extension
                    </a>
                    <a
                      href={linkGuideYoutube || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-foreground border border-border/40 hover:bg-secondary/40 transition-colors"
                    >
                      <Puzzle className="h-3 w-3" />
                      Xem hướng dẫn
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Logged-in state ── */
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between mb-4 -mt-2">
              <div className="flex items-center gap-2">
                {isVip ? (
                  <span className="flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-bold px-2.5 py-1 rounded-full">
                    <Crown className="h-3 w-3" /> VIP
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 bg-secondary text-muted-foreground border border-border/40 text-xs font-bold px-2.5 py-1 rounded-full">
                    <Star className="h-3 w-3" /> FREE
                  </span>
                )}
                <span className="text-foreground font-semibold text-sm">{isVip ? "Thành viên VIP" : "Gói miễn phí"}</span>
              </div>
              <button
                onClick={onShowInfo}
                className="h-7 w-7 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>

            {isVip ? (
              <div className="space-y-0">
                {[
                  { label: "Số dư:", value: fmtVnd(permanentBalance), color: "text-green-400" },
                  { label: "Lượt xem VIP:", value: vipViews >= 999999 ? "Không giới hạn ∞" : `${vipViews} lượt`, color: "text-yellow-400", icon: <Eye className="h-3 w-3 text-yellow-400 inline mr-1" /> },
                  { label: "Lượt xem miễn phí:", value: `${freeViews} lượt`, color: "text-primary", icon: <Eye className="h-3 w-3 text-primary inline mr-1" /> },
                  { label: "VIP hết hạn:", value: vipExpiresAt ? vipExpiresAt.toLocaleDateString("vi-VN") : "—", color: "text-yellow-400" },
                  { label: "Còn lại:", value: vipExpiresAt ? `${Math.max(0, Math.ceil((vipExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} ngày` : "—", color: "text-yellow-400" },
                  { label: "Tài khoản đang dùng:", value: `${activeCookieCount}`, color: "text-yellow-400" },
                  { label: "Lượt đổi tháng:", value: `${switchesLeft}/${maxSwitches}`, color: "text-foreground" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.color}`}>{row.icon}{row.value}</span>
                  </div>
                ))}
                {bonusActive && bonusBalance > 0 && (
                  <div className="mt-2 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between text-xs">
                    <span className="text-green-400/80">Người mới (hết hạn {expiresDateStr}):</span>
                    <span className="text-green-400 font-semibold">{freeViews} lượt</span>
                  </div>
                )}
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-xs text-yellow-400/80 text-center">
                    🎉 Bạn đang là thành viên <span className="font-bold text-yellow-400">VIP</span>!
                  </p>
                </div>
                <button onClick={onShowVipPlans} className="w-full text-xs text-yellow-500 mt-2 hover:underline flex items-center justify-center gap-1">
                  <Crown className="h-3 w-3" /> Gia hạn VIP
                </button>
              </div>
            ) : (
              <div className="space-y-0">
                <div className="flex items-center justify-between py-3 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">Số dư:</span>
                  <span className="text-sm font-semibold text-green-400">{fmtVnd(permanentBalance)}</span>
                </div>
                <div className="mt-2 mb-1 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between text-xs">
                  <span className="text-green-400/80 flex items-center gap-1"><Eye className="h-3 w-3" /> Lượt xem miễn phí:</span>
                  <span className="text-green-400 font-semibold">{freeViews} lượt</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">Hết hạn lượt xem:</span>
                  <span className={`text-sm font-semibold ${isExpired ? "text-destructive" : "text-green-400"}`}>
                    {isExpired ? `Hết hạn (${expiresDateStr})` : `${daysLeft} ngày (${expiresDateStr})`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/20">
                  <span className="text-sm text-muted-foreground">Tài khoản đang dùng:</span>
                  <span className="text-sm font-semibold text-muted-foreground">{activeCookieCount}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
                  <span className="text-sm text-muted-foreground">Lượt đổi tháng:</span>
                  <span className="text-sm font-semibold text-foreground">{switchesLeft}/{maxSwitches}</span>
                </div>
                <button onClick={onShowVipPlans} className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold text-foreground border border-yellow-500/40 hover:bg-yellow-500/10 hover:border-yellow-500/60 transition-all flex items-center justify-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <span>Nâng cấp <span className="text-yellow-400">VIP</span></span>
                </button>
              </div>
            )}

            <button onClick={() => navigate("/history")} className="text-primary text-xs mt-3 hover:underline flex items-center gap-1">
              Xem lịch sử giao dịch <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Quick actions — only show relevant ones */}
      <div className="space-y-2">
        <button
          onClick={() => isGuest ? navigate("/auth") : onShowDeposit?.()}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-sm uppercase tracking-wide text-primary-foreground transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
        >
          <CreditCard className="h-4 w-4" />
          Nạp thêm
        </button>

        {/* Báo hỏng — ẩn khi guest */}
        {!isGuest && (
          <button
            onClick={onShowReportDialog}
            disabled={switchesLeft <= 0}
            className="w-full group relative overflow-hidden rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 via-orange-500/5 to-yellow-500/5 hover:from-yellow-500/15 hover:via-orange-500/10 hover:to-yellow-500/15 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-400/5 to-yellow-500/0 group-hover:via-yellow-400/10 transition-all duration-500" />
            <div className="relative flex items-center gap-3 px-4 py-3.5">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                <RefreshCw className="h-4 w-4 text-yellow-400 group-hover:rotate-180 transition-transform duration-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground/90">Báo hỏng & Đổi tài khoản</p>
                <p className="text-xs text-muted-foreground mt-0.5">Tự động cấp tài khoản mới ngay lập tức</p>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                <span className={`text-sm font-bold ${switchesLeft > 0 ? "text-yellow-400" : "text-muted-foreground"}`}>
                  {switchesLeft}/{maxSwitches}
                </span>
                <span className="text-xs text-muted-foreground">lượt</span>
              </div>
            </div>
          </button>
        )}

        {linkSupport && (
          <a
            href={linkSupport}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border border-border/40 rounded-xl py-3.5 font-medium text-sm text-primary hover:bg-secondary/40 transition-colors"
          >
            <Headphones className="h-4 w-4" />
            Contact Support
          </a>
        )}
      </div>

      {/* Social promo — luôn hiển thị */}
      <div className="border border-primary/30 rounded-xl p-5 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎁</span>
            <h4 className="text-sm font-bold text-foreground">Theo dõi để nhận lượt xem miễn phí!</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Follow các kênh của chúng tôi để nhận được <span className="text-primary font-semibold">5 lượt xem</span> miễn phí.
          </p>
          <div className="flex items-center gap-2">
            {[
              { icon: "facebook",  label: "Facebook",  url: linkFacebook,  color: "hover:text-blue-400 hover:border-blue-400/40" },
              { icon: "instagram", label: "Instagram", url: linkInstagram, color: "hover:text-pink-500 hover:border-pink-500/40" },
              { icon: "threads",   label: "Threads",   url: linkThreads,   color: "hover:text-foreground hover:border-foreground/40" },
              { icon: "tiktok",    label: "TikTok",    url: linkTiktok,    color: "hover:text-pink-400 hover:border-pink-400/40" },
              { icon: "telegram",  label: "Telegram",  url: linkTelegram,  color: "hover:text-sky-400 hover:border-sky-400/40" },
            ].map((social) => {
              const hasUrl = !settingsLoading && !!social.url;
              return (
                <a
                  key={social.icon}
                  href={hasUrl ? social.url : undefined}
                  target={hasUrl ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  title={social.label}
                  onClick={!hasUrl ? (e) => e.preventDefault() : undefined}
                  className={`h-10 w-10 rounded-lg border border-border/40 flex items-center justify-center transition-all duration-300 ${settingsLoading ? "text-muted-foreground/40 cursor-default" : hasUrl ? `text-muted-foreground ${social.color} hover:bg-secondary/40 cursor-pointer` : "text-muted-foreground/30 cursor-default"}`}
                >
                  {social.icon === "facebook" && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  )}
                  {social.icon === "instagram" && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  )}
                  {social.icon === "threads" && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 192 192"><path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.24-38.27 34.638.44 9.89 5.014 18.4 12.883 23.972 7.466 5.28 17.087 7.834 27.089 7.199 13.183-.837 23.512-5.776 30.695-14.678 5.452-6.762 8.853-15.396 10.272-26.135 6.155 3.716 10.744 8.612 13.36 14.716 4.439 10.369 4.704 27.404-8.376 40.484-11.465 11.465-25.259 16.426-46.018 16.592-23.016-.184-40.39-7.557-51.627-21.91C37.485 141.903 31.392 122.071 31.2 97.003c.192-25.067 6.285-44.9 18.104-58.957C60.54 23.693 77.914 16.32 100.93 16.136c23.208.192 40.946 7.612 52.724 22.048 5.738 7.03 10.03 15.573 12.837 25.462l14.728-3.91c-3.354-11.835-8.58-22.143-15.65-30.813C151.27 12.14 129.637 3.2 100.985 3 72.142 3.2 50.209 12.237 35.564 29.084 19.67 47.432 11.582 72.626 11.339 97.06c.243 24.434 8.331 49.628 24.225 67.976 14.645 16.847 36.578 25.884 65.231 26.084 24.592-.192 42.44-6.784 57.756-22.101 20.694-20.694 20.003-46.334 13.39-61.769-4.745-11.075-13.728-20.09-25.95-26.06l-.454-.202zM99.424 139.52c-11.095.646-22.606-4.362-23.235-14.465-.467-7.486 5.318-15.836 25.27-16.983 2.213-.127 4.381-.19 6.508-.19 6.254 0 12.113.614 17.395 1.794-1.98 24.608-14.075 29.195-25.938 29.844z"/></svg>
                  )}
                  {social.icon === "tiktok" && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                  )}
                  {social.icon === "telegram" && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

SidePanel.displayName = "SidePanel";
export default SidePanel;
