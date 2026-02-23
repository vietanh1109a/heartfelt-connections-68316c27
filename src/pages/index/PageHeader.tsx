import { memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut, Wallet, User, History, Puzzle, Shield,
  Crown, ChevronDown, AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  return (
    <>
      {extensionOutdated && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-500/90 text-black px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Extension v{extensionVersion} đã cũ! Cần cập nhật.
        </div>
      )}
      <header className={`flex items-center justify-between px-6 md:px-10 py-4 border-b border-border/30 relative z-10 ${extensionOutdated ? "mt-9" : ""}`}>
        <h1 className="text-3xl font-bold text-primary tracking-wider select-none" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          NETFLIX
        </h1>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
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
                <User className="h-4 w-4 text-muted-foreground" /> Cài đặt hồ sơ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/history")} className="cursor-pointer gap-2.5">
                <History className="h-4 w-4 text-muted-foreground" /> Lịch sử giao dịch
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onShowDeposit} className="cursor-pointer gap-2.5">
                <Wallet className="h-4 w-4 text-muted-foreground" /> Nạp tiền
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
                <LogOut className="h-4 w-4" /> Đăng xuất
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
