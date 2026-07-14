import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
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
  title: {
    default: "FlowNet SOP Builder — Turn Process Videos Into Clear, Repeatable SOPs",
    template: "%s · FlowNet SOP Builder",
  },
  description:
    "Upload a Loom video or screen recording. FlowNet SOP Builder converts it into an editable SOP, checklist, training guide, and process documentation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
