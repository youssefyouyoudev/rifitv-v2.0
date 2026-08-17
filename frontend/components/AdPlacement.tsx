"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadPlacementAd } from "@/lib/ads/AdManager";
import { AD_SETTINGS, type AdPlacementName } from "@/lib/ads/config";
import { detectAdDevice, routeForPath } from "@/lib/ads/device";
import { trackEvent } from "@/lib/analytics";

export function AdPlacement({ name }: { name: AdPlacementName }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) {
      return;
    }

    let cancelled = false;
    const device = detectAdDevice();
    const route = routeForPath(pathname);

    void loadPlacementAd(name, route, device).then((result) => {
      if (cancelled) {
        return;
      }

      setVisible(result.loaded);
      if (result.loaded) {
        trackEvent("ad_impression", {
          ad_zone: result.zone?.id,
          ad_placement: name,
          ad_format: result.zone?.format,
          device_category: device,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [name, pathname]);

  if (!AD_SETTINGS.enabled || !AD_SETTINGS.normalEnabled) {
    return null;
  }

  return (
    <aside
      aria-label="Advertisement"
      data-ad-placement={name}
      data-ad-visible={visible ? "true" : "false"}
      className="ad-slot rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-center text-xs uppercase tracking-normal text-[var(--muted)]"
    >
      <span>{visible ? "Advertisement" : "Ads help support RiFiTV"}</span>
    </aside>
  );
}
