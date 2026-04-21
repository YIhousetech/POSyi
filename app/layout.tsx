import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav"; // Import navigasi yang baru dibuat

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS Retail System", // Ganti sesuai brand Anda
  description: "Aplikasi POS & Inventory Mobile-First",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-slate-950 text-white min-h-full flex flex-col">
        {/* Konten Utama dengan pembatas lebar maksimal agar tetap terlihat seperti HP di layar PC */}
        <main className="flex-1 max-w-lg mx-auto w-full pb-24 px-4 relative">
          {children}
        </main>

        {/* Komponen Navigasi Bawah */}
        <BottomNav />
      </body>
    </html>
  );
}