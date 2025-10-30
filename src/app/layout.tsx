import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToasterClient from "./components/ToasterClient";
import AppShell from "./components/AppShell";
import "sonner/dist/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SIS Email Automation",
  description: "SIS Email Automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-[radial-gradient(60rem_30rem_at_70%_-10%,rgba(0,21,61,0.15),transparent),radial-gradient(40rem_20rem_at_10%_-10%,rgba(0,21,61,0.12),transparent)]">
          <AppShell>
            {children}
          </AppShell>
          <ToasterClient />
        </div>
      </body>
    </html>
  );
}
