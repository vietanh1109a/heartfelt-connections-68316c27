import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Plus, Edit, Eye, EyeOff, Trash2, Upload, ShoppingCart } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  note: string | null;
  category: string;
  price: number;
  original_price: number | null;
  thumbnail_url: string | null;
  is_active: boolean;
  sold_count: number;
  created_at: string;
  stock_count?: number;
}

function fmtVnd(amount: number) {
  return amount.toLocaleString("vi-VN") + "đ";
}

export function ProductsTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showStockDialog, setShowStockDialog] = useState<Product | null>(null);
  const [stockInput, setStockInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formCategory, setFormCategory] = useState("product");
  const [formPrice, setFormPrice] = useState("");
  const [formOriginalPrice, setFormOriginalPrice] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get stock counts
      const ids = (data ?? []).map((p: any) => p.id);
      if (ids.length > 0) {
        const { data: stockData } = await supabase
          .from("product_items")
          .select("product_id, is_sold")
          .in("product_id", ids);

        const stockMap: Record<string, number> = {};
        (stockData ?? []).forEach((s: any) => {
          if (!s.is_sold) stockMap[s.product_id] = (stockMap[s.product_id] || 0) + 1;
        });
        return (data ?? []).map((p: any) => ({ ...p, stock_count: stockMap[p.id] || 0 }));
      }
      return (data ?? []).map((p: any) => ({ ...p, stock_count: 0 }));
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormNote("");
    setFormCategory("product");
    setFormPrice("");
    setFormOriginalPrice("");
    setFormThumbnail("");
    setEditProduct(null);
  };

  const openEditForm = (p: Product) => {
    setFormName(p.name);
    setFormDescription(p.description || "");
    setFormNote(p.note || "");
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormOriginalPrice(p.original_price ? String(p.original_price) : "");
    setFormThumbnail(p.thumbnail_url || "");
    setEditProduct(p);
    setShowForm(true);
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        toast.error("Lỗi upload ảnh: " + error.message);
        return;
      }
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setFormThumbnail(data.publicUrl);
      toast.success("Upload ảnh thành công!");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice) {
      toast.error("Vui lòng nhập tên và giá sản phẩm");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        note: formNote.trim() || null,
        category: formCategory,
        price: parseInt(formPrice),
        original_price: formOriginalPrice ? parseInt(formOriginalPrice) : null,
        thumbnail_url: formThumbnail || null,
      };

      if (editProduct) {
        const { error } = await supabase.from("products").update(payload).eq("id", editProduct.id);
        if (error) throw error;
        toast.success("Đã cập nhật sản phẩm!");
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
        toast.success("Đã tạo sản phẩm!");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) {
      toast.error("Lỗi: " + error.message);
      return;
    }
    toast.success(p.is_active ? "Đã ẩn sản phẩm" : "Đã hiện sản phẩm");
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const handleAddStock = async () => {
    if (!showStockDialog || !stockInput.trim()) return;
    const lines = stockInput.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      toast.error("Vui lòng nhập ít nhất 1 item");
      return;
    }
    setSaving(true);
    try {
      const items = lines.map((content) => ({
        product_id: showStockDialog.id,
        content: content.trim(),
      }));
      const { error } = await supabase.from("product_items").insert(items);
      if (error) throw error;
      toast.success(`Đã thêm ${lines.length} item vào kho!`);
      setStockInput("");
      setShowStockDialog(null);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-foreground font-bold text-lg">Quản lý sản phẩm</h2>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Thêm sản phẩm
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Đang tải...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Chưa có sản phẩm nào</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground">
                <th className="text-left py-3 px-2">Ảnh</th>
                <th className="text-left py-3 px-2">Tên</th>
                <th className="text-left py-3 px-2">Loại</th>
                <th className="text-right py-3 px-2">Giá</th>
                <th className="text-right py-3 px-2">Tồn kho</th>
                <th className="text-right py-3 px-2">Đã bán</th>
                <th className="text-center py-3 px-2">Trạng thái</th>
                <th className="text-right py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-border/20 hover:bg-secondary/20">
                  <td className="py-2 px-2">
                    <div className="h-10 w-10 rounded-lg bg-secondary/30 overflow-hidden">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-foreground font-medium max-w-[200px] truncate">{p.name}</td>
                  <td className="py-2 px-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.category === "game_key" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"}`}>
                      {p.category === "game_key" ? "Game Key" : "Sản phẩm"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right text-primary font-semibold">{fmtVnd(p.price)}</td>
                  <td className="py-2 px-2 text-right">
                    <span className={p.stock_count! > 0 ? "text-green-400" : "text-destructive"}>{p.stock_count}</span>
                  </td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{p.sold_count}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(p)} title="Sửa">
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(p)} title={p.is_active ? "Ẩn" : "Hiện"}>
                        {p.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowStockDialog(p); setStockInput(""); }} title="Thêm kho">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Product Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-md bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editProduct ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Tên sản phẩm *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="VD: Netflix Premium 1 tháng" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Loại</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Sản phẩm</SelectItem>
                  <SelectItem value="game_key">Game Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Giá bán (VNĐ) *</label>
              <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="100000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Giá gốc (VNĐ) – để trống nếu không giảm giá</label>
              <Input type="number" value={formOriginalPrice} onChange={(e) => setFormOriginalPrice(e.target.value)} placeholder="150000" className="mt-1" />
              {formOriginalPrice && formPrice && parseInt(formOriginalPrice) > parseInt(formPrice) && (
                <p className="text-xs text-green-400 mt-1">
                  Tiết kiệm {Math.round((1 - parseInt(formPrice) / parseInt(formOriginalPrice)) * 100)}%
                </p>
              )}
              <Input type="number" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} placeholder="10000" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Ghi chú ngắn</label>
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="VD: Giao ngay, bảo hành 30 ngày" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mô tả chi tiết</label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Mô tả sản phẩm..." className="mt-1" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Ảnh thumbnail</label>
              <div className="mt-1 space-y-2">
                {formThumbnail && (
                  <div className="rounded-lg overflow-hidden aspect-video bg-secondary/30 max-h-32">
                    <img src={formThumbnail} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={formThumbnail}
                    onChange={(e) => setFormThumbnail(e.target.value)}
                    placeholder="URL ảnh hoặc upload bên dưới"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 shrink-0"
                    disabled={uploading}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleUploadImage(file);
                      };
                      input.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "..." : "Upload"}
                  </Button>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? "Đang lưu..." : editProduct ? "Cập nhật" : "Tạo sản phẩm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Stock Dialog */}
      <Dialog open={!!showStockDialog} onOpenChange={() => setShowStockDialog(null)}>
        <DialogContent className="max-w-md bg-card border-border/40">
          {showStockDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">Thêm kho: {showStockDialog.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Nhập mỗi item một dòng (key, code, tài khoản...). Mỗi dòng = 1 sản phẩm trong kho.
                </p>
                <Textarea
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder={"XXXXX-XXXXX-XXXXX\nYYYYY-YYYYY-YYYYY\nZZZZZ-ZZZZZ-ZZZZZ"}
                  rows={8}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {stockInput.trim() ? `${stockInput.trim().split("\n").filter(Boolean).length} items` : "0 items"}
                </p>
                <Button className="w-full" onClick={handleAddStock} disabled={saving}>
                  {saving ? "Đang thêm..." : "Thêm vào kho"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
