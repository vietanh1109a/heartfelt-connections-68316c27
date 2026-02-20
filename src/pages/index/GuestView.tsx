import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Crown, CheckCircle2, ShoppingBag, Tv2, LogIn, UserPlus, Zap, Shield, Clock } from "lucide-react";

const features = [
  { icon: <Tv2 className="h-5 w-5 text-primary" />, title: "Xem trên mọi thiết bị", desc: "PC, TV, điện thoại — xem Netflix mọi lúc mọi nơi." },
  { icon: <Zap className="h-5 w-5 text-yellow-400" />, title: "Kích hoạt tức thì", desc: "Chỉ 500đ/lượt, không cần đăng ký gói dài hạn." },
  { icon: <Shield className="h-5 w-5 text-green-400" />, title: "Tài khoản riêng tư", desc: "Tài khoản Netflix Premium được cấp riêng cho bạn." },
  { icon: <Clock className="h-5 w-5 text-blue-400" />, title: "Người mới 10 lượt miễn phí", desc: "Đăng ký ngay để nhận 10 lượt xem miễn phí." },
];

const plans = [
  { name: "Free", price: "500đ", per: "/lượt xem", color: "border-border/40 bg-card/60", badge: null, features: ["2 tài khoản Netflix cố định", "1 lượt đổi/tháng", "Xem kèm quảng cáo ngắn", "10 lượt xem miễn phí cho người mới"] },
  { name: "VIP", price: "từ 50,000đ", per: "/tháng", color: "border-yellow-500/50 bg-gradient-to-br from-yellow-500/10 to-card/60", badge: "HOT", features: ["5 tài khoản Premium riêng", "Không quảng cáo", "Ưu tiên tốc độ cao", "2 lượt đổi tài khoản/tháng"] },
];

const GuestView = memo(() => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-background to-background" />
        <div className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full bg-primary/[0.05] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/[0.03] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <Play className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-black text-lg text-foreground tracking-tight">Netflix<span className="text-primary">Share</span></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border/50 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Đăng nhập
            </button>
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
            >
              <UserPlus className="h-4 w-4" />
              Đăng ký miễn phí
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-14 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
              <span className="text-primary text-xs font-bold">🎬 Xem Netflix Premium</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-foreground leading-tight mb-4">
              Xem Netflix<br />
              <span className="text-primary">chỉ từ 500đ</span> mỗi lượt
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              Tài khoản Netflix Premium được cấp riêng. Không cần đăng ký dài hạn, không chia sẻ mật khẩu.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] shadow-lg shadow-primary/30"
                style={{ background: "linear-gradient(135deg, #E50914, #B20710)" }}
              >
                <UserPlus className="h-5 w-5" />
                Bắt đầu miễn phí — 10 lượt xem
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium text-sm border border-border/50 text-foreground hover:bg-secondary/60 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Tôi đã có tài khoản
              </button>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section className="max-w-5xl mx-auto px-4 pb-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="border border-border/40 rounded-xl p-4 bg-card/50 backdrop-blur-sm"
              >
                <div className="mb-3">{f.icon}</div>
                <h3 className="font-bold text-sm text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Plans preview */}
        <section className="max-w-5xl mx-auto px-4 pb-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground">Chọn gói phù hợp</h2>
            <p className="text-muted-foreground text-sm mt-1">Linh hoạt — chỉ trả khi bạn xem</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className={`relative rounded-2xl border p-6 flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-5">
                    <span className="bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Crown className="h-3 w-3" /> {plan.badge}
                    </span>
                  </div>
                )}
                <h3 className={`font-bold text-xl mb-1 ${plan.name === "VIP" ? "flex items-center gap-2" : ""}`}>
                  {plan.name}
                  {plan.name === "VIP" && <Crown className="h-5 w-5 text-yellow-400" />}
                </h3>
                <div className="mb-4">
                  <span className={`text-3xl font-extrabold ${plan.name === "VIP" ? "text-yellow-400" : "text-green-400"}`}>{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">{plan.per}</span>
                </div>
                <div className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f, fi) => (
                    <div key={fi} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${plan.name === "VIP" ? "text-yellow-400" : "text-green-400"}`} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/auth")}
                  className={`w-full rounded-xl py-3 font-bold text-sm transition-all hover:opacity-90 active:scale-[0.97] ${
                    plan.name === "VIP"
                      ? "bg-yellow-400 text-black hover:bg-yellow-300"
                      : "text-primary-foreground"
                  }`}
                  style={plan.name !== "VIP" ? { background: "linear-gradient(135deg, #E50914, #B20710)" } : {}}
                >
                  {plan.name === "VIP" ? "Nâng cấp VIP ngay" : "Đăng ký nhận 10 lượt miễn phí"}
                </button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Netflix Plans teaser */}
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="border border-border/40 rounded-2xl p-6 bg-card/50 text-center">
            <ShoppingBag className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-foreground mb-2">Hoặc mua gói Netflix chính chủ</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Tài khoản Netflix Premium 1–12 tháng với đầy đủ tính năng, nhiều profile riêng tư.
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="px-6 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-foreground hover:bg-secondary/60 transition-colors"
            >
              Xem các gói →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
});

GuestView.displayName = "GuestView";
export default GuestView;
