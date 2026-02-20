import { memo, useState } from "react";

import { Play, Headphones, ShoppingBag } from "lucide-react";
import PlanSelector from "./PlanSelector";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MIN_EXTENSION_VERSION, compareVersions, useCookieActions } from "@/hooks/useIndexData";
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

  const handleWatch = async () => {
    const effectiveBalance = (profile?.balance ?? 0) + (profile?.bonus_balance ?? 0);
    if (!user || !profile) return;
    if (effectiveBalance < 500) {
      toast.error("Số dư không đủ. Cần ít nhất 500đ để xem Netflix.");
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
        onShowExtensionModal();
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
            onClick={() => isVip ? handleWatch() : onShowWatchModal()}
            disabled={watchLoading || ((profile?.balance ?? 0) + (profile?.bonus_balance ?? 0)) < 500}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-3 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
          >
            <Play className="h-4 w-4" />
            {watchLoading ? "Đang xử lý..." : "Xem Netflix"}
          </button>
          <button
            onClick={() => window.open("#", "_blank")}
            className="w-full flex items-center justify-center gap-2 border border-border/40 rounded-lg py-3 font-medium text-sm text-foreground/80 hover:bg-secondary/40 transition-colors"
          >
            <Headphones className="h-4 w-4" />
            Contact Support
          </button>
        </div>
        <div className="mt-4 pt-3 border-t border-border/20 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Trạng thái:</span>
          {extensionVersion ? (
            <span className={`font-medium ${extensionOutdated ? "text-yellow-500" : "text-green-500"}`}>
              {extensionOutdated ? `Cần cập nhật (v${extensionVersion})` : `Đã cài đặt — v${extensionVersion}`}
            </span>
          ) : (
            <button onClick={onShowExtensionModal} className="text-destructive hover:underline font-medium">
              Extension chưa được cài. Xem hướng dẫn!
            </button>
          )}
        </div>
      </div>

      {/* Kích hoạt TV */}
      <div className="border border-primary/30 rounded-xl p-5 bg-card/40">
        <h4 className="font-bold text-foreground text-base mb-1">Kích hoạt TV</h4>
        <p className="text-muted-foreground text-xs mb-4">
          Bật TV → Mở Netflix → Nhập mã 8 số hiển thị trên TV vào ô bên dưới:
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
          <p className="text-xs text-destructive mb-2">⚠ Cần cài Extension để dùng tính năng này.</p>
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
