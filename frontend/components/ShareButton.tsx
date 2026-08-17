"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function share(): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        trackEvent("match_shared", { share_method: "native", match_url: url });
        return;
      }

      if (!navigator.clipboard) {
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackEvent("match_shared", { share_method: "clipboard", match_url: url });
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      return;
    }
  }

  return (
    <button
      type="button"
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-semibold text-[var(--foreground)] outline-none hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      onClick={() => void share()}
      aria-label={copied ? "Match link copied" : "Share match"}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
