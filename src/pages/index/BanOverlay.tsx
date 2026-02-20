import { memo } from "react";
import { motion } from "framer-motion";
import { Shield, MessageCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useAppSettings } from "@/hooks/useAppSettings";

type Ban = Tables<"user_bans">;

interface Props {
  ban: Ban;
  onSignOut: () => void;
}

const BanOverlay = memo(({ ban, onSignOut }: Props) => {
  const { linkSupport } = useAppSettings();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md mx-4 rounded-2xl border border-destructive/40 bg-card shadow-2xl overflow-hidden"
      >
        <div className="bg-destructive/10 border-b border-destructive/30 px-6 py-5 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tài khoản bị tạm khóa</h2>
            <p className="text-xs text-muted-foreground">Bạn không thể sử dụng dịch vụ trong thời gian này</p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Lý do bị khóa:</p>
              <p className="text-sm font-semibold text-foreground">{ban.reason}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Thời gian khóa:</p>
                <p className="text-sm text-foreground">{new Date(ban.banned_at).toLocaleString("vi-VN")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Hết hạn lúc:</p>
                <p className="text-sm font-semibold text-destructive">
                  {ban.is_permanent ? "Vĩnh viễn" : ban.expires_at ? new Date(ban.expires_at).toLocaleString("vi-VN") : "—"}
                </p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Nếu bạn cho rằng đây là nhầm lẫn, hãy gửi khiếu nại để được xem xét.
          </p>
          <div className="space-y-2">
            <a
              href={linkSupport || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 font-bold text-sm text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
            >
              <MessageCircle className="h-4 w-4" />
              Khiếu nại / Gửi đơn kháng cáo
            </a>
            <button
              onClick={onSignOut}
              className="w-full rounded-xl py-2.5 border border-border/40 text-sm font-medium text-muted-foreground hover:bg-secondary/40 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

BanOverlay.displayName = "BanOverlay";
export default BanOverlay;
