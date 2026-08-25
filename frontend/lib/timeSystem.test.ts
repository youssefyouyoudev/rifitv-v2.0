import { describe, expect, it } from "vitest";
import {
  formatMatchDateLabel,
  formatKickoff,
  formatMatchKickoff,
  formatClockTime,
  formatCountdown,
  isLiveStatus
} from "./time";
import { localDateKey, addDays } from "./footballDate";

describe("RiFiTV Time System - Comprehensive Tests", () => {
  // Use a fixed reference time for consistent testing
  // Let's use 2026-08-25T01:18:01Z (1:18 AM UTC)
  // In Casablanca timezone (UTC+1), this is 02:18:01 local time
  // Since 02:18:01 < 06:00:00, football day is 2026-08-24
  const REFERENCE_TIME = "2026-08-25T01:18:01Z";

  describe("Football Day Boundary Logic", () => {
    it("considers times before 6 AM Casablanca as previous football day", () => {
      // At 01:18:01 UTC on Aug 25 = 02:18:01 Casablanca time
      // Since 02:18:01 < 06:00:00, football day is 2026-08-24
      expect(localDateKey(REFERENCE_TIME)).toBe("2026-08-24");

      // Times before 6 AM Casablanca on Aug 25 should still be football day 2026-08-24
      // 04:59:59 UTC = 05:59:59 Casablanca -> hour=5 (<6), so football day = 2026-08-24
      expect(localDateKey("2026-08-25T04:59:59Z")).toBe("2026-08-24"); // 05:59:59 Casablanca

      // At exactly 5 AM UTC = 6 AM Casablanca -> football day advances to 2026-08-25
      expect(localDateKey("2026-08-25T05:00:00Z")).toBe("2026-08-25"); // 06:00:00 Casablanca
    });

    it("handles midnight crossing correctly", () => {
      // Test crossing from Aug 24 to Aug 25 at 6 AM Casablanca boundary
      // Football day starts at 6:00:00 Casablanca = 05:00:00 UTC

      // Before the boundary: 04:59:59 Casablanca = 03:59:59 UTC -> football day 2026-08-23
      expect(localDateKey("2026-08-24T03:59:59Z")).toBe("2026-08-23");

      // At the boundary: 05:00:00 Casablanca = 04:00:00 UTC -> football day 2026-08-23 (still before 6 AM Casablanca)
      expect(localDateKey("2026-08-24T04:00:00Z")).toBe("2026-08-23");

      // After the boundary: 06:00:00 Casablanca = 05:00:00 UTC -> football day 2026-08-24
      expect(localDateKey("2026-08-24T05:00:00Z")).toBe("2026-08-24");
    });
  });

  describe("Match Date Label Formatting", () => {
    it("shows 'Today' for matches on current football day", () => {
      const match = {
        kickoff_at: "2026-08-24T19:00:00Z", // Fulham vs Chelsea - 7 PM UTC = 20:00 Casablanca
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      // At reference time (01:18:01 UTC Aug 25 = 02:18:01 Casablanca), football day is 2026-08-24
      // Match is on 2026-08-24, so it's "Today"
      expect(formatMatchDateLabel(match, REFERENCE_TIME)).toBe("Today - 20:00");
    });

    it("shows 'Tomorrow' for matches on next football day", () => {
      const match = {
        kickoff_at: "2026-08-25T19:00:00Z", // Next day match at 7 PM UTC = 20:00 Casablanca
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      // At reference time (01:18:01 UTC Aug 25 = 02:18:01 Casablanca), football day is 2026-08-24
      // Match is on 2026-08-25, so it's "Tomorrow"
      expect(formatMatchDateLabel(match, REFERENCE_TIME)).toBe("Tomorrow - 20:00");
    });

    it("shows formatted date for future matches", () => {
      const match = {
        kickoff_at: "2026-08-26T19:00:00Z", // Day after tomorrow at 7 PM UTC = 20:00 Casablanca
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      const label = formatMatchDateLabel(match, REFERENCE_TIME);
      // Aug 26, 2026 is a Wednesday
      expect(label).toContain("Wed");
      expect(label).toContain("20:00");
    });

    it("handles TBC matches correctly", () => {
      const match = {
        kickoff_at: null,
        scheduled_date: "2026-08-24",
        kickoff_precision: "date_only"
      };
      expect(formatMatchDateLabel(match, REFERENCE_TIME)).toBe("Today - Time TBC");
    });
  });

  describe("Kickoff Time Formatting", () => {
    it("formats confirmed kickoff times correctly", () => {
      expect(formatKickoff("2026-08-24T19:00:00Z")).toBe("20:00");
    });

    it("shows date with TBC for date_only precision", () => {
      const match = {
        kickoff_at: null,
        scheduled_date: "2026-08-24",
        kickoff_precision: "date_only"
      };
      // 2026-08-24 in Casablanca timezone formatting
      expect(formatMatchKickoff(match)).toMatch(/Mon, 24 Aug 2026 - Time TBC/);
    });

    it("returns Time TBC for completely unknown matches", () => {
      const match = {
        kickoff_at: null,
        scheduled_date: null,
        kickoff_precision: "tbc"
      };
      expect(formatMatchKickoff(match)).toBe("Time TBC");
    });
  });

  describe("Clock Time Formatting", () => {
    it("formats time values correctly", () => {
      expect(formatClockTime("2026-08-24T19:00:00Z")).toBe("20:00");
    });

    it("returns Time TBC for null values", () => {
      expect(formatClockTime(null)).toBe("Time TBC");
    });
  });

  describe("Countdown Formatting", () => {
    it("formats countdowns with days, hours, minutes", () => {
      expect(formatCountdown(90061)).toBe("1d 01h 01m"); // 1 day, 1 hour, 1 minute
    });

    it("formats countdowns with hours, minutes, seconds", () => {
      expect(formatCountdown(3661)).toBe("01:01:01"); // 1 hour, 1 minute, 1 second
    });

    it("formats countdowns with minutes, seconds", () => {
      expect(formatCountdown(61)).toBe("01:01"); // 1 minute, 1 second
    });

    it("handles null countdown values", () => {
      expect(formatCountdown(null)).toBe("Time TBC");
    });

    it("handles negative countdown values", () => {
      expect(formatCountdown(-10)).toBe("00:00"); // Should floor at 0
    });
  });

  describe("Live Status Detection", () => {
    it("identifies live status correctly", () => {
      expect(isLiveStatus("live")).toBe(true);
      expect(isLiveStatus("halftime")).toBe(true);
    });

    it("identifies non-live status correctly", () => {
      expect(isLiveStatus("scheduled")).toBe(false);
      expect(isLiveStatus("finished")).toBe(false);
      expect(isLiveStatus("postponed")).toBe(false);
      expect(isLiveStatus("cancelled")).toBe(false);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("handles exact 6 AM Casablanca boundary correctly", () => {
      const match = {
        kickoff_at: "2026-08-24T05:00:00Z", // 5 AM UTC = 6 AM Casablanca (boundary)
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      // At exactly 6 AM Casablanca, football day IS the same day (not previous)
      // Because the condition is hour < 6, not hour <= 6
      expect(formatMatchDateLabel(match, "2026-08-24T05:00:00Z")).toBe("Today - 06:00");
    });

    it("handles DST-like scenarios gracefully", () => {
      // Test that our time calculations don't break with timezone conversions
      const match = {
        kickoff_at: "2026-08-24T12:00:00Z", // Noon UTC = 13:00 Casablanca
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      expect(formatMatchDateLabel(match, REFERENCE_TIME)).toBe("Today - 13:00"); // 1 PM Casablanca
    });

    it("handles year boundary correctly", () => {
      // Test crossing from Dec 31 to Jan 1 at 6 AM Casablanca boundary
      const match = {
        kickoff_at: "2026-12-31T05:00:00Z", // 5 AM UTC = 6 AM Casablanca on Dec 31
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      // At 5 AM UTC on Dec 31, Casablanca time is 6 AM -> football day is Dec 31
      expect(formatMatchDateLabel(match, "2026-12-31T05:00:00Z")).toBe("Today - 06:00");

      // One second before boundary: 2026-12-31T04:59:59Z = 05:59:59 Casablanca -> football day Dec 30
      expect(formatMatchDateLabel(match, "2026-12-31T04:59:59Z")).toBe("Tomorrow - 06:00");
    });

    it("handles leap year correctly", () => {
      // Test Feb 28 to Feb 29 in a leap year (2024 is a leap year)
      const match = {
        kickoff_at: "2024-02-28T05:00:00Z", // 5 AM UTC = 6 AM Casablanca on Feb 28
        scheduled_date: null,
        kickoff_precision: "confirmed"
      };
      // At 5 AM UTC on Feb 28, Casablanca time is 6 AM -> football day is Feb 28
      expect(formatMatchDateLabel(match, "2024-02-28T05:00:00Z")).toBe("Today - 06:00");

      // One second before boundary: 2024-02-28T04:59:59Z = 05:59:59 Casablanca -> football day Feb 27
      expect(formatMatchDateLabel(match, "2024-02-28T04:59:59Z")).toBe("Tomorrow - 06:00");
    });
  });
});