import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ImagePlus, X, MessageCircle } from "lucide-react";

interface Props {
  userId: string;
  onSuccess: () => void;
}

export const CTVAddListing = ({ userId, onSuccess }: Props) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("account");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [credentials, setCredentials] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async () => {
    if (!title.trim() || !price) {
      toast({ title: "Vui lòng điền đầy đủ thông tin", variant: "destructive" });
      return;
    }
    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast({ title: "Giá không hợp lệ", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Upload image if provided
    let thumbnailUrl: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("ctv-images")
        .upload(filePath, imageFile);

      if (uploadError) {
        toast({ title: "Lỗi upload ảnh", description: uploadError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("ctv-images").getPublicUrl(filePath);
      thumbnailUrl = urlData.publicUrl;
    }

    // Create listing
    const { data: listing, error: listingError } = await supabase
      .from("ctv_listings")
      .insert({
        ctv_user_id: userId,
        title: title.trim(),
        category,
        price: priceNum,
        description: description.trim() || null,
        thumbnail_url: thumbnailUrl,
      })
      .select("id")
      .single();

    if (listingError || !listing) {
      toast({ title: "Lỗi tạo sản phẩm", description: listingError?.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    // Add items (credentials) if provided
    if (credentials.trim()) {
      const lines = credentials.trim().split("\n").filter(l => l.trim());
      if (lines.length > 0) {
        const items = lines.map(line => ({
          listing_id: listing.id,
          ctv_user_id: userId,
          content: line.trim(),
        }));
        const { error: itemsError } = await supabase.from("ctv_listing_items").insert(items);
        if (itemsError) {
          toast({ title: "Sản phẩm đã tạo nhưng lỗi thêm credentials", description: itemsError.message, variant: "destructive" });
        }
      }
    }

    setSubmitting(false);
    toast({ title: "🎉 Đã gửi sản phẩm để duyệt!", description: "Admin sẽ xem xét trước khi hiển thị." });
    onSuccess();
  };

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Thêm sản phẩm</h2>
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <a href="https://t.me/vietsix" target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4 mr-1" />
            Liên hệ Admin
          </a>
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thông tin sản phẩm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image upload */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Ảnh mô tả sản phẩm</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-video rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50 bg-secondary/20 flex flex-col items-center justify-center gap-2 transition-colors"
              >
                <ImagePlus className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Bấm để chọn ảnh (tối đa 5MB)</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Loại sản phẩm</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="account">Tài khoản</SelectItem>
                <SelectItem value="key">Key / License</SelectItem>
                <SelectItem value="service">Dịch vụ</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tiêu đề <span className="text-destructive">*</span></label>
            <Input placeholder="VD: Netflix Premium 1 tháng" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Giá (VNĐ) <span className="text-destructive">*</span></label>
            <Input type="number" placeholder="50000" value={price} onChange={e => setPrice(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mô tả</label>
            <Textarea placeholder="Mô tả chi tiết sản phẩm..." value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Credentials / Stock</label>
            <Textarea
              placeholder={"Mỗi dòng 1 item, VD:\nemail1@gmail.com|pass123\nemail2@gmail.com|pass456"}
              value={credentials}
              onChange={e => setCredentials(e.target.value)}
              rows={5}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">Mỗi dòng = 1 sản phẩm sẽ được cấp khi có đơn</p>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Đang gửi..." : "Gửi duyệt sản phẩm"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Sản phẩm sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin xác nhận.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
