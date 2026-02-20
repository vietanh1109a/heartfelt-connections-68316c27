
## Sửa text đăng ký bonus trên trang Auth

### Thay đổi cần làm

Chỉ cần sửa 1 dòng trong file `src/pages/Auth.tsx` tại dòng 406:

**Từ:**
```
🎁 Đăng ký nhận ngay <span className="text-primary font-bold">10.000đ miễn phí</span>!
```

**Thành:**
```
🎁 Đăng ký nhận ngay <span className="text-primary font-bold">10 lượt xem miễn phí</span>!
```

### File cần chỉnh sửa
- `src/pages/Auth.tsx` — dòng 406
