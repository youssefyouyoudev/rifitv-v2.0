import { describe, expect, it } from "vitest";
import { absoluteUrl } from "@/lib/site";
import { sitemapLastModified } from "./sitemap";

describe("SEO sitemap and canonical helpers", () => {
  it("does not emit future sitemap lastmod values", () => {
    const now = new Date("2026-08-22T12:00:00Z");

    expect(sitemapLastModified("2026-08-23", now).toISOString()).toBe(now.toISOString());
    expect(sitemapLastModified("2026-08-23T18:00:00Z", now).toISOString()).toBe(now.toISOString());
    expect(sitemapLastModified("2026-08-21T18:00:00Z", now).toISOString()).toBe("2026-08-21T18:00:00.000Z");
  });

  it("uses the non-www production canonical host by default", () => {
    expect(absoluteUrl("/match/example")).toBe("https://rifitv.com/match/example");
  });
});
