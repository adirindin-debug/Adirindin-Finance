import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const siteUrl = "https://adirindinfinance.com";
const siteTitle = "Adirindin Finance";
const siteDescription =
  "Educational markets research desk — cycles, charts and trackers. Not personal financial advice (NFA).";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s | Adirindin Finance" },
  description: siteDescription,
  applicationName: siteTitle,
  authors: [{ name: "Adirindin", url: "https://x.com/Dirindin533" }],
  keywords: [
    "markets",
    "cycles",
    "Bitcoin",
    "research",
    "Australia",
    "educational",
    "NFA",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/logo-x.jpg" }],
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: siteUrl,
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/og-default.jpg",
        width: 400,
        height: 400,
        alt: "Adirindin Finance",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
    site: "@Dirindin533",
    creator: "@Dirindin533",
    images: ["/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="flex min-h-screen flex-col antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
