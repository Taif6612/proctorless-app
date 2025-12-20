import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import NavBar from "@/components/nav-bar";
import { Toaster } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "ProctorLess | Smart Assessment Platform",
  description: "Privacy-first smart assessment platform for modern education",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.className} antialiased`}>
        <Providers>
          <NavBar />
          {children}
          <footer className="w-full border-t border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-b from-white/80 to-slate-50/80 dark:from-slate-900/80 dark:to-slate-950/80 backdrop-blur-xl">
            <div className="mx-auto max-w-7xl py-8 flex flex-col items-center gap-4">
              <Link href="/" className="hover:scale-105 transition-transform duration-200">
                <Image src="/assets/logo-placeholder.svg" alt="ProctorLess logo" width={150} height={50} />
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400">© 2024 ProctorLess. Built for modern education.</p>
            </div>
          </footer>
          <Toaster />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
