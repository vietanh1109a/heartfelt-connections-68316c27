import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, X, MessageCircle, Check, AlertTriangle, Lightbulb, ShieldCheck, Package, ListChecks, Send } from "lucide-react";
import { CATEGORIES, PRODUCT_TYPES, PLATFORMS } from "@/lib/shopConstants";

interface Props {
  userId: string;
  onSuccess: () => void;
}

const STEPS = [
  { label: "Thông tin", icon: Package },
  { label: "Stock", icon: ListChecks },
  { label: "Xác nhận", icon: Send },
];

const MAX_ITEMS = 50;

function calcFee(price: number) {
  if (price < 100000) return 0.10;
  if (price <= 300000) return 0.07;
  return 0.05;
}

function validateLine(line: string) {
  return line.includes("|") && line.split("|").length >= 2 && line.split("|")[0].trim().length > 0;
}

export const CTVAddListing = ({ userId, onSuccess }: Props) => {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("netflix");
  const [productType, setProductType] = useState("account");
  const [platform, setPlatform] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [warrantyHours, setWarrantyHours] = useState("24");
  const [credentials, setCredentials] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const priceNum = parseInt(price) || 0;
  const feeRate = calcFee(priceNum);
  const feeAmount = Math.round(priceNum * feeRate);
  const earning = priceNum - feeAmount;

  const credLines = useMemo(() => {
    if (!credentials.trim()) return [];
    return credentials.trim().split("\n").filter(l => l.trim());
  }, [credentials]);

  const invalidLines = useMemo(() => {
    return credLines.map((line, i) => ({ index: i, line, valid: validateLine(line) })).filter(l => !l.valid);
  }, [credLines]);

  const progressPct = useMemo(() => {
    let score = 0;
    if (title.trim()) score += 15;
    if (priceNum > 0) score += 15;
    if (description.trim()) score += 10;
    if (imageFile) score += 10;
    if (credLines.length > 0) score += 20;
    if (invalidLines.length === 0 && credLines.length > 0) score += 10;
    if (agreed) score += 20;
    return Math.min(score, 100);
  }, [title, priceNum, description, imageFile, credLines, invalidLines, agreed]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Ảnh tối đa 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const canGoStep1 = title.trim().length > 0 && priceNum > 0;
  const canGoStep2 = credLines.length > 0 && credLines.length <= MAX_ITEMS && invalidLines.length === 0;
  const canSubmit = agreed;

  const showPlatformField = ["game", "tool"].includes(category);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    let thumbnailUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("ctv-images").upload(filePath, imageFile);
      if (uploadError) {
        toast({ title: "Lỗi upload ảnh", description: uploadError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("ctv-images").getPublicUrl(filePath);
      thumbnailUrl = urlData.publicUrl;
    }

    const { data: listing, error: listingError } = await (supabase as any)
      .from("ctv_listings")
      .insert({
        ctv_user_id: userId,
        title: title.trim(),
        category,
        product_type: productType,
        platform: platform || null,
        price: priceNum,
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl,
        warranty_hours: parseInt(warrantyHours),
      })
      .select("id")
      .single();

    if (listingError || !listing) {
      toast({ title: "Lỗi tạo sản phẩm", description: listingError?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    const items = credLines.map(line => ({
      listing_id: listing.id,
      ctv_user_id: userId,
      content: line.trim(),
    }));
    const { error: itemsError } = await supabase.from("ctv_listing_items").insert(items);
    if (itemsError) {
      toast({ title: "Sản phẩm đã tạo nhưng lỗi thêm stock", description: itemsError.message, variant: "destructive" });
    }

    setSubmitting(false);
    toast({ title: "🎉 Đã gửi sản phẩm để duyệt!", description: "Admin sẽ xác nhận trong vòng 24h." });
    onSuccess();
  };

  const getCategoryLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label ?? val;
  const getTypeLabel = (val: string) => PRODUCT_TYPES.find(t => t.value === val)?.label ?? val;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Thêm sản phẩm</h2>
        <Button variant="outline" size="sm" className="rounded-xl text-xs" asChild>
          <a href="https://t.me/vietsix" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5 mr-1" /> Hỗ trợ
          </a>
        </Button>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground uppercase tracking-wider font-medium">Hoàn thành hồ sơ</span>
          <span className="text-primary font-bold">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <div className={`h-px w-5 ${done ? "bg-primary" : "bg-border"}`} />}
              <button
                onClick={() => { if (i < step) setStep(i); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary" : "bg-accent text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                {s.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* 60/40 layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* LEFT – Form */}
        <div className="lg:col-span-3 space-y-3">
          {step === 0 && (
            <Card className="ctv-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bước 1: Thông tin</h3>

                {/* Image - compact */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Ảnh mô tả</label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  {imagePreview ? (
                    <div className="relative w-full max-h-[160px] rounded-xl overflow-hidden border border-border/30 bg-accent/30">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover max-h-[160px]" />
                      <button onClick={removeImage} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full h-[100px] rounded-xl border-2 border-dashed border-border/30 hover:border-primary/30 bg-accent/20 flex flex-col items-center justify-center gap-1 transition-colors">
                      <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Tối đa 5MB</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Tiêu đề <span className="text-destructive">*</span></label>
                  <Input placeholder="VD: Netflix Premium 1 tháng" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} className="h-9 rounded-xl" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Danh mục</label>
                    <Select value={category} onValueChange={(v) => { setCategory(v); if (!["game", "tool"].includes(v)) setPlatform(""); }}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Loại SP</label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Giá bán (VNĐ) <span className="text-destructive">*</span></label>
                    <Input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} min={1000} className="h-9 rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Bảo hành</label>
                    <Select value={warrantyHours} onValueChange={setWarrantyHours}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 giờ</SelectItem>
                        <SelectItem value="72">3 ngày</SelectItem>
                        <SelectItem value="168">7 ngày</SelectItem>
                        <SelectItem value="720">30 ngày</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showPlatformField && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Nền tảng</label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Chọn..." /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Mô tả</label>
                  <Textarea placeholder="Mô tả chi tiết..." value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={500} className="rounded-xl" />
                </div>

                <Button className="w-full h-9 rounded-xl" onClick={() => setStep(1)} disabled={!canGoStep1}>
                  Tiếp tục → Nhập stock
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="ctv-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bước 2: Stock</h3>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Credentials</label>
                    <span className={`text-[10px] font-medium ${credLines.length > MAX_ITEMS ? "text-destructive" : "text-muted-foreground"}`}>
                      {credLines.length}/{MAX_ITEMS}
                    </span>
                  </div>
                  <Textarea
                    placeholder={"email1@gmail.com|pass123\nemail2@gmail.com|pass456"}
                    value={credentials}
                    onChange={e => setCredentials(e.target.value)}
                    rows={6}
                    className="font-mono text-xs rounded-xl"
                  />

                  {credLines.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {invalidLines.length > 0 ? (
                        <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 space-y-0.5">
                          <p className="text-[10px] font-medium text-destructive flex items-center gap-1">
                            <X className="h-3 w-3" /> {invalidLines.length} dòng sai format
                          </p>
                          {invalidLines.slice(0, 3).map(l => (
                            <p key={l.index} className="text-[10px] text-destructive/80 font-mono pl-4">
                              Dòng {l.index + 1}: {l.line.substring(0, 40)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-green-400 flex items-center gap-1">
                          <Check className="h-3 w-3" /> {credLines.length} tài khoản hợp lệ
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2.5 rounded-xl bg-accent/50 border border-border/30 space-y-1">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500 shrink-0" />
                    Không đăng tài khoản đã chết
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-yellow-500 shrink-0" />
                    Lỗi nhiều sẽ bị khóa quyền CTV
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1 h-9 rounded-xl" size="sm">← Quay lại</Button>
                  <Button onClick={() => setStep(2)} disabled={!canGoStep2} className="flex-1 h-9 rounded-xl" size="sm">Tiếp → Xác nhận</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="ctv-card">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bước 3: Xác nhận</h3>
                <div className="rounded-xl bg-accent/50 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tiêu đề:</span><span className="font-medium text-foreground">{title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Danh mục:</span><span className="text-foreground">{getCategoryLabel(category)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loại:</span><span className="text-foreground">{getTypeLabel(productType)}</span></div>
                  {platform && <div className="flex justify-between"><span className="text-muted-foreground">Nền tảng:</span><span className="text-foreground">{PLATFORMS.find(p => p.value === platform)?.label ?? platform}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Giá bán:</span><span className="text-foreground">{priceNum.toLocaleString("vi-VN")}đ</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bảo hành:</span><span className="text-foreground">{warrantyHours === "24" ? "24 giờ" : warrantyHours === "72" ? "3 ngày" : warrantyHours === "168" ? "7 ngày" : "30 ngày"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock:</span><span className="text-foreground">{credLines.length} tài khoản</span></div>
                  <div className="h-px bg-border/30 my-1" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Phí ({(feeRate * 100).toFixed(0)}%):</span><span className="text-destructive">-{feeAmount.toLocaleString("vi-VN")}đ</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-foreground">Bạn nhận:</span><span className="text-primary">{earning.toLocaleString("vi-VN")}đ/sp</span></div>
                </div>

                <label className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/30 bg-accent/20 cursor-pointer hover:bg-accent/40 transition-colors">
                  <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                  <span className="text-xs text-foreground leading-relaxed">
                    Tôi cam kết sản phẩm còn hoạt động và chịu trách nhiệm nếu có khiếu nại.
                  </span>
                </label>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-9 rounded-xl" size="sm">← Quay lại</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="flex-1 h-9 rounded-xl ctv-glow-btn" size="sm">
                    {submitting ? "Đang gửi..." : "Gửi duyệt"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT – Preview + Tips */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="ctv-card sticky top-4">
            <CardContent className="p-4 space-y-2.5">
              <h3 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Preview</h3>
              {imagePreview ? (
                <div className="h-[120px] rounded-xl overflow-hidden bg-accent/30">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="h-[80px] rounded-xl bg-accent/30 flex items-center justify-center">
                  <ImagePlus className="h-5 w-5 text-muted-foreground/20" />
                </div>
              )}
              <h3 className="font-semibold text-foreground text-sm truncate">{title || "Tiêu đề sản phẩm"}</h3>
              <div className="flex flex-wrap gap-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{getCategoryLabel(category)}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{getTypeLabel(productType)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{description || "Mô tả..."}</p>

              <div className="rounded-xl bg-accent/40 p-2.5 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá:</span>
                  <span className="font-semibold text-foreground">{priceNum > 0 ? `${priceNum.toLocaleString("vi-VN")}đ` : "—"}</span>
                </div>
                {priceNum > 0 && (
                  <>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Phí ({(feeRate * 100).toFixed(0)}%):</span>
                      <span className="text-destructive">-{feeAmount.toLocaleString("vi-VN")}đ</span>
                    </div>
                    <div className="h-px bg-border/30" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted-foreground">Nhận:</span>
                      <span className="text-primary">{earning.toLocaleString("vi-VN")}đ</span>
                    </div>
                  </>
                )}
              </div>
              {credLines.length > 0 && (
                <p className="text-[10px] text-muted-foreground">📦 Stock: {credLines.length}</p>
              )}
            </CardContent>
          </Card>

          <Card className="ctv-card bg-accent/30">
            <CardContent className="p-3.5">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-400" /> Tips
              </h3>
              <ul className="space-y-1">
                {[
                  "Giá cạnh tranh → bán nhanh hơn",
                  "Mô tả rõ ràng, thêm ảnh minh họa",
                  "Bảo hành dài hơn = uy tín cao hơn",
                  "Chọn đúng danh mục & loại SP",
                ].map((tip, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                    <span className="text-yellow-400 mt-0.5 text-[8px]">●</span> {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
