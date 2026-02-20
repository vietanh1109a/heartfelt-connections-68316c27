import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useAdmin } from "@/hooks/useAdmin";

/**
 * AdminRoute — only renders children if user is an admin or moderator.
 * Falls back to home page for regular users.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isModerator, isLoading: roleLoading } = useAdmin();

  // Wait for both auth and role checks to complete
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-xl">Đang tải...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && !isModerator) return <Navigate to="/" replace />;

  return <>{children}</>;
}
