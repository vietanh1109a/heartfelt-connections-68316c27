import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Package, ShoppingCart, Wallet, Settings,
  LayoutDashboard, ArrowLeft, LogOut, PlusCircle, MessageCircle,
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
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "listings", label: "Sản phẩm của tôi", icon: Package },
  { key: "add-listing", label: "Thêm sản phẩm", icon: PlusCircle },
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
      // Try ctv_profiles first
      const { data: profile } = await supabase
        .from("ctv_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) return profile;

      // Fallback: if ctv_registrations exists, auto-create ctv_profiles
      const { data: reg } = await supabase
        .from("ctv_registrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (reg) {
        const { data: newProfile } = await supabase
          .from("ctv_profiles")
          .insert({
            user_id: user.id,
            display_name: reg.display_name,
            phone: reg.contact_info || null,
            status: reg.status === "approved" ? "approved" : "pending",
          })
          .select("*")
          .single();
        return newProfile;
      }
      return null;
    },
    enabled: !!user,
  });

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Đang tải...</div>
      </div>
    );
  }

  if (!ctvProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Package className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Chưa đăng ký CTV</h1>
        <p className="text-muted-foreground">Bạn cần đăng ký CTV trước khi truy cập Dashboard.</p>
        <Button onClick={() => navigate("/ctv")}>Đăng ký CTV ngay</Button>
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-card border-r border-border/50 flex flex-col transition-all duration-300 md:translate-x-0 md:static md:w-[220px] ${
        sidebarOpen ? "w-[220px] translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-bold text-foreground truncate">CTV Dashboard</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate px-1">{ctvProfile.display_name}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-lg text-sm font-medium px-3 py-2.5 transition-all relative ${
                activeTab === key
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {activeTab === key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="border-t border-border/50 px-3 py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Khả dụng</span>
            <span className="text-primary font-bold">{(ctvProfile.balance ?? 0).toLocaleString("vi-VN")}đ</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mt-1">
            <span>Chờ duyệt</span>
            <span className="text-yellow-400 font-bold">0đ</span>
          </div>
          <a
            href="https://t.me/vietsix"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mx-1 mt-2 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Liên hệ Admin
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-30">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <LayoutDashboard className="h-5 w-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground">
            {tabs.find(t => t.key === activeTab)?.label}
          </span>
        </header>

        <div className="p-4 md:p-6 lg:p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default CTVDashboard;
