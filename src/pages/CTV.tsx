import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, CreditCard, BarChart3, UserPlus, Package, ShieldCheck, Banknote, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const CTV = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [bankInfo, setBankInfo] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: existingRegistration, isLoading } = useQuery({
    queryKey: ["ctv-registration", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("ctv_registrations")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const handleSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!displayName.trim() || !contactInfo.trim()) {
      toast({ title: "Vui lòng điền đầy đủ thông tin bắt buộc", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Bạn cần đồng ý điều khoản CTV", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Create ctv_registrations entry
    const { error: regError } = await supabase.from("ctv_registrations").insert({
      user_id: user.id,
      display_name: displayName.trim(),
      contact_info: contactInfo.trim(),
      bank_info: bankInfo.trim() || null,
    });

    if (regError) {
      toast({ title: "Lỗi đăng ký", description: regError.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Also create ctv_profiles so they can access the dashboard immediately
    const { error: profileError } = await supabase.from("ctv_profiles").insert({
      user_id: user.id,
      display_name: displayName.trim(),
      contact_info: contactInfo.trim() || null,
      bank_name: null,
      bank_account: null,
      bank_holder: null,
    });

    setSubmitting(false);

    if (profileError) {
      // Profile may already exist, still OK
      console.warn("CTV profile insert:", profileError.message);
    }

    toast({ title: "🎉 Đăng ký CTV thành công!", description: "Bạn có thể truy cập CTV Dashboard ngay." });
    navigate("/ctv/dashboard");
  };

  const benefits = [
    { icon: <CheckCircle className="h-7 w-7 text-primary" />, title: "Miễn phí tham gia", desc: "Không phí đăng ký, không phí duy trì." },
    { icon: <CreditCard className="h-7 w-7 text-primary" />, title: "Chúng tôi xử lý thanh toán", desc: "Web lo checkout, xác nhận đơn, thông báo giao hàng." },
    { icon: <BarChart3 className="h-7 w-7 text-primary" />, title: "Có dashboard theo dõi", desc: "Theo dõi đơn hàng, doanh thu, số dư chờ duyệt & khả dụng." },
  ];

  const steps = [
    { num: "1", title: "Đăng ký CTV", desc: "Chỉ mất 1 phút" },
    { num: "2", title: "Đăng sản phẩm", desc: "Lên hệ thống dễ dàng" },
    { num: "3", title: "Duyệt nhanh", desc: "Đảm bảo chất lượng" },
    { num: "4", title: "Có đơn → Nhận tiền", desc: "Số dư chuyển khả dụng sau bảo hành" },
  ];

  const feeTable = [
    { range: "< 100k", fee: "10%" },
    { range: "100k – 300k", fee: "7%" },
    { range: "> 300k", fee: "5%" },
  ];

  const faqs = [
    { q: "Có mất phí tham gia không?", a: "Không. Miễn phí đăng ký hoàn toàn." },
    { q: "Khi nào tôi nhận được tiền?", a: 'Tiền vào "Chờ duyệt" ngay sau khi bán. Sau thời gian bảo hành sẽ vào "Khả dụng" và bạn có thể rút.' },
    { q: "Tôi đăng sản phẩm như thế nào?", a: "Vào Dashboard → Thêm sản phẩm → Gửi duyệt → Hiển thị trên shop." },
    { q: "Nếu khách khiếu nại?", a: "Đơn có thể bị hoàn, và doanh thu tương ứng sẽ bị điều chỉnh từ số dư của bạn." },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Đăng ký CTV</h1>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Banknote className="h-4 w-4" /> Hoa hồng: 5–10%/sản phẩm
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground leading-tight">
            Trở thành CTV <span className="text-primary">miễn phí</span>
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            Bán sản phẩm của bạn trên nền tảng của chúng tôi — không mất phí đăng ký.
            Chúng tôi lo thanh toán & khách hàng, bạn chỉ cần nguồn hàng.
          </p>
          <p className="text-sm text-muted-foreground">
            Phí nền tảng: <span className="text-foreground font-semibold">5–10%</span>/sản phẩm. Bạn nhận phần còn lại sau khi đơn hoàn tất.
          </p>
        </section>

        {/* Benefits */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-foreground text-center">Lợi ích khi tham gia</h3>
          <div className="grid gap-3">
            {benefits.map((b, i) => (
              <Card key={i} className="border-border/50 bg-card/60">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="shrink-0 mt-0.5">{b.icon}</div>
                  <div>
                    <p className="font-semibold text-foreground">{b.title}</p>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-foreground text-center">Cách hoạt động</h3>
          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold text-lg">
                  {s.num}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
                {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center italic">
            💡 Tiền được giữ tạm để xử lý khiếu nại/hoàn tiền, giúp cả hệ thống an toàn.
          </p>
        </section>

        {/* Fee table */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-foreground text-center">Chính sách phí nền tảng</h3>
          <Card className="border-border/50 overflow-hidden">
            <div className="grid grid-cols-2 text-sm font-semibold text-muted-foreground bg-secondary/50 px-4 py-2.5">
              <span>Đơn giá sản phẩm</span>
              <span className="text-right">Phí nền tảng</span>
            </div>
            {feeTable.map((row, i) => (
              <div key={i} className="grid grid-cols-2 px-4 py-3 border-t border-border/30 text-sm">
                <span className="text-foreground">{row.range}</span>
                <span className="text-right text-primary font-semibold">{row.fee}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* Who is this for */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-foreground text-center">Ai phù hợp?</h3>
          <div className="space-y-2">
            {[
              "Có nguồn tài khoản/sản phẩm digital",
              "Có thể cung cấp hàng đúng mô tả",
              "Muốn bán nhanh, không cần tự làm web",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Registration Form */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-foreground text-center">Đăng ký CTV</h3>

          {isLoading ? (
            <div className="text-center text-muted-foreground animate-pulse py-6">Đang kiểm tra...</div>
          ) : existingRegistration ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5 text-center space-y-2">
                <ShieldCheck className="h-10 w-10 text-primary mx-auto" />
                <p className="font-semibold text-foreground">Bạn đã đăng ký CTV!</p>
                <p className="text-sm text-muted-foreground">
                  Trạng thái: <span className="text-primary font-medium capitalize">{existingRegistration.status}</span>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tên hiển thị <span className="text-destructive">*</span></label>
                  <Input placeholder="Tên CTV của bạn" value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Telegram / Zalo liên hệ <span className="text-destructive">*</span></label>
                  <Input placeholder="@telegram hoặc SĐT Zalo" value={contactInfo} onChange={e => setContactInfo(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Ngân hàng nhận tiền <span className="text-muted-foreground text-xs">(tuỳ chọn)</span></label>
                  <Input placeholder="Tên NH – STK – Tên chủ TK" value={bankInfo} onChange={e => setBankInfo(e.target.value)} />
                </div>
                <div className="flex items-start gap-2.5 pt-1">
                  <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                  <label htmlFor="agree" className="text-sm text-muted-foreground leading-snug cursor-pointer">
                    Tôi đồng ý điều khoản CTV & chính sách kiểm duyệt/hoàn tiền
                  </label>
                </div>
                <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {submitting ? "Đang xử lý..." : "Kích hoạt CTV"}
                </Button>
                {!user && (
                  <p className="text-xs text-muted-foreground text-center">
                    Bạn cần <button onClick={() => navigate("/auth")} className="text-primary underline">đăng nhập</button> trước khi đăng ký.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* FAQ */}
        <section className="space-y-4 pb-8">
          <h3 className="text-lg font-bold text-foreground text-center">Câu hỏi thường gặp</h3>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-lg px-4 overflow-hidden">
                <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>
    </div>
  );
};

export default CTV;
