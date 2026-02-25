

## Cập nhật Cookie Stock Tab

### Vấn đề hiện tại
- Dữ liệu cookie được phân trang (30/trang), nên các nút Export Live, Check All, Clear Die chỉ hoạt động trên trang đang xem, không phải toàn bộ.
- Chưa có nút "Clear All" để xóa tất cả cookie.

### Thay đổi

**File: `src/pages/admin/components/CookieStockTab.tsx`**

1. **Thêm nút "Clear All"**: Xóa toàn bộ cookie trong bảng `cookie_stock` (có dialog xác nhận để tránh xóa nhầm).

2. **Sửa "Export Live"**: Thay vì dùng biến `cookies` (chỉ chứa trang hiện tại), sẽ query trực tiếp Supabase lấy tất cả cookie có `is_active = true` rồi xuất ZIP.

3. **Sửa "Check All"**: Tương tự, query tất cả cookie active từ Supabase thay vì chỉ dùng dữ liệu trang hiện tại, rồi gửi batch check qua extension.

### Chi tiết kỹ thuật

- `handleClearAll`: Gọi `supabase.from("cookie_stock").delete().neq("id", "")` (xóa tất cả), có dialog confirm trước khi thực hiện.
- `handleExportLive`: Fetch tất cả cookie active bằng query không phân trang: `supabase.from("cookie_stock").select("*").eq("is_active", true)`, sau đó tạo ZIP.
- `handleCheckAll`: Fetch tất cả cookie active không phân trang, rồi gửi batch `CHECK_LIVE_BATCH` qua `postMessage`.
- Thêm state `clearAllConfirm` cho dialog xác nhận Clear All.
- Nút Clear All sẽ có style destructive, đặt cạnh nút Clear Die.

