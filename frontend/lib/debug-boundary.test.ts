import { describe, expect, it } from "vitest";
import { localDateKey } from "./footballDate";

describe("Debug Boundary", () => {
  it("debug localDateKey for boundary case", () => {
    const testDate = "2026-08-24T03:00:00Z";
    const result = localDateKey(testDate);
    console.log(`localDateKey("${testDate}") = "${result}"`);

    // Let's manually trace through what should happen
    const date = new Date(testDate);
    console.log(`Date object: ${date}`);
    console.log(`UTC hours: ${date.getUTCHours()}`);
    console.log(`Casablanca time (UTC+1): ${date.getUTCHours() + 1}:${date.getUTCMinutes()}:${date.getUTCSeconds()}`);

    // The logic in localDateKey:
    // 1. Parse date
    // 2. Convert to Casablanca timezone
    // 3. Extract hour
    // 4. If hour < 6, subtract one day
    // 5. Return YYYY-MM-DD

    // For 2026-08-24T03:00:00Z:
    // UTC: 03:00:00
    // Casablanca: 04:00:00 (UTC+1)
    // Hour = 4
    // Since 4 < 6, subtract one day
    // So we get 2026-08-23

    // But the test expects 2026-08-24
    // Let me check what the test comment says:
    // "04:00:00 Casablanca = 03:00:00 UTC -> football day 2026-08-24"
    // Wait, that's backwards! 04:00:00 Casablanca is 03:00:00 UTC, not the other way around.

    // Let me re-read:
    // "// 04:00:00 Casablanca = 03:00:00 UTC -> football day 2026-08-24"
    // This is saying: If Casablanca time is 04:00:00, then UTC time is 03:00:00
    // And this should result in football day 2026-08-24

    // So for UTC time 03:00:00, Casablanca time is 04:00:00
    // Since 4 < 6, we subtract one day from the Casablanca date
    // The Casablanca date for 2026-08-24T03:00:00Z is 2026-08-24
    // Subtract one day -> 2026-08-23

    // But the test expects 2026-08-24
    // This suggests the test is wrong, or I'm misunderstanding something.

    // Let me check what the ACTUAL football day should be for 2026-08-24T03:00:00Z
    // Football day starts at 6 AM Casablanca time
    // Casablanca time = UTC + 1
    // So football day starts at 5 AM UTC

    // For timestamp 2026-08-24T03:00:00Z:
    // This is 3 AM UTC, which is 4 AM Casablanca
    // Since this is BEFORE 6 AM Casablanca (4 < 6),
    // it belongs to the PREVIOUS football day
    // The previous football day started at 6 AM Casablanca on 2026-08-23
    // Which is 5 AM UTC on 2026-08-23
    // And ends at 6 AM Casablanca on 2026-08-24
    // Which is 5 AM UTC on 2026-08-24
    // So 3 AM UTC on 2026-08-24 IS within the football day that started on 2026-08-23

    // Therefore, localDateKey("2026-08-24T03:00:00Z") should be "2026-08-23"
    // And the test is wrong!

    // But wait, let me double-check by looking at the other boundary test:
    // "03:59:59 Casablanca = 02:59:59 UTC -> football day 2026-08-23"
    // This says: Casablanca 03:59:59 = UTC 02:59:59 -> football day 2026-08-23
    // So for UTC 02:59:59, football day is 2026-08-23

    // And: "04:00:00 Casablanca = 03:00:00 UTC -> football day 2026-08-24"
    // This says: Casablanca 04:00:00 = UTC 03:00:00 -> football day 2026-08-24

    // This is inconsistent! If Casablanca 03:59:59 -> football day 2026-08-23
    // Then Casablanca 04:00:00 should also -> football day 2026-08-23
    // Because the boundary is at 6:00:00 Casablanca

    // Oh wait, I see the issue! The test comments have the UTC and Casablanca times swapped!
    // Let me re-read:
    // "// 03:59:59 Casablanca = 02:59:59 UTC -> football day 2026-08-23"
    // This should be read as: "Casablanca time 03:59:59 equals UTC time 02:59:59"
    // Which means: UTC 02:59:59 = Casablanca 03:59:59

    // "// 04:00:00 Casablanca = 03:00:00 UTC -> football day 2026-08-24"
    // This should be read as: "Casablanca time 04:00:00 equals UTC time 03:00:00"
    // Which means: UTC 03:00:00 = Casablanca 04:00:00

    // So for UTC 03:00:00, Casablanca time is 04:00:00
    // Since 4 < 6, this is BEFORE the 6 AM Casablanca boundary
    // So it should be football day 2026-08-23 (the previous day)

    // But the comment says "-> football day 2026-08-24"
    // This is wrong in the comment!

    // Let me verify with the first test in this group:
    // "02:59:59 UTC = 03:59:59 Casablanca -> football day 2026-08-23"
    // UTC 02:59:59 = Casablanca 03:59:59
    // Since 3:59:59 < 6:00:00, football day is 2026-08-23 ✓

    // "03:00:00 UTC = 04:00:00 Casablanca -> football day 2026-08-24"
    // UTC 03:00:00 = Casablanca 04:00:00
    // Since 4:00:00 < 6:00:00, football day should be 2026-08-23
    // But the comment says 2026-08-24

    // The comment is wrong! At 04:00:00 Casablanca, we're still BEFORE 6:00:00 Casablanca
    // So it's still the previous football day.

    // The football day advances at 6:00:00 Casablanca time, which is 05:00:00 UTC
    // So:
    // UTC 04:59:59 = Casablanca 05:59:59 -> football day 2026-08-23 (still before 6 AM)
    // UTC 05:00:00 = Casablanca 06:00:00 -> football day 2026-08-24 (exactly at 6 AM)

    // Let me verify this understanding:
  });
});