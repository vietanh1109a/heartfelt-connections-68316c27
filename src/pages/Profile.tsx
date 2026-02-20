import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, User, Lock, Crown, Copy, CheckCircle2, Wallet, Star } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const Profile = () => {
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Sync display name when profile loads
  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name);
  }, [profile?.display_name]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [copied, setCopied] = useState(false);

  const isVip = !!(profile as any)?.vip_expires_at && new Date((profile as any).vip_expires_at) > new Date();
  const vipExpiresAt = (profile as any)?.vip_expires_at ? new Date((profile as any).vip_expires_at) : null;
  const referralCode = user?.email ?? "";

  const handleSaveName = async () => {
    if (!displayName.trim()) { toast.error("Tên không được để trống"); return; }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("user_id", user!.id);
    if (error) { toast.error("Lỗi cập nhật tên"); }
    else {
      toast.success("Đã cập nhật tên hiển thị!");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error("Mật khẩu mới cần ít nhất 6 ký tự"); return; }
    if (newPassword !== confirmPassword) { toast.error("Mật khẩu nhập lại không khớp"); return; }
    setSavingPassword(true);
    // Re-authenticate first
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password: currentPassword,
    });
    if (signInErr) { toast.error("Mật khẩu hiện tại không đúng"); setSavingPassword(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { toast.error("Lỗi đổi mật khẩu: " + error.message); }
    else {
      toast.success("Đổi mật khẩu thành công!");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    }
    setSavingPassword(false);
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success("Đã sao chép mã giới thiệu!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Gradient bg */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-background to-background" />
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Cài đặt hồ sơ</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 relative z-10 space-y-6">

        {/* Avatar & info */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 py-6"
        >
          <div className={`h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg ${isVip ? 'bg-gradient-to-br from-yellow-500 to-amber-600' : 'bg-primary'}`}>
            <span className="text-white">
              {(profile?.display_name || user?.email || "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="text-center">
            <p className="text-foreground font-bold text-lg">{profile?.display_name || "User"}</p>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
            {isVip ? (
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-bold text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-1 rounded-full">
                <Crown className="h-3 w-3" /> VIP — hết hạn {vipExpiresAt?.toLocaleDateString("vi-VN")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-muted-foreground bg-secondary border border-border/40 px-2.5 py-1 rounded-full">
                <Star className="h-3 w-3" /> Free
              </span>
            )}
          </div>
        </motion.div>

        {/* Balance info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card border border-border/50 rounded-xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Số dư tài khoản</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(profile?.balance ?? 0)}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/deposit")} className="text-xs">
            Nạp thêm
          </Button>
        </motion.div>

        {/* Display name */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border/50 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-foreground font-semibold">Tên hiển thị</h2>
          </div>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Nhập tên hiển thị..."
            className="bg-secondary border-border/40 text-foreground placeholder:text-muted-foreground"
          />
          <Button onClick={handleSaveName} disabled={savingName} className="w-full">
            {savingName ? "Đang lưu..." : "Lưu tên"}
          </Button>
        </motion.div>

        {/* Change password */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border/50 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-primary" />
            <h2 className="text-foreground font-semibold">Đổi mật khẩu</h2>
          </div>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Mật khẩu hiện tại"
            className="bg-secondary border-border/40 text-foreground placeholder:text-muted-foreground"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
            className="bg-secondary border-border/40 text-foreground placeholder:text-muted-foreground"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
            className="bg-secondary border-border/40 text-foreground placeholder:text-muted-foreground"
          />
          <Button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword} className="w-full">
            {savingPassword ? "Đang đổi..." : "Đổi mật khẩu"}
          </Button>
        </motion.div>

        {/* Referral code */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-primary/30 rounded-xl p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🎁</span>
            <h2 className="text-foreground font-semibold">Mã giới thiệu của bạn</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Chia sẻ mã giới thiệu (email của bạn). Khi bạn bè đăng ký dùng mã này, cả hai nhận <span className="text-primary font-semibold">+2.500đ (5 lượt xem)</span>.
          </p>
          <div className="flex items-center gap-2 bg-secondary/60 border border-border/40 rounded-lg px-4 py-3">
            <span className="text-foreground font-mono text-sm flex-1 truncate">{referralCode}</span>
            <button onClick={handleCopyReferral} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </motion.div>

        {/* Sign out */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            Đăng xuất
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
