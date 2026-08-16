import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { JsonLd } from "@/components/JsonLd";
import { ThemeScript } from "@/components/ThemeScript";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "RiFiTV - Football Matches, Fixtures & Live Match Information",
    template: "%s | RiFiTV",
  },
  description: "RiFiTV tracks football fixtures, match status, scores and verified broadcast information for supported competitions and teams.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "RiFiTV - Football Matches, Fixtures & Live Match Information",
    description: "Football fixtures, match status, scores and verified broadcast information for supported competitions and teams.",
    url: absoluteUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: "RiFiTV - Football Matches, Fixtures & Live Match Information",
    description: "Football fixtures, match status, scores and verified broadcast information.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/rifitv-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/rifitv-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/rifitv-icon-512.png"),
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <ThemeScript />
        <JsonLd id="rifitv-organization" data={organizationJsonLd} />
        <JsonLd id="rifitv-website" data={websiteJsonLd} />
        {children}
      </body>
    </html>
  );
}
