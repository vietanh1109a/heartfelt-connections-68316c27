import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Wallet, User, History, Puzzle, Shield,
  Crown, ChevronDown, AlertTriangle, Sun, Moon, Globe,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/language";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface Props {
  profile: Profile | null | undefined;
  userEmail: string | undefined;
  isAdmin: boolean;
  isVip: boolean;
  extensionVersion: string | null;
  extensionOutdated: boolean;
  onShowExtension: () => void;
  onSignOut: () => void;
  onShowDeposit: () => void;
}

const PageHeader = memo(({
  profile, userEmail, isAdmin, isVip,
  extensionVersion, extensionOutdated,
  onShowExtension, onSignOut, onShowDeposit,
}: Props) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLanguage();

  return (
    <>
      {extensionOutdated && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-500/90 text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Extension v{extensionVersion} {t("đã cũ! Cần cập nhật.", "is outdated! Please update.")}
        </div>
      )}
      <header className={`flex items-center justify-between px-6 md:px-10 py-4 border-b border-border/30 relative z-10 ${extensionOutdated ? "mt-9" : ""}`}>
        <h1 className="text-3xl font-bold text-primary tracking-wider select-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          NETFLIX
        </h1>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLang(lang === "vi" ? "en" : "vi")}
                className="h-8 w-8 rounded-lg border border-border/40 bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                <span className="text-xs font-bold text-foreground">{lang === "vi" ? "EN" : "VI"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{lang === "vi" ? "Switch to English" : "Chuyển sang Tiếng Việt"}</p>
            </TooltipContent>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleTheme}
                className="h-8 w-8 rounded-lg border border-border/40 bg-card hover:bg-accent flex items-center justify-center transition-colors"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4 text-yellow-400" />
                ) : (
                  <Moon className="h-4 w-4 text-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t(theme === "dark" ? "Chế độ sáng" : "Chế độ tối", theme === "dark" ? "Light mode" : "Dark mode")}</p>
            </TooltipContent>
          </Tooltip>

          {/* User dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity ml-1">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">
                    {(profile?.display_name || userEmail || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden sm:flex flex-col items-start">
                  <span className="text-foreground font-medium text-sm">{profile?.display_name || "User"}</span>
                  {isVip ? (
                    <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" /> VIP
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Free</span>
                  )}
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border/40">
              <div className="px-3 py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground font-bold text-sm">
                    {(profile?.display_name || userEmail || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{profile?.display_name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer gap-2.5">
                <User className="h-4 w-4 text-muted-foreground" /> {t("Cài đặt hồ sơ", "Profile Settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/history")} className="cursor-pointer gap-2.5">
                <History className="h-4 w-4 text-muted-foreground" /> {t("Lịch sử giao dịch", "Transaction History")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowDeposit} className="cursor-pointer gap-2.5">
                <Wallet className="h-4 w-4 text-muted-foreground" /> {t("Nạp tiền", "Deposit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowExtension} className="cursor-pointer gap-2.5">
                <Puzzle className="h-4 w-4 text-muted-foreground" /> Extension
                {extensionVersion && (
                  <span className={`ml-auto text-xs ${extensionOutdated ? "text-yellow-400" : "text-green-400"}`}>
                    v{extensionVersion}
                  </span>
                )}
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer gap-2.5">
                  <Shield className="h-4 w-4 text-primary" /> Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut} className="cursor-pointer gap-2.5 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> {t("Đăng xuất", "Sign Out")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </>
  );
});

PageHeader.displayName = "PageHeader";
export default PageHeader;
