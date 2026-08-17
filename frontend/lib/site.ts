export const SITE_URL = process.env.NEXT_PUBLIC_RIFITV_SITE_URL ?? "https://rifitv.com";
export const SITE_NAME = "RiFiTV";

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
