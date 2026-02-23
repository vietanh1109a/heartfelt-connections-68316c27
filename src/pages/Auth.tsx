import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, User, Gift, ArrowLeft, Loader2 } from "lucide-react";

type Step = "form" | "otp" | "forgot";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [otpCode, setOtpCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(() => {
    const stored = localStorage.getItem("otp_cooldown_until");
    if (stored) {
      const remaining = Math.ceil((parseInt(stored) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials") || msg.includes("wrong")) {
          setFormError("Email hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.");
        } else if (msg.includes("email not confirmed")) {
          setFormError("Email chưa được xác thực. Vui lòng kiểm tra hộp thư.");
        } else if (msg.includes("too many")) {
          setFormError("Quá nhiều lần thử. Vui lòng đợi vài phút rồi thử lại.");
        } else {
          setFormError(error.message);
        }
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_verified")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .single();

        if (profile && !profile.is_verified) {
          await sendOtp(email);
          setStep("otp");
        } else {
          navigate("/");
        }
      }
    } else {
      if (password !== confirmPassword) {
        setFormError("Mật khẩu nhập lại không khớp!");
        setLoading(false);
        return;
      }
      if (!displayName.trim()) {
        setFormError("Vui lòng nhập tên tài khoản!");
        setLoading(false);
        return;
      }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: displayName.trim() },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already been registered")) {
          setFormError("Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.");
        } else {
          setFormError(error.message);
        }
      } else {
        // Update display_name in case trigger already created the profile
        if (signUpData.user) {
          await supabase
            .from("profiles")
            .update({ display_name: displayName.trim() })
            .eq("user_id", signUpData.user.id);
        }
        await sendOtp(email);
        setStep("otp");
        toast.success("Mã xác thực 6 số đã được gửi tới email của bạn!");
      }
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setFormError("Không thể gửi email đặt lại mật khẩu. Vui lòng thử lại.");
    } else {
      setForgotSent(true);
      toast.success("Email đặt lại mật khẩu đã được gửi!");
    }
    setLoading(false);
  };

  const sendOtp = async (targetEmail: string) => {
    const { error } = await supabase.functions.invoke("send-otp", {
      body: { email: targetEmail },
    });
    if (error) {
      toast.error("Không thể gửi mã xác thực. Vui lòng thử lại.");
      console.error("send-otp error:", error);
    } else {
      // Persist cooldown end time in localStorage so it survives page reload
      const cooldownUntil = Date.now() + 60 * 1000;
      localStorage.setItem("otp_cooldown_until", cooldownUntil.toString());
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            localStorage.removeItem("otp_cooldown_until");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { email, code: otpCode, referralCode: referralCode.trim() || undefined },
    });

    if (error || !data?.success) {
      toast.error(data?.error || "Mã xác thực không đúng. Vui lòng thử lại.");
    } else {
      // After OTP confirms email, sign in to establish session
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        console.error("Auto sign-in after OTP failed:", signInError);
      }
      if (data.referralBonus) {
        toast.success("🎉 Xác thực thành công! Bạn nhận 15 lượt xem miễn phí (10 bonus + 5 giới thiệu). Người mời cũng nhận +5 lượt!", { duration: 6000 });
      } else {
        toast.success("🎉 Xác thực thành công! Bạn nhận được 10 lượt xem miễn phí (hạn 7 ngày)!");
      }
      navigate("/");
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    await sendOtp(email);
    toast.success("Đã gửi lại mã xác thực!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/20 via-background to-background" />

      {/* Back to home button */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </button>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-4"
      >
        <div className="text-center mb-8">
          <h1
            className="text-5xl font-bold tracking-tight text-primary"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            NETFLIX
          </h1>
          <p className="text-muted-foreground mt-2">Đăng nhập để xem Netflix miễn phí</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-foreground">
              {step === "otp" ? "Xác thực Email" : step === "forgot" ? "Quên mật khẩu" : isLogin ? "Đăng nhập" : "Đăng ký"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {step === "otp" ? (
              <div className="space-y-6">
                <div className="text-center">
                  <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                    Nhập mã 6 số đã gửi tới{" "}
                    <span className="text-foreground font-medium">{email}</span>
                  </p>
                </div>

                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} className="bg-secondary border-border text-foreground" />
                      <InputOTPSlot index={1} className="bg-secondary border-border text-foreground" />
                      <InputOTPSlot index={2} className="bg-secondary border-border text-foreground" />
                      <InputOTPSlot index={3} className="bg-secondary border-border text-foreground" />
                      <InputOTPSlot index={4} className="bg-secondary border-border text-foreground" />
                      <InputOTPSlot index={5} className="bg-secondary border-border text-foreground" />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerifyOtp}
                  className="w-full text-lg font-semibold"
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang xác thực...</> : "Xác nhận"}
                </Button>

                <div className="text-center">
                  <button
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0
                      ? <span className="text-muted-foreground">Gửi lại sau <span className="font-semibold text-foreground">{resendCooldown}s</span></span>
                      : <>Không nhận được mã? <span className="text-primary font-medium">Gửi lại</span></>
                    }
                  </button>
                </div>
              </div>
            ) : step === "forgot" ? (
              <div className="space-y-4">
                {forgotSent ? (
                  <div className="text-center py-4 space-y-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-foreground font-medium">Email đã được gửi!</p>
                    <p className="text-muted-foreground text-sm">
                      Kiểm tra hộp thư của <span className="text-foreground font-medium">{forgotEmail}</span> để đặt lại mật khẩu.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-muted-foreground text-sm text-center">
                      Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.
                    </p>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                    {formError && (
                      <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                        <span className="text-destructive text-xs mt-0.5">⚠</span>
                        <p className="text-destructive text-xs">{formError}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full font-semibold" disabled={loading}>
                      {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Đang gửi...</> : "Gửi email đặt lại mật khẩu"}
                    </Button>
                  </form>
                )}
                <div className="text-center">
                  <button
                    onClick={() => { setStep("form"); setFormError(null); setForgotSent(false); }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Quay lại đăng nhập
                  </button>
                </div>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Tên tài khoản"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
                      className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mật khẩu"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
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
                  {!isLogin && (
                    <>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nhập lại mật khẩu"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                          required
                          minLength={6}
                        />
                      </div>
                      <div className="relative">
                        <Gift className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="Email người giới thiệu (không bắt buộc)"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value)}
                          className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                        />
                      </div>
                    </>
                  )}

                  {/* Inline error message */}
                  {formError && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                      <span className="text-destructive text-xs mt-0.5">⚠</span>
                      <p className="text-destructive text-xs">{formError}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full text-lg font-semibold" disabled={loading}>
                    {loading
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isLogin ? "Đang đăng nhập..." : "Đang đăng ký..."}</>
                      : isLogin ? "Đăng nhập" : "Đăng ký"
                    }
                  </Button>
                </form>

                {isLogin && (
                  <div className="mt-3 text-center">
                    <button
                      onClick={() => { setStep("forgot"); setForgotEmail(email); setFormError(null); }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                )}

                {!isLogin && (
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    🎁 Đăng ký nhận ngay <span className="text-primary font-bold">10 lượt xem miễn phí</span>!
                  </p>
                )}

                <div className="mt-4 text-center">
                  <button
                    onClick={() => { setIsLogin(!isLogin); setFormError(null); }}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {isLogin ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                    <span className="text-primary font-medium">
                      {isLogin ? "Đăng ký ngay" : "Đăng nhập"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;

