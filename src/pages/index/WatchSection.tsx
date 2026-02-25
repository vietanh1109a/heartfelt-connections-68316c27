import { memo, useState } from "react";

import { Play, Headphones, ShoppingBag } from "lucide-react";
import PlanSelector from "./PlanSelector";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MIN_EXTENSION_VERSION, compareVersions, useCookieActions } from "@/hooks/useIndexData";
import { useAppSettings } from "@/hooks/useAppSettings";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface Props {
  user: { id: string } | null | undefined;
  profile: Profile | null | undefined;
  isVip: boolean;
  maxSwitches: number;
  switchesLeft: number;
  extensionVersion: string | null;
  setExtensionVersion: (v: string) => void;
  extensionOutdated: boolean;
  onShowExtensionModal: () => void;
  onShowWatchModal: () => void;
  onShowReportDialog: () => void;
  tvCode: string;
  setTvCode: (v: string) => void;
  onShowTvConfirm: () => void;
}

const WatchSection = memo(({
  user, profile, isVip, maxSwitches: _maxSwitches, switchesLeft: _switchesLeft,
  extensionVersion, setExtensionVersion, extensionOutdated,
  onShowExtensionModal, onShowWatchModal, onShowReportDialog: _onShowReportDialog,
  tvCode, setTvCode, onShowTvConfirm,
}: Props) => {
  const [watchLoading, setWatchLoading] = useState(false);
  const queryClient = useQueryClient();
  const { trySendCookie, checkExtensionAlive } = useCookieActions(user, extensionVersion, setExtensionVersion);
  const { linkSupport } = useAppSettings();

  const handleWatch = async () => {
    if (!user || !profile) return;

    // Priority: deduct views first (free or VIP), then fall back to balance
    const freeViews = (profile as any).free_views_left ?? 0;
    const vipViews = (profile as any).vip_views_left ?? 0;
    const hasViews = freeViews > 0 || vipViews > 0;
    const effectiveBalance = (profile as any)?.effective_balance ?? ((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0));

    if (!hasViews && effectiveBalance < 500) {
      toast.error("Hết lượt xem và số dư không đủ. Cần ít nhất 500đ hoặc mua thêm lượt xem.");
      return;
    }
    if (extensionOutdated) {
      toast.error(`Extension phiên bản ${extensionVersion} đã cũ. Vui lòng cập nhật lên v${MIN_EXTENSION_VERSION}+`);
      onShowExtensionModal();
      return;
    }
    setWatchLoading(true);
    try {
      const detectedVersion = await checkExtensionAlive();
      if (!detectedVersion) {
        onShowExtensionModal();
        toast.error("Extension chưa được cài đặt hoặc không phản hồi. Không trừ tiền.");
        return;
      }
      if (compareVersions(detectedVersion, MIN_EXTENSION_VERSION) < 0) {
        toast.error(`Extension phiên bản ${detectedVersion} đã cũ. Vui lòng cập nhật lên v${MIN_EXTENSION_VERSION}+`);
        onShowExtensionModal();
        return;
      }

      // Fetch cookies via edge function (bypasses RLS on cookie_stock)
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assign-cookie`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({}),
      });
      const assignResult = await res.json();
      
      if (!res.ok || assignResult.error) {
        toast.error(assignResult.error || "Không thể lấy tài khoản.");
        return;
      }
      
      const activeCookies = (assignResult.assignments || [])
        .filter((a: any) => a.is_active && a.cookie_data)
        .map((a: any) => ({ cookie_data: a.cookie_data }));
      
      if (activeCookies.length === 0) {
        toast.error("Kho tài khoản đã hết. Vui lòng liên hệ hỗ trợ.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["cookie-assignments"] });

      let extensionResponded = false;
      for (const cookie of activeCookies) {
        extensionResponded = await trySendCookie(cookie.cookie_data);
        if (extensionResponded) break;
      }

      if (!extensionResponded) {
        onShowExtensionModal();
        toast.error("Extension chưa được cài đặt hoặc không phản hồi. Không trừ tiền.");
        return;
      }

      // Deduct logic: views first → then balance
      if (hasViews) {
        // Deduct 1 view: VIP views first, then free views
        const useVip = vipViews > 0;
        const updateField = useVip ? "vip_views_left" : "free_views_left";
        const currentVal = useVip ? vipViews : freeViews;
        const { error: viewErr } = await supabase
          .from("profiles")
          .update({ [updateField]: currentVal - 1 })
          .eq("user_id", user.id);
        if (viewErr) {
          toast.error("Lỗi trừ lượt xem. Vui lòng thử lại.");
          return;
        }
        const viewType = useVip ? "VIP" : "miễn phí";
        const remaining = currentVal - 1;
        toast.success(`✅ Netflix đã được mở! Trừ 1 lượt xem ${viewType}. Còn lại: ${remaining} lượt.`);
      } else {
        // No views left — deduct 500đ from balance
        const { data: deductData, error: deductError } = await supabase.functions.invoke("deduct-balance", {
          body: { amount: 500, memo: "Xem phim Netflix" },
        });
        if (deductError || deductData?.error) {
          toast.error(deductData?.error || "Lỗi khi trừ tiền. Vui lòng thử lại.");
          return;
        }
        toast.success("✅ Netflix đã được mở! Trừ 500đ. Chúc bạn xem phim vui vẻ!");
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } finally {
      setWatchLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-foreground font-bold text-lg">Chọn phương thức xem Netflix</h3>

      {/* Xem trên PC */}
      <div className="border border-border/40 rounded-xl p-5 bg-card/40">
        <h4 className="font-bold text-foreground text-base mb-1">Xem trên PC</h4>
        <p className="text-muted-foreground text-xs mb-4">
          Mở Netflix ngay trên trình duyệt PC, nhanh chóng và tiện lợi. Mỗi lượt xem chỉ 500đ.
        </p>
        <div className="space-y-2.5">
          <button
            onClick={() => {
              if (!user) {
                window.location.href = "/auth";
                return;
              }
              isVip ? handleWatch() : onShowWatchModal();
            }}
            disabled={watchLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
          >
            <Play className="h-4 w-4" />
            {watchLoading ? "Đang xử lý..." : "Xem Netflix"}
          </button>
          <button
            onClick={() => linkSupport ? window.open(linkSupport, "_blank") : undefined}
            className="w-full flex items-center justify-center gap-2 border border-border/40 rounded-lg py-3 font-medium text-sm text-foreground/80 hover:bg-secondary/40 transition-colors"
          >
            <Headphones className="h-4 w-4" />
            Liên hệ hỗ trợ
          </button>
        </div>
        <div className="mt-4 pt-3 border-t border-border/20 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Trạng thái:</span>
          {extensionVersion ? (
            <span className={`font-medium ${extensionOutdated ? "text-yellow-500" : "text-green-500"}`}>
              {extensionOutdated ? `Cần cập nhật (v${extensionVersion})` : `Đã cài đặt — v${extensionVersion}`}
            </span>
          ) : (
            <button
              onClick={onShowExtensionModal}
              className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
            >
              Extension chưa được cài. Xem hướng dẫn!
            </button>
          )}
        </div>
      </div>

      {/* Kích hoạt TV */}
      <div className="border border-primary/30 rounded-xl p-5 bg-card/40">
        <h4 className="font-bold text-foreground text-base mb-1">Kích hoạt TV</h4>
        <p className="text-muted-foreground text-xs mb-4">
          Bật TV → Mở Netflix → Nhập mã 8 số hiển thị trên TV vào ô bên dưới. Chi phí: 5 lượt xem hoặc 2.500đ.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            maxLength={8}
            value={tvCode}
            onChange={(e) => setTvCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
            onKeyDown={(e) => e.key === "Enter" && tvCode.length === 8 && onShowTvConfirm()}
            placeholder="Nhập mã 8 số từ TV"
            className="flex-1 bg-secondary/80 border border-border/40 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors tracking-widest font-mono"
          />
          <button
            onClick={onShowTvConfirm}
            disabled={tvCode.length !== 8 || !extensionVersion}
            className="rounded-lg px-5 py-2.5 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
          >
            Kích hoạt TV
          </button>
        </div>
        {!extensionVersion && (
          <button
            onClick={onShowExtensionModal}
            className="w-full text-xs font-medium px-3 py-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 mb-2 hover:bg-red-500/20 transition-colors text-left"
          >
            ⚠ Cần cài Extension để dùng tính năng này. Xem hướng dẫn!
          </button>
        )}
        <div className="bg-secondary/40 border border-border/30 rounded-lg p-3 mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Hướng dẫn kích hoạt thủ công (dùng PC)</p>
          <div className="space-y-1.5">
            {['Trên PC: Bấm "Watch as Guest"', "Truy cập netflix.com/tv2", "Nhập mã TV → Nhấn Enter"].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-[10px]">{i + 1}</span>
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mua gói chính chủ */}
      <div className="border border-border/40 rounded-xl p-5 bg-card/40">
        <div className="flex items-center gap-2 mb-1">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h4 className="font-bold text-foreground text-base">Mua gói chính chủ</h4>
        </div>
        <p className="text-muted-foreground text-xs mb-4">
          Đăng ký tài khoản Netflix chính chủ với đầy đủ tính năng và nhiều profile.
        </p>
        <PlanSelector />
      </div>
    </div>
  );
});

WatchSection.displayName = "WatchSection";
export default WatchSection;
