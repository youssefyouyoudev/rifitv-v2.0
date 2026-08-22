import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AnalyticsPageView } from "@/components/AnalyticsPageView";
import { JsonLd } from "@/components/JsonLd";
import { MobileStickyAd } from "@/components/ads/MobileStickyAd";
import { RemoteNavigation } from "@/components/RemoteNavigation";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
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
    default: "RiFiTV - مباريات اليوم وجدول القنوات الناقلة",
    template: "%s | RiFiTV",
  },
  description: "RiFiTV يقدم جدول مباريات كرة القدم اليوم، المواعيد بتوقيت المغرب، النتائج، والقنوات الناقلة للمنافسات والفرق المدعومة.",
  alternates: { canonical: absoluteUrl("/") },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "RiFiTV - مباريات اليوم وجدول القنوات الناقلة",
    description: "جدول مباريات كرة القدم، توقيت المباريات، النتائج، ومعلومات القنوات الناقلة.",
    url: absoluteUrl("/"),
    locale: "ar_MA",
  },
  twitter: {
    card: "summary_large_image",
    title: "RiFiTV - مباريات اليوم وجدول القنوات الناقلة",
    description: "مواعيد مباريات كرة القدم اليوم والقنوات الناقلة على RiFiTV.",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#050910" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/rifitv-icon-512.png"),
    sameAs: [absoluteUrl("/")],
  };
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "ar-MA",
  };

  return (
    <html
      lang="ar-MA"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <ThemeScript />
        <JsonLd id="rifitv-organization" data={organizationJsonLd} />
        <JsonLd id="rifitv-website" data={websiteJsonLd} />
        <AnalyticsPageView />
        <RemoteNavigation />
        <ServiceWorkerRegistration />
        {children}
        <MobileStickyAd />
      </body>
    </html>
  );
}
