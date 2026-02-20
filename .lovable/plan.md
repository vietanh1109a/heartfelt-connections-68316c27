
# Báo cáo Kiểm tra End-to-End — Netflix Sharing Platform

## Tóm tắt

Sau khi đọc toàn bộ codebase (frontend, edge functions, hooks, modals), dưới đây là danh sách đầy đủ các **bug thực sự**, **điểm bất hợp lý** và **cơ hội cải tiến** được tìm thấy.

---

## 1. BUG THỰC SỰ (cần sửa ngay)

### Bug #1 — Hàm `handleWatch` bị nhân đôi (CRITICAL)
**File:** `src/pages/Index.tsx` (dòng 53–115) và `src/pages/index/WatchSection.tsx` (dòng 41–106)

Cả hai file đều định nghĩa một hàm `handleWatch` giống hệt nhau, cả hai đều gọi `supabase`, `trySendCookie`, `checkExtensionAlive`, `deduct-balance`. Khi user click "Xem Netflix" trên WatchSection (không phải VIP), nó gọi `onShowWatchModal()` (mở Watch Modal trên Index.tsx). Watch Modal đó khi confirm lại gọi `handleWatch()` của Index.tsx. Điều này gây ra:
- Logic trùng lặp, dễ bị lỗi không đồng bộ khi cập nhật một bên.
- `WatchSection.handleWatch` chỉ được dùng khi user là VIP (click thẳng), nhưng lại là code trùng.

### Bug #2 — Mã bonus hiển thị sai trong Auth (LOGIC ERROR)
**File:** `src/pages/Auth.tsx` dòng 161–163

```
toast.success("🎉 Xác thực thành công! Bạn và người giới thiệu mỗi người nhận +$5 bonus!")
toast.success("🎉 Xác thực thành công! Bạn nhận được $10 miễn phí!")
```

Trong `verify-otp/index.ts`, `SIGNUP_BONUS = 5000` (= 10 lượt xem × 500đ), `REFERRAL_BONUS = 2500` (= 5 lượt). Nhưng thông báo dùng `$5` và `$10` (kiểu USD) — trong khi hệ thống dùng đơn vị **đồng (đ)**, nên phải là `5.000đ` và `10.000đ`. Người dùng sẽ bị nhầm lẫn.

### Bug #3 — Lỗi 404 `get_netflix_stock_by_plan` (ACTIVE BUG)
**Từ Network Requests:** RPC function `get_netflix_stock_by_plan` trả về 404. File `src/pages/index/PlanSelector.tsx` dòng 47 gọi `supabase.rpc("get_netflix_stock_by_plan")` nhưng function này chưa tồn tại trong database. Hậu quả: tất cả các gói Netflix hiển thị stock = 0 (Hết hàng), user không mua được.

### Bug #4 — `purchase-vip` dùng ký hiệu `$` thay vì `đ`
**File:** `supabase/functions/purchase-vip/index.ts` dòng 58

```
error: `Số dư không đủ. Cần $${plan.price}, bạn có $${effectiveBalance}.`
```

Toàn bộ hệ thống dùng đơn vị VND (đ), nhưng error message này lại dùng `$`. Tương tự trong `purchase-plan/index.ts` dòng 57.

### Bug #5 — Không có route `/reset-password`
**File:** `src/pages/Auth.tsx` dòng 113

```
redirectTo: `${window.location.origin}/reset-password`,
```

Function "Quên mật khẩu" redirect user về `/reset-password`, nhưng route này **không tồn tại** trong `src/App.tsx`. User sẽ thấy trang 404 sau khi click link reset password từ email.

### Bug #6 — Race condition trong `deduct-balance` error recovery
**File:** `supabase/functions/deduct-balance/index.ts` dòng 121–128

Khi có lỗi, function tạo thêm một `adminFallback` client mới (2 lần gọi `Deno.env.get`) chỉ để lấy `allowed_origin` cho CORS header trong error response. Điều này vừa tốn tài nguyên vừa có thể throw thêm lỗi nếu env không khả dụng.

