import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Thêm sản phẩm</h2>
        <Button variant="outline" size="sm" asChild>
          <a href="https://t.me/vietsix" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 mr-1" />
            Liên hệ Admin
          </a>
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-8 ${done ? "bg-primary" : "bg-border"}`} />}
              <button
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                {s.label}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT – Form */}
        <div className="lg:col-span-3 space-y-4">
          {step === 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bước 1: Thông tin sản phẩm</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Image */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Ảnh mô tả</label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                  {imagePreview ? (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={removeImage} className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full aspect-video rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 bg-secondary/20 flex flex-col items-center justify-center gap-2 transition-colors">
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Bấm để chọn ảnh (tối đa 5MB)</span>
                    </button>
                  )}
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Danh mục <span className="text-destructive">*</span></label>
                  <Select value={category} onValueChange={(v) => { setCategory(v); if (!["game", "tool"].includes(v)) setPlatform(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Product Type */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Loại sản phẩm <span className="text-destructive">*</span></label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Warranty */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Bảo hành</label>
                    <Select value={warrantyHours} onValueChange={setWarrantyHours}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24">24 giờ</SelectItem>
                        <SelectItem value="72">3 ngày</SelectItem>
                        <SelectItem value="168">7 ngày</SelectItem>
                        <SelectItem value="720">30 ngày</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Platform - only for game/tool */}
                {showPlatformField && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Nền tảng</label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger><SelectValue placeholder="Chọn nền tảng..." /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Tiêu đề <span className="text-destructive">*</span></label>
                  <Input placeholder="VD: Netflix Premium 1 tháng" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Giá bán (VNĐ) <span className="text-destructive">*</span></label>
                  <Input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} min={1000} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Mô tả</label>
                  <Textarea placeholder="Mô tả chi tiết sản phẩm..." value={description} onChange={e => setDescription(e.target.value)} rows={3} maxLength={500} />
                </div>

                <Button className="w-full" onClick={() => setStep(1)} disabled={!canGoStep1}>
                  Tiếp tục → Nhập stock
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bước 2: Nhập stock / credentials</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Credentials</label>
                    <span className={`text-xs font-medium ${credLines.length > MAX_ITEMS ? "text-destructive" : "text-muted-foreground"}`}>
                      {credLines.length}/{MAX_ITEMS} tài khoản
                    </span>
                  </div>
                  <Textarea
                    placeholder={"Mỗi dòng 1 item theo format:\nemail1@gmail.com|pass123\nemail2@gmail.com|pass456"}
                    value={credentials}
                    onChange={e => setCredentials(e.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />

                  {credLines.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {invalidLines.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 space-y-1">
                          <p className="text-xs font-medium text-destructive flex items-center gap-1">
                            <X className="h-3.5 w-3.5" /> {invalidLines.length} dòng sai format (cần dạng: nội_dung|mật_khẩu)
                          </p>
                          {invalidLines.slice(0, 3).map(l => (
                            <p key={l.index} className="text-xs text-destructive/80 font-mono pl-5">
                              Dòng {l.index + 1}: {l.line.substring(0, 40)}
                            </p>
                          ))}
                        </div>
                      )}
                      {invalidLines.length === 0 && (
                        <p className="text-xs text-primary flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> Tất cả {credLines.length} tài khoản hợp lệ
                        </p>
                      )}
                      {credLines.length > MAX_ITEMS && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> Tối đa {MAX_ITEMS} tài khoản mỗi lần
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-accent/50 border border-border/50 space-y-1.5">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    Không đăng tài khoản đã chết hoặc không hoạt động
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                    Tài khoản lỗi nhiều sẽ bị khóa quyền CTV
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(0)} className="flex-1">← Quay lại</Button>
                  <Button onClick={() => setStep(2)} disabled={!canGoStep2} className="flex-1">Tiếp → Xác nhận</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Bước 3: Xác nhận & gửi duyệt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-secondary/50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tiêu đề:</span><span className="font-medium text-foreground">{title}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Danh mục:</span><span className="text-foreground">{getCategoryLabel(category)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Loại:</span><span className="text-foreground">{getTypeLabel(productType)}</span></div>
                  {platform && <div className="flex justify-between"><span className="text-muted-foreground">Nền tảng:</span><span className="text-foreground">{PLATFORMS.find(p => p.value === platform)?.label ?? platform}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Giá bán:</span><span className="text-foreground">{priceNum.toLocaleString("vi-VN")}đ</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Bảo hành:</span><span className="text-foreground">{warrantyHours === "24" ? "24 giờ" : warrantyHours === "72" ? "3 ngày" : warrantyHours === "168" ? "7 ngày" : "30 ngày"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Stock:</span><span className="text-foreground">{credLines.length} tài khoản</span></div>
                  <div className="h-px bg-border my-1" />
                  <div className="flex justify-between"><span className="text-muted-foreground">Phí nền tảng ({(feeRate * 100).toFixed(0)}%):</span><span className="text-destructive">-{feeAmount.toLocaleString("vi-VN")}đ</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-foreground">Bạn nhận:</span><span className="text-primary">{earning.toLocaleString("vi-VN")}đ/sản phẩm</span></div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                  <span className="text-sm text-foreground leading-relaxed">
                    Tôi cam kết sản phẩm còn hoạt động và chịu trách nhiệm nếu có khiếu nại từ người mua.
                  </span>
                </label>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)} className="flex-1">← Quay lại</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="flex-1">
                    {submitting ? "Đang gửi..." : "Gửi duyệt sản phẩm"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Sản phẩm sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin xác nhận.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT – Preview + Tips */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50 sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Preview sản phẩm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {imagePreview ? (
                <div className="aspect-video rounded-lg overflow-hidden bg-secondary/30">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-video rounded-lg bg-secondary/30 flex items-center justify-center">
                  <ImagePlus className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <h3 className="font-semibold text-foreground truncate">{title || "Tiêu đề sản phẩm"}</h3>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{getCategoryLabel(category)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{getTypeLabel(productType)}</span>
                {platform && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">{PLATFORMS.find(p => p.value === platform)?.label ?? platform}</span>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{description || "Mô tả sản phẩm sẽ hiển thị ở đây..."}</p>

              <div className="rounded-lg bg-secondary/50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Giá bán:</span>
                  <span className="font-semibold text-foreground">{priceNum > 0 ? `${priceNum.toLocaleString("vi-VN")}đ` : "—"}</span>
                </div>
                {priceNum > 0 && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Phí nền tảng ({(feeRate * 100).toFixed(0)}%):</span>
                      <span className="text-destructive">-{feeAmount.toLocaleString("vi-VN")}đ</span>
                    </div>
                    <div className="h-px bg-border" />
                    <div className="flex justify-between font-semibold">
                      <span className="text-muted-foreground">Bạn nhận:</span>
                      <span className="text-primary">{earning.toLocaleString("vi-VN")}đ</span>
                    </div>
                  </>
                )}
              </div>

              {credLines.length > 0 && (
                <p className="text-xs text-muted-foreground">📦 Stock: {credLines.length} tài khoản</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5 text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-yellow-500" /> Tips bán nhanh
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                "Đặt giá cạnh tranh so với thị trường",
                "Mô tả rõ ràng, chi tiết sản phẩm",
                "Thêm ảnh mô tả để tăng uy tín",
                "Bảo hành dài hơn = bán nhanh hơn",
                "Chọn đúng danh mục và loại sản phẩm",
              ].map((tip, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span> {tip}
                </p>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
