import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

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
  const [submitting, setSubmitting] = useState(false);

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

    // Create listing
    const { data: listing, error: listingError } = await supabase
      .from("ctv_listings")
      .insert({
        ctv_user_id: userId,
        title: title.trim(),
        category,
        price: priceNum,
        description: description.trim() || null,
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
      <h2 className="text-xl font-bold text-foreground">Thêm sản phẩm</h2>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thông tin sản phẩm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
