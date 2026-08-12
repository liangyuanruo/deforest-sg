import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { TooltipProvider } from "@/components/ui/tooltip";
import { productionBaseUrl, SITE_URL } from "@/lib/share";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Deforest SG — Singapore's vulnerable forests";
const DESCRIPTION =
  "See which Singapore forests are zoned for development under the Master Plan 2025.";

export const metadata: Metadata = {
  // Resolves relative OG/canonical URLs (including the per-forest `/forest/<id>`
  // pages) against the real production domain Vercel reports.
  metadataBase: new URL(productionBaseUrl() ?? SITE_URL),
  applicationName: "Deforest SG",
  title: TITLE,
  description: DESCRIPTION,
  appleWebApp: { capable: true, title: "Deforest SG", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "Deforest SG",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_SG",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Apply the saved preference (else the OS scheme) before paint, so the
            theme toggle never flashes on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');if(t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
        <TooltipProvider>{children}</TooltipProvider>
        <Analytics />
      </body>
    </html>
  );
}
