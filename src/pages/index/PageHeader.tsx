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
        <div className="flex items-center gap-3">
          {/* Glass pill control group */}
          <div className="flex items-center gap-0 rounded-full border border-border/30 bg-card/60 backdrop-blur-md p-1 shadow-sm">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:bg-accent/60"
            >
              <span className={`transition-all duration-300 ${theme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0 w-0 overflow-hidden"}`}>
                <Moon className="h-3.5 w-3.5 text-blue-300" />
              </span>
              <span className={`transition-all duration-300 ${theme === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0 w-0 overflow-hidden"}`}>
                <Sun className="h-3.5 w-3.5 text-amber-500" />
              </span>
              <span className="text-foreground/80">{theme === "dark" ? "Dark" : "Light"}</span>
            </button>

            <div className="w-px h-4 bg-border/40" />

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 hover:bg-accent/60"
            >
              <span className="text-sm leading-none">{lang === "vi" ? "🇻🇳" : "🇬🇧"}</span>
              <span className="text-foreground/80">{lang === "vi" ? "VI" : "EN"}</span>
            </button>
          </div>

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
