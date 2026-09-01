import { describe, expect, it } from "vitest";
import {
  normalizeKey,
  parseOrderDate,
  parsePaymentDate,
  toCents,
} from "../normalize";

describe("toCents", () => {
  it("converts a plain decimal string to integer cents", () => {
    expect(toCents("119.84")).toBe(11984);
  });

  it("avoids float drift that plagues naive multiplication", () => {
    // 119.84 * 100 in raw JS float math is 11984.000000000002 — this must
    // come out exact.
    expect(toCents("119.84")).toBe(11984);
    expect(toCents("210.0")).toBe(21000);
    expect(toCents("209.99")).toBe(20999);
    expect(toCents("210.0")! - toCents("209.99")!).toBe(1);
  });

  it("handles negative amounts", () => {
    expect(toCents("-18.50")).toBe(-1850);
  });

  it("handles whole numbers with no decimal point", () => {
    expect(toCents("175")).toBe(17500);
  });

  it("returns null for empty or missing values", () => {
    expect(toCents("")).toBeNull();
    expect(toCents("   ")).toBeNull();
    expect(toCents(null)).toBeNull();
    expect(toCents(undefined)).toBeNull();
  });
});

describe("normalizeKey", () => {
  it("trims and uppercases", () => {
    expect(normalizeKey(" ord-1801 ")).toBe("ORD-1801");
    expect(normalizeKey("ord-1802")).toBe("ORD-1802");
    expect(normalizeKey("ORD-1802")).toBe("ORD-1802");
  });
});

describe("parseOrderDate", () => {
  it("parses ISO 'YYYY-MM-DD HH:MM:SS' as UTC", () => {
    const date = parseOrderDate("2025-04-13 00:00:00");
    expect(date.toISOString()).toBe("2025-04-13T00:00:00.000Z");
  });
});

describe("parsePaymentDate", () => {
  it("parses day-first DD/MM/YYYY, not month-first", () => {
    // 21/04/2025 is unambiguous proof the format is day-first: no month 21
    // exists, so a month-first parser would throw or silently misread it.
    const date = parsePaymentDate("21/04/2025 22:05");
    expect(date?.getUTCFullYear()).toBe(2025);
    expect(date?.getUTCMonth()).toBe(3); // April, 0-indexed
    expect(date?.getUTCDate()).toBe(21);
    expect(date?.getUTCHours()).toBe(22);
    expect(date?.getUTCMinutes()).toBe(5);
  });

  it("never falls back to Date's month-first assumption", () => {
    // If this were parsed month-first, 13/04/2025 would be invalid (no
    // 13th month) and either throw from Date or produce Invalid Date. Our
    // parser must read it as day=13, month=04.
    const date = parsePaymentDate("13/04/2025 00:30");
    expect(date?.getUTCDate()).toBe(13);
    expect(date?.getUTCMonth()).toBe(3);
  });

  it("returns null for empty processed_at", () => {
    expect(parsePaymentDate(null)).toBeNull();
    expect(parsePaymentDate("")).toBeNull();
  });
});
