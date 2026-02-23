import { memo } from "react";
import {
  Play, Package, Gamepad2, History, Settings,
  Wallet, Crown, Shield, Puzzle, LogOut, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

type TabKey = "netflix" | "products" | "game_keys";

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  profile: Profile | null | undefined;
  userEmail: string | undefined;
  isAdmin: boolean;
  isVip: boolean;
  extensionVersion: string | null;
  extensionOutdated: boolean;
  onShowExtension: () => void;
  onShowDeposit: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const mainNav: { key: TabKey; label: string; icon: typeof Play }[] = [
  { key: "netflix", label: "Netflix", icon: Play },
  { key: "products", label: "Sản phẩm", icon: Package },
  { key: "game_keys", label: "Key Game", icon: Gamepad2 },
];

const AppSidebar = memo(({
  activeTab, onTabChange, profile, userEmail, isAdmin, isVip,
  extensionVersion, extensionOutdated,
  onShowExtension, onShowDeposit, onSignOut, collapsed, onToggleCollapse,
}: SidebarProps) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onToggleCollapse}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ${
          collapsed ? "-translate-x-full md:translate-x-0 md:w-16" : "w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-sidebar-border">
          <h1
            className={`font-bold text-sidebar-primary tracking-wider select-none transition-all ${
              collapsed ? "text-lg text-center" : "text-2xl"
            }`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {collapsed ? "N" : "NETFLIX"}
          </h1>
        </div>

        {/* Extension warning */}
        {extensionOutdated && !collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Extension cũ! Cần cập nhật.
          </div>
        )}

        {/* Main navigation */}
        <nav className={`flex-1 px-2 py-4 space-y-1 ${collapsed ? "overflow-hidden" : "overflow-y-auto"}`}>
          <p className={`text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-2 ${collapsed ? "text-center" : "px-3"}`}>
            {collapsed ? "—" : "Menu"}
          </p>

          {mainNav.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all relative group ${
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
              } ${
                activeTab === key
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              {/* Active indicator — red bar left */}
              {activeTab === key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-lg z-50">
                  {label}
                </span>
              )}
            </button>
          ))}

          <div className="h-px bg-sidebar-border my-3" />

          <p className={`text-[10px] font-semibold uppercase text-muted-foreground tracking-wider mb-2 ${collapsed ? "text-center" : "px-3"}`}>
            {collapsed ? "—" : "Tài khoản"}
          </p>

          {/* Secondary nav items */}
          {[
            { label: "Nạp tiền", icon: Wallet, onClick: onShowDeposit },
            { label: "Lịch sử", icon: History, onClick: () => navigate("/history") },
            { label: "Cài đặt", icon: Settings, onClick: () => navigate("/profile") },
            { label: "Extension", icon: Puzzle, onClick: onShowExtension, badge: extensionVersion ? (extensionOutdated ? "⚠" : `v${extensionVersion}`) : undefined, badgeColor: extensionOutdated ? "text-yellow-400" : "text-green-400" },
          ].map(({ label, icon: Icon, onClick, badge, badgeColor }) => (
            <button
              key={label}
              onClick={onClick}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all relative group ${
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{label}</span>
                  {badge && <span className={`text-[10px] ${badgeColor}`}>{badge}</span>}
                </>
              )}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-lg z-50">
                  {label}
                </span>
              )}
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-sidebar-primary/80 hover:text-sidebar-primary hover:bg-sidebar-accent/50 transition-all relative group ${
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"
              }`}
            >
              <Shield className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Admin</span>}
              {collapsed && (
                <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-lg z-50">
                  Admin
                </span>
              )}
            </button>
          )}
        </nav>

        {/* User section at bottom — only show when logged in */}
        {userEmail && (
          <div className="border-t border-sidebar-border px-2 py-3">
            <div className={`flex items-center gap-2.5 px-2 py-2 ${collapsed ? "justify-center" : ""}`}>
              <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center shrink-0">
                <span className="text-sidebar-primary-foreground font-bold text-sm">
                  {(profile?.display_name || userEmail || "U").charAt(0).toUpperCase()}
                </span>
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">
                    {profile?.display_name || "User"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                  {isVip && (
                    <span className="text-[10px] font-bold text-yellow-500 flex items-center gap-0.5">
                      <Crown className="h-2.5 w-2.5" /> VIP
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onSignOut}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all mt-1 ${
                collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
              }`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Đăng xuất</span>}
            </button>
          </div>
        )}
      </aside>
    </>
  );
});

AppSidebar.displayName = "AppSidebar";
export default AppSidebar;
