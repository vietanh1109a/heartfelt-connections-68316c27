import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase injects the session from the URL hash automatically on load
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    // Also check if session already exists (in case event fired before listener)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Mật khẩu nhập lại không khớp!");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Không thể đặt lại mật khẩu. Link có thể đã hết hạn. Vui lòng thử lại.");
    } else {
      setDone(true);
      toast.success("Mật khẩu đã được cập nhật thành công!");
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold tracking-tight text-primary"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            NETFLIX
          </h1>
          <p className="text-muted-foreground mt-2">Đặt lại mật khẩu</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-foreground">
              Mật khẩu mới
            </CardTitle>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="text-center space-y-4 py-4">
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <p className="text-foreground font-medium">Đặt lại mật khẩu thành công!</p>
                <p className="text-muted-foreground text-sm">Đang chuyển hướng về trang chủ...</p>
              </div>
            ) : !sessionReady ? (
              <div className="text-center space-y-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground text-sm">Đang xác thực link đặt lại mật khẩu...</p>
                <p className="text-xs text-muted-foreground">
                  Nếu quá lâu,{" "}
                  <button onClick={() => navigate("/auth")} className="text-primary hover:underline">
                    quay lại trang đăng nhập
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mật khẩu mới"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className="pl-10 pr-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                    <span className="text-destructive text-xs mt-0.5">⚠</span>
                    <p className="text-destructive text-xs">{error}</p>
                  </div>
                )}
                <Button type="submit" className="w-full text-lg font-semibold" disabled={loading}>
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang cập nhật...</>
                    : "Đặt lại mật khẩu"
                  }
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/auth")}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPassword;
