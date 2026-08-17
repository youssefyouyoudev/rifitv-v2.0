import { describe, expect, it } from "vitest";
import { addDays, localDateKey } from "./footballDate";

describe("RiFiTV football dates", () => {
  it("uses the Casablanca 06:00 football-day boundary", () => {
    expect(localDateKey("2026-08-17T04:59:59Z")).toBe("2026-08-16");
    expect(localDateKey("2026-08-17T05:00:00Z")).toBe("2026-08-17");
  });

  it("adds calendar days without browser timezone drift", () => {
    expect(addDays("2026-08-17", -1)).toBe("2026-08-16");
    expect(addDays("2026-08-17", 1)).toBe("2026-08-18");
  });
});