### Bug #7 — `SESSION_STORAGE_KEY` tên biến không khớp
**File:** `src/pages/index/DepositModal.tsx` dòng 20

```
const SESSION_STORAGE_KEY = "deposit_session_v1";
```

Tên là `SESSION_STORAGE_KEY` nhưng thực ra lưu vào `localStorage` (không phải sessionStorage). Khi tab đóng, session vẫn còn tồn tại — đây là hành vi **cố ý** nhưng tên biến gây nhầm lẫn.

---

## 2. ĐIỂM BẤT HỢP LÝ (UX/Logic)

### Bất hợp lý #1 — "Báo hỏng" vẫn yêu cầu `extensionVersion` để kiểm tra cookie
**File:** `src/pages/index/IndexModals.tsx` dòng 316–323

Khi extension không được cài, toàn bộ cookie bị coi là "dead" và swap hết. Nhưng thực tế có thể cookie vẫn hoạt động. Đây là hành vi chấp nhận được nhưng cần có thông báo rõ ràng hơn: "Không có extension để kiểm tra, sẽ đổi toàn bộ."

### Bất hợp lý #2 — Referral code là email, không phải code ngắn
**File:** `supabase/functions/verify-otp/index.ts` dòng 115–116

```
const referralEmail = referralCode.trim().toLowerCase();
```

Mã giới thiệu thực chất là email của người giới thiệu, nhưng UI hiển thị "Mã giới thiệu" — không rõ ràng với user. Nên đổi placeholder thành "Email của người giới thiệu".

### Bất hợp lý #3 — Watch Modal hiện ra không cần thiết cho VIP
**File:** `src/pages/index/WatchSection.tsx` dòng 120

```
onClick={() => isVip ? handleWatch() : onShowWatchModal()}
```

VIP user click thẳng không qua modal — đúng. Nhưng Free user phải qua thêm 1 bước modal chỉ để chọn "Free" hay "VIP". UX thừa bước.

### Bất hợp lý #4 — Số dư trong DepositModal hiển thị bonus + permanent chung
**File:** `src/pages/index/DepositModal.tsx` dòng 206

```
const balance = (profile?.balance ?? 0) + (profile?.bonus_balance ?? 0);
```

Hiển thị tổng số dư (bao gồm bonus sắp hết hạn) có thể mislead user về số tiền thật. Nên tách rõ "Số dư: X + Bonus: Y (hết hạn ngày Z)".

### Bất hợp lý #5 — GuestView và Index load cùng lúc gây flicker
**File:** `src/pages/Index.tsx` — không có `GuestView` render rõ ràng

`Index.tsx` không tách biệt rõ guest vs logged-in tại điểm render chính. `isLoading` state trả về loading spinner, sau đó render full page với profile null — có thể gây flicker trước khi `SidePanel` hiển thị đúng.

### Bất hợp lý #6 — "Contact Support" button trỏ `href="#"`
**File:** `src/pages/index/WatchSection.tsx` dòng 129

```
onClick={() => window.open("#", "_blank")}
```

Nút này không hoạt động, trỏ về `#`. Nên dùng link support từ `useAppSettings` như các nơi khác trong codebase.

### Bất hợp lý #7 — VIP plan hiện thị theo ngày thay vì tháng
**File:** `src/pages/index/IndexModals.tsx` dòng 203

```
<span className="text-muted-foreground text-xs ml-1">/{plan.duration_days} ngày</span>
```

Gói VIP 1 tháng (30 ngày), 3 tháng (90 ngày) nên hiển thị "1 tháng", "3 tháng" thay vì "30 ngày", "90 ngày". Nhưng đối với "VIP Vĩnh viễn" (36333 ngày) thì sẽ hiển thị "36333 ngày" — rất xấu.

### Bất hợp lý #8 — Không có loading skeleton cho PlanSelector
**File:** `src/pages/index/PlanSelector.tsx`

Khi `plans` chưa load, không hiển thị gì cả (button vẫn hiện ra). Nên có skeleton hoặc loading state.

---

## 3. CẢI TIẾN ĐỀ XUẤT

