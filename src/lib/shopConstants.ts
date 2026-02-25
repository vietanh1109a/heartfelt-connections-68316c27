// ─── Shop Category / Type / Platform constants ───

export const CATEGORIES = [
  { value: "netflix", label: "Netflix" },
  { value: "game", label: "Game" },
  { value: "tool", label: "Tool / Phần mềm" },
  { value: "social", label: "Mạng xã hội" },
  { value: "entertainment", label: "Giải trí" },
  { value: "education", label: "Giáo dục" },
  { value: "other", label: "Khác" },
] as const;

export const PRODUCT_TYPES = [
  { value: "account", label: "Tài khoản" },
  { value: "key", label: "Key / License" },
  { value: "voucher", label: "Voucher / Code" },
  { value: "file", label: "File / Tài liệu" },
  { value: "service", label: "Dịch vụ" },
] as const;

export const PLATFORMS = [
  { value: "steam", label: "Steam" },
  { value: "playstation", label: "PlayStation" },
  { value: "xbox", label: "Xbox" },
  { value: "epic", label: "Epic Games" },
  { value: "origin", label: "EA / Origin" },
  { value: "ubisoft", label: "Ubisoft" },
  { value: "gog", label: "GOG" },
  { value: "nintendo", label: "Nintendo" },
  { value: "mobile", label: "Mobile" },
  { value: "windows", label: "Windows" },
  { value: "macos", label: "macOS" },
  { value: "cross", label: "Đa nền tảng" },
  { value: "other", label: "Khác" },
] as const;

export const getCategoryLabel = (value: string) =>
  CATEGORIES.find((c) => c.value === value)?.label ?? value;

export const getTypeLabel = (value: string) =>
  PRODUCT_TYPES.find((t) => t.value === value)?.label ?? value;

export const getPlatformLabel = (value: string) =>
  PLATFORMS.find((p) => p.value === value)?.label ?? value;
