import { useAdmin } from "@/hooks/useAdmin";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Cookie, DollarSign, Shield, Wallet, Film, Crown, BarChart2, Settings, UserCheck, AlertTriangle, Package, UserPlus, Handshake } from "lucide-react";
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
import { ProductsTab } from "./components/ProductsTab";
import { CTVListingsTab } from "./components/CTVListingsTab";
import { CTVManagementTab } from "./components/CTVManagementTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { isModerator, canViewTab, isAdmin: isSuperAdmin } = useRolePermissions();
  const navigate = useNavigate();

  const { data: pendingReportsCount } = useQuery({
    queryKey: ["pending-reports-count"],
    queryFn: async () => {
      const { count } = await supabase.from("cookie_reports").select("id", { count: "exact", head: true }).eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const hasAccess = isAdmin || isModerator;

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Shield className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">Không có quyền truy cập</h1>
        <Button variant="outline" onClick={() => navigate("/")}>Về trang chủ</Button>
      </div>
    );
  }

  const tabs = [
    { value: "stats", label: "Thống kê", icon: <BarChart2 className="h-3.5 w-3.5" />, content: <StatsTab /> },
    { value: "users", label: "Users", icon: <Users className="h-3.5 w-3.5" />, content: <UsersTab /> },
    { value: "cookie-reports", label: "Báo lỗi", icon: (
      <span className="relative">
        <AlertTriangle className="h-3.5 w-3.5" />
        {(pendingReportsCount ?? 0) > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive text-[8px] font-bold flex items-center justify-center text-white">{pendingReportsCount}</span>}
      </span>
    ), content: <CookieReportsTab /> },
    { value: "cookies", label: "Cookies", icon: <Cookie className="h-3.5 w-3.5" />, content: <CookieStockTab /> },
    { value: "netflix-accounts", label: "Netflix", icon: <Film className="h-3.5 w-3.5" />, content: <NetflixAccountsTab /> },
    { value: "transactions", label: "Giao dịch", icon: <DollarSign className="h-3.5 w-3.5" />, content: <TransactionsTab /> },
    { value: "deposits", label: "Nạp tiền", icon: <Wallet className="h-3.5 w-3.5" />, content: <DepositsTab /> },
    { value: "vip-plans", label: "VIP", icon: <Crown className="h-3.5 w-3.5" />, content: <VipPlansTab /> },
    { value: "products", label: "Sản phẩm", icon: <Package className="h-3.5 w-3.5" />, content: <ProductsTab /> },
    { value: "ctv-listings", label: "SP CTV", icon: <UserPlus className="h-3.5 w-3.5" />, content: <CTVListingsTab /> },
    { value: "ctv-management", label: "CTV", icon: <Handshake className="h-3.5 w-3.5" />, content: <CTVManagementTab /> },
    ...(isSuperAdmin ? [
      { value: "moderators", label: "Mods", icon: <UserCheck className="h-3.5 w-3.5" />, content: <ModeratorsTab /> },
      { value: "settings", label: "Cài đặt", icon: <Settings className="h-3.5 w-3.5" />, content: <SettingsTab /> },
    ] : []),
  ].filter(tab => canViewTab(tab.value));

  const defaultTab = tabs[0]?.value ?? "stats";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {isSuperAdmin ? "Admin" : "Moderator"} Dashboard
            </h1>
          </div>
        </div>
        {isModerator && !isSuperAdmin && (
          <span className="text-[11px] px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-medium">Mod</span>
        )}
      </header>

      <div className="max-w-[1200px] mx-auto p-4 md:p-6">
        <Tabs defaultValue={defaultTab}>
          <div className="overflow-x-auto pb-1">
            <TabsList className="mb-5 bg-accent/50 border border-border/50 p-1 rounded-lg inline-flex">
              {tabs.map(tab => (
                <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 rounded-md text-xs px-3 py-1.5 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                  {tab.icon} {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {tabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>{tab.content}</TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