### Cải tiến #1 — Thêm route `/reset-password` (FIX BUG #5 trước)
Cần tạo trang reset password để link từ email hoạt động.

### Cải tiến #2 — Tạo DB function `get_netflix_stock_by_plan` (FIX BUG #3)
Tạo SQL function trả về số lượng tài khoản còn trống theo `plan_id`.

### Cải tiến #3 — Hiển thị VIP plan duration thông minh
Thay vì hiển thị `N ngày`, tính toán hiển thị "1 tháng", "3 tháng", "Vĩnh viễn".

### Cải tiến #4 — Sửa đơn vị tiền tệ trong thông báo (FIX BUG #2, #4)
Đồng bộ toàn bộ thông báo dùng `đ` và `toLocaleString("vi-VN")`.

### Cải tiến #5 — Thêm "Copy referral link" trên Profile
Hiện tại người dùng không biết cách chia sẻ referral. Thêm nút copy email/link giới thiệu.

### Cải tiến #6 — Tách biệt số dư thật và bonus trong UI
Hiển thị rõ ràng: `Số dư: 50.000đ` + `Bonus (còn 3 ngày): 5.000đ`.

### Cải tiến #7 — Thêm realtime subscription cho deposit status
Thay vì polling mỗi 4 giây, dùng Supabase Realtime để lắng nghe thay đổi `deposits` table — giảm tải server và phản hồi nhanh hơn.

### Cải tiến #8 — Thêm confirm dialog khi đổi tài khoản không qua extension
Khi không có extension, toàn bộ cookie sẽ bị đổi mà không kiểm tra. Cần dialog xác nhận rõ ràng hơn thay vì chỉ hiển thị trong UI nhỏ.

---

## Kế hoạch sửa (theo thứ tự ưu tiên)

### Ưu tiên cao — Fix ngay:

**Bước 1 — Tạo SQL function `get_netflix_stock_by_plan`** (migration mới)
```sql
CREATE OR REPLACE FUNCTION get_netflix_stock_by_plan()
RETURNS TABLE(plan_id uuid, count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT plan_id, COUNT(*) as count
  FROM netflix_accounts
  WHERE is_assigned = false
  GROUP BY plan_id;
$$;
```

**Bước 2 — Tạo route `/reset-password`**
- Tạo `src/pages/ResetPassword.tsx` — form nhập mật khẩu mới
- Dùng `supabase.auth.updateUser({ password })` sau khi Supabase validate token từ URL
- Thêm vào `src/App.tsx`

**Bước 3 — Sửa đơn vị tiền tệ**
- `Auth.tsx`: Sửa `+$5 bonus` → `+2.500đ (5 lượt xem)`, `$10 miễn phí` → `5.000đ (10 lượt xem)`
- `purchase-vip/index.ts` và `purchase-plan/index.ts`: Sửa `$${plan.price}` → `${plan.price.toLocaleString("vi-VN")}đ`

**Bước 4 — Sửa VIP plan duration display**
- `IndexModals.tsx`: Thêm helper format duration: nếu >= 3650 ngày → "Vĩnh viễn", nếu chia hết 30 → "X tháng"

**Bước 5 — Sửa "Contact Support" button**
- `WatchSection.tsx`: Dùng `useAppSettings().linkSupport` thay vì `window.open("#", "_blank")`

### Ưu tiên trung bình:

**Bước 6 — Tách logic handleWatch**
- Giữ 1 implementation duy nhất trong `Index.tsx`, truyền hàm xuống WatchSection

**Bước 7 — Thêm skeleton loading cho PlanSelector**

**Bước 8 — Sửa tên biến SESSION_STORAGE_KEY**

**Bước 9 — Placeholder referral input**
- Đổi `placeholder="Mã giới thiệu (không bắt buộc)"` → `placeholder="Email người giới thiệu (không bắt buộc)"`

### Ưu tiên thấp (cải tiến thêm):

**Bước 10 — Hiển thị breakdown số dư (bonus vs permanent)**

**Bước 11 — Realtime deposit thay vì polling**

**Bước 12 — Copy referral link trên Profile page**
