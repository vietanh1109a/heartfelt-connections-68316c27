import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Package, ShoppingCart, Wallet, Settings,
  LayoutDashboard, ArrowLeft, PlusCircle, MessageCircle, Menu,
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
        .from("ctv_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) return profile;

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

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!ctvProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="p-4 rounded-2xl bg-primary/10">
          <Package className="h-12 w-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Chưa đăng ký CTV</h1>
        <p className="text-muted-foreground text-sm">Bạn cần đăng ký CTV trước khi truy cập Dashboard.</p>
        <Button onClick={() => navigate("/ctv")} className="ctv-glow-btn">Đăng ký CTV ngay</Button>
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
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full bg-card/95 backdrop-blur-xl border-r border-border/30 flex flex-col transition-all duration-300 md:translate-x-0 md:static md:w-[200px] ${
        sidebarOpen ? "w-[200px] translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="px-3 py-4 border-b border-border/20">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold text-foreground">CTV Panel</h1>
              <p className="text-[10px] text-muted-foreground truncate">{ctvProfile.display_name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 rounded-xl text-xs font-medium px-3 py-2 transition-all relative group ${
                activeTab === key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              {activeTab === key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r-full bg-primary" />
              )}
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom mini cards */}
        <div className="border-t border-border/20 p-2 space-y-1.5">
          <div className="rounded-xl bg-accent/50 p-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Khả dụng</span>
              <span className="text-primary font-bold">{(ctvProfile.balance ?? 0).toLocaleString("vi-VN")}đ</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Trạng thái</span>
              <span className="text-green-400 font-medium text-[9px]">● Active</span>
            </div>
          </div>
          <a
            href="https://t.me/vietsix"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-medium border border-border/40 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          >
            <MessageCircle className="h-3 w-3" />
            Liên hệ Admin
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border/20 bg-card/80 backdrop-blur-xl sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {tabs.find(t => t.key === activeTab)?.label}
          </span>
        </header>

        <div className="p-4 md:p-5 max-w-[1280px] mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default CTVDashboard;
