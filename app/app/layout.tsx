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

export const metadata: Metadata = {
  applicationName: "Deforest SG",
  title: "Deforest SG — Singapore forest & land-use explorer",
  description:
    "An independent overlay comparing crowd-sourced OpenStreetMap forest cover with the URA Master Plan 2025 land-use layer for Singapore — search sites and explore where the two intersect.",
  appleWebApp: { capable: true, title: "Deforest SG", statusBarStyle: "default" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/* Apply the OS color scheme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
