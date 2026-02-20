import { describe, it, expect } from "vitest";
import { compareVersions } from "@/hooks/useIndexData";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("returns positive when v1 > v2", () => {
    expect(compareVersions("2.1.0", "2.0.0")).toBeGreaterThan(0);
    expect(compareVersions("3.0.0", "2.9.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0.1", "2.0.0")).toBeGreaterThan(0);
  });

  it("returns negative when v1 < v2", () => {
    expect(compareVersions("1.9.9", "2.0.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "2.0.1")).toBeLessThan(0);
  });

  it("handles missing patch version (treats as 0)", () => {
    expect(compareVersions("2.0", "2.0.0")).toBe(0);
    expect(compareVersions("2.1", "2.0.9")).toBeGreaterThan(0);
  });

  it("correctly flags old extension as outdated against MIN_EXTENSION_VERSION (2.0.0)", () => {
    const MIN = "2.0.0";
    expect(compareVersions("1.9.9", MIN)).toBeLessThan(0); // outdated
    expect(compareVersions("2.0.0", MIN)).toBe(0);          // ok
    expect(compareVersions("2.0.1", MIN)).toBeGreaterThan(0); // newer, ok
  });
});
