import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Package, ShoppingCart, Wallet, Settings,
  LayoutDashboard, ArrowLeft, PlusCircle, MessageCircle, Menu,
  ChevronRight,
} from "lucide-react";
import { CTVOverview } from "./components/CTVOverview";
import { CTVListings } from "./components/CTVListings";
import { CTVAddListing } from "./components/CTVAddListing";
import { CTVOrders } from "./components/CTVOrders";
import { CTVRevenue } from "./components/CTVRevenue";
import { CTVWithdraw } from "./components/CTVWithdraw";
import { CTVSettings } from "./components/CTVSettings";

type Tab = "overview" | "listings" | "add-listing" | "orders" | "revenue" | "withdraw" | "settings";

const tabs: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
  { key: "listings", label: "Sản phẩm", icon: Package },
  { key: "add-listing", label: "Thêm SP", icon: PlusCircle },
  { key: "orders", label: "Đơn hàng", icon: ShoppingCart },
  { key: "revenue", label: "Doanh thu", icon: BarChart3 },
  { key: "withdraw", label: "Rút tiền", icon: Wallet },
  { key: "settings", label: "Cài đặt", icon: Settings },
];

const CTVDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: ctvProfile, isLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["ctv-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("ctv_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (profile) return profile;
      const { data: reg } = await supabase
        .from("ctv_registrations").select("*").eq("user_id", user.id).maybeSingle();
      if (reg) {
        const { data: newProfile } = await supabase
          .from("ctv_profiles")
          .insert({ user_id: user.id, display_name: reg.display_name, phone: reg.contact_info || null, status: reg.status === "approved" ? "approved" : "pending" })
          .select("*").single();
        return newProfile;
      }
      return null;
    },
    enabled: !!user,
  });

  useEffect(() => { if (!user) navigate("/auth"); }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ctvProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-foreground">Chưa đăng ký CTV</h1>
          <p className="text-sm text-muted-foreground">Bạn cần đăng ký trước khi truy cập.</p>
        </div>
        <Button onClick={() => navigate("/ctv")} className="dash-glow-btn">Đăng ký ngay</Button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "overview": return <CTVOverview profile={ctvProfile as any} />;
      case "listings": return <CTVListings userId={user.id} onAddNew={() => setActiveTab("add-listing")} />;
      case "add-listing": return <CTVAddListing userId={user.id} onSuccess={() => setActiveTab("listings")} />;
      case "orders": return <CTVOrders userId={user.id} />;
      case "revenue": return <CTVRevenue userId={user.id} />;
      case "withdraw": return <CTVWithdraw profile={ctvProfile as any} onSuccess={refetchProfile} />;
      case "settings": return <CTVSettings profile={ctvProfile as any} onSuccess={refetchProfile} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-56 bg-card border-r border-border/50 flex flex-col transition-transform duration-200 md:translate-x-0 md:static ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        {/* Logo area */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border/50">
          <button onClick={() => navigate("/")} className="p-1 rounded-md hover:bg-accent transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{ctvProfile.display_name}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Cộng tác viên</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 rounded-lg text-[13px] font-medium px-3 py-2 transition-colors ${
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                <span className="flex-1 text-left">{label}</span>
                {active && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">Số dư</span>
            <span className="font-semibold text-foreground">{(ctvProfile.balance ?? 0).toLocaleString("vi-VN")}đ</span>
          </div>
          <a
            href="https://t.me/vietsix" target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-border/50 hover:border-border transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Hỗ trợ
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-14 flex items-center gap-3 px-4 md:px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1 rounded-md hover:bg-accent transition-colors md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-foreground">
            {tabs.find(t => t.key === activeTab)?.label}
          </h2>
        </header>

        <div className="flex-1 p-4 md:p-6 max-w-[1200px] w-full mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default CTVDashboard;
