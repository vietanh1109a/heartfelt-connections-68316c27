import { useAdmin } from "@/hooks/useAdmin";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Cookie, DollarSign, Shield, Wallet, Film, Crown, BarChart2, Settings, UserCheck, AlertTriangle } from "lucide-react";
import { UsersTab } from "./components/UsersTab";
import { CookieStockTab } from "./components/CookieStockTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { DepositsTab } from "./components/DepositsTab";
import { NetflixAccountsTab } from "./components/NetflixAccountsTab";
import { VipPlansTab } from "./components/VipPlansTab";
import { StatsTab } from "./components/StatsTab";
import { SettingsTab } from "./components/SettingsTab";
import { ModeratorsTab } from "./components/ModeratorsTab";
import { CookieReportsTab } from "./components/CookieReportsTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isModerator, canViewTab, isAdmin: isSuperAdmin } = useRolePermissions();
  const navigate = useNavigate();

  // Count pending cookie reports for badge
  const { data: pendingReportsCount } = useQuery({
    queryKey: ["pending-reports-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("cookie_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const hasAccess = isAdmin || isModerator;

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Đang kiểm tra quyền...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Shield className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground">Không có quyền truy cập</h1>
        <p className="text-muted-foreground">Bạn không phải admin hoặc moderator.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Về trang chủ</Button>
      </div>
    );
  }

  // Tabs definition with their access key
  const tabs = [
    { value: "stats", label: "Thống kê", icon: <BarChart2 className="h-4 w-4" />, content: <StatsTab /> },
    { value: "users", label: "Users", icon: <Users className="h-4 w-4" />, content: <UsersTab /> },
    {
      value: "cookie-reports",
      label: "Báo lỗi",
      icon: (
        <span className="relative">
          <AlertTriangle className="h-4 w-4" />
          {(pendingReportsCount ?? 0) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-destructive text-[9px] font-bold flex items-center justify-center text-destructive-foreground">
              {pendingReportsCount}
            </span>
          )}
        </span>
      ),
      content: <CookieReportsTab />,
    },
    { value: "cookies", label: "Cookie Stock", icon: <Cookie className="h-4 w-4" />, content: <CookieStockTab /> },
    { value: "netflix-accounts", label: "Netflix Accounts", icon: <Film className="h-4 w-4" />, content: <NetflixAccountsTab /> },
    { value: "transactions", label: "Giao dịch", icon: <DollarSign className="h-4 w-4" />, content: <TransactionsTab /> },
    { value: "deposits", label: "Nạp tiền", icon: <Wallet className="h-4 w-4" />, content: <DepositsTab /> },
    { value: "vip-plans", label: "Gói VIP", icon: <Crown className="h-4 w-4" />, content: <VipPlansTab /> },
    // Only super admin can manage moderators and settings
    ...(isSuperAdmin ? [
      { value: "moderators", label: "Moderators", icon: <UserCheck className="h-4 w-4" />, content: <ModeratorsTab /> },
      { value: "settings", label: "Cài đặt", icon: <Settings className="h-4 w-4" />, content: <SettingsTab /> },
    ] : []),
  ].filter(tab => canViewTab(tab.value));

  const defaultTab = tabs[0]?.value ?? "stats";

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {isSuperAdmin ? "Super Admin Dashboard" : "Moderator Dashboard"}
          </h1>
        </div>
        {isModerator && !isSuperAdmin && (
          <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            Moderator
          </span>
        )}
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-6 flex-wrap">
            {tabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.icon} {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
