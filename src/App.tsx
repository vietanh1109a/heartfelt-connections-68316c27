import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { supabase } from "@/integrations/supabase/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminRoute } from "@/lib/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Deposit from "./pages/Deposit";
import TransactionHistory from "./pages/TransactionHistory";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Profile from "./pages/Profile";
import ResetPassword from "./pages/ResetPassword";
import Products from "./pages/Products";
import GameKeys from "./pages/GameKeys";
import PurchaseHistory from "./pages/PurchaseHistory";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-primary text-xl">Đang tải...</div></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("is_verified")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          setIsVerified(data?.is_verified ?? false);
        });
    } else {
      setIsVerified(null);
    }
  }, [user]);

  if (loading) return null;
  if (user && isVerified === true) return <Navigate to="/" replace />;
  // While checking or if not verified, keep showing the auth page
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/" element={<Index />} />
            <Route path="/deposit" element={<ProtectedRoute><Deposit /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/products" element={<Products />} />
            <Route path="/game-keys" element={<GameKeys />} />
            <Route path="/purchase-history" element={<ProtectedRoute><PurchaseHistory /></ProtectedRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
