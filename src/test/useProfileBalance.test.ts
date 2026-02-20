import { describe, it, expect } from "vitest";

// Pure logic extracted from useProfile hook for testability

interface RawProfile {
  balance: number;
  bonus_balance: number | null;
  bonus_expires_at: string | null;
}

function computeEffectiveBalance(profile: RawProfile): {
  effectiveBalance: number;
  bonusBalance: number;
  bonusActive: boolean;
} {
  const bonusActive =
    !!profile.bonus_expires_at &&
    new Date(profile.bonus_expires_at) > new Date();
  const bonusBalance = bonusActive ? (profile.bonus_balance ?? 0) : 0;
  const effectiveBalance = (profile.balance ?? 0) + bonusBalance;
  return { effectiveBalance, bonusBalance, bonusActive };
}

describe("computeEffectiveBalance", () => {
  it("adds bonus to balance when bonus is active", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeEffectiveBalance({
      balance: 10000,
      bonus_balance: 5000,
      bonus_expires_at: future,
    });
    expect(result.effectiveBalance).toBe(15000);
    expect(result.bonusActive).toBe(true);
    expect(result.bonusBalance).toBe(5000);
  });

  it("excludes bonus when it has expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const result = computeEffectiveBalance({
      balance: 10000,
      bonus_balance: 5000,
      bonus_expires_at: past,
    });
    expect(result.effectiveBalance).toBe(10000);
    expect(result.bonusActive).toBe(false);
    expect(result.bonusBalance).toBe(0);
  });

  it("handles null bonus_expires_at (no bonus ever granted)", () => {
    const result = computeEffectiveBalance({
      balance: 8000,
      bonus_balance: null,
      bonus_expires_at: null,
    });
    expect(result.effectiveBalance).toBe(8000);
    expect(result.bonusActive).toBe(false);
  });

  it("handles zero balance with active bonus", () => {
    const future = new Date(Date.now() + 1000).toISOString();
    const result = computeEffectiveBalance({
      balance: 0,
      bonus_balance: 5000,
      bonus_expires_at: future,
    });
    expect(result.effectiveBalance).toBe(5000);
  });

  it("signup bonus scenario: new user gets 5000đ bonus for 7 days", () => {
    const SIGNUP_BONUS = 5000;
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = computeEffectiveBalance({
      balance: 0,
      bonus_balance: SIGNUP_BONUS,
      bonus_expires_at: future,
    });
    expect(result.effectiveBalance).toBe(5000);
    expect(result.bonusActive).toBe(true);
    // User can watch 5000/500 = 10 times
    expect(Math.floor(result.effectiveBalance / 500)).toBe(10);
  });
});
