import { AppFrame } from "@/components/app-frame";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SnapDispatch · Westshore Drayage",
  description: "Dispatch, driver pay, and load costs for Westshore Drayage. Demo data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-[#f4f6f9] text-[#152033]" suppressHydrationWarning>
        <TooltipProvider>
          <AppFrame>{children}</AppFrame>
          <Toaster position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
