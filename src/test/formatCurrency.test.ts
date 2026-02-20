import { describe, it, expect } from "vitest";
import { formatCurrency, formatViews } from "@/lib/formatCurrency";

describe("formatCurrency", () => {
  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("0đ");
  });

  it("formats thousands with period separator (vi-VN)", () => {
    expect(formatCurrency(5000)).toBe("5.000đ");
    expect(formatCurrency(10000)).toBe("10.000đ");
    expect(formatCurrency(100000)).toBe("100.000đ");
  });

  it("formats signup bonus amount", () => {
    // SIGNUP_BONUS = 5000 in verify-otp
    expect(formatCurrency(5000)).toBe("5.000đ");
  });

  it("formats referral bonus amount", () => {
    // REFERRAL_BONUS = 2500 in verify-otp
    expect(formatCurrency(2500)).toBe("2.500đ");
  });

  it("formats large amounts", () => {
    expect(formatCurrency(1000000)).toBe("1.000.000đ");
  });
});

describe("formatViews", () => {
  it("converts 5000đ to 10 views", () => {
    expect(formatViews(5000)).toBe("10 lượt xem");
  });

  it("converts 2500đ to 5 views", () => {
    expect(formatViews(2500)).toBe("5 lượt xem");
  });

  it("handles 0đ", () => {
    expect(formatViews(0)).toBe("0 lượt xem");
  });

  it("floors partial views", () => {
    expect(formatViews(750)).toBe("1 lượt xem"); // 750/500 = 1.5 → floor 1
  });
});
