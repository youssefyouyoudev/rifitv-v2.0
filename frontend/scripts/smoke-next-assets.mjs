#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const pages = (process.env.SMOKE_PAGES || "/,/admin").split(",").map((page) => page.trim()).filter(Boolean);
const longCachePattern = /(?:^|,\s*)max-age=(?:[3-9]\d{2,}|\d{4,})/i;
const transientStatuses = new Set([502, 503, 504]);
const retryDelaysMs = [500, 1000, 1500];

const failures = [];

for (const page of pages) {
  const pageUrl = new URL(page, `${baseUrl}/`);
  const response = await fetchWithTransientRetry(pageUrl);

  if (!response.ok) {
    failures.push(`${pageUrl.href} returned HTTP ${response.status}`);
    continue;
  }

  const contentType = response.headers.get("content-type") || "";
  const cacheControl = response.headers.get("cache-control") || "";

  if (!contentType.includes("text/html")) {
    failures.push(`${pageUrl.href} returned non-HTML content-type: ${contentType || "missing"}`);
  }

  if (longCachePattern.test(cacheControl) || /immutable/i.test(cacheControl)) {
    failures.push(`${pageUrl.href} has long-lived HTML cache-control: ${cacheControl}`);
  }

  const html = await response.text();
  const assets = referencedAssets(html, pageUrl);

  if (assets.length === 0) {
    failures.push(`${pageUrl.href} referenced no Next.js JS/CSS assets`);
  }

  for (const assetUrl of assets) {
    await verifyAsset(assetUrl);
  }
}

if (failures.length > 0) {
  console.error("Next asset smoke test failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Next asset smoke test passed for ${pages.join(", ")}`);

function referencedAssets(html, pageUrl) {
  const urls = new Set();
  const attributePattern = /\b(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
  let match;

  while ((match = attributePattern.exec(html)) !== null) {
    const rawUrl = match[1].replaceAll("&amp;", "&");

    if (!rawUrl.includes("/_next/static/")) {
      continue;
    }

    urls.add(new URL(rawUrl, pageUrl).href);
  }

  return [...urls].sort();
}

async function verifyAsset(assetUrl) {
  const response = await fetchWithTransientRetry(assetUrl);
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    failures.push(`${assetUrl} returned HTTP ${response.status}`);
    return;
  }

  if (assetUrl.split("?")[0].endsWith(".js") && !/\b(?:application|text)\/javascript\b/i.test(contentType)) {
    failures.push(`${assetUrl} returned invalid JS content-type: ${contentType || "missing"}`);
  }

  if (assetUrl.split("?")[0].endsWith(".css") && !/\btext\/css\b/i.test(contentType)) {
    failures.push(`${assetUrl} returned invalid CSS content-type: ${contentType || "missing"}`);
  }
}

async function fetchWithTransientRetry(url) {
  let lastError;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
    try {
      const response = await fetch(url, { headers: { "Cache-Control": "no-cache" } });

      if (!transientStatuses.has(response.status) || attempt === retryDelaysMs.length) {
        return response;
      }
    } catch (error) {
      lastError = error;

      if (attempt === retryDelaysMs.length) {
        throw error;
      }
    }

    await delay(retryDelaysMs[attempt]);
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
