import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://deforest-sg.vercel.app";
const TITLE = "Deforest SG — Singapore's forests at risk of development";
const DESCRIPTION =
  "See which Singapore forests the URA Master Plan 2025 zones for development.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
      </body>
    </html>
  );
}
