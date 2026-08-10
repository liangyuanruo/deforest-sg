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
  title: "Deforest SG — Forest under Master Plan 2025",
  description:
    "Explore the Singapore forest that the URA Master Plan 2025 zones for development: search and filter affected sites, and see the hectares under threat.",
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
