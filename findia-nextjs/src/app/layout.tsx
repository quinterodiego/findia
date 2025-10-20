import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
  description: "Aplicación inteligente que te ayuda a salir de deudas con estrategias personalizadas, seguimiento motivador y IA que te guía paso a paso.",
  keywords: ["finanzas", "deudas", "IA", "ahorro", "libertad financiera"],
  authors: [{ name: "FindIA Team" }],
  creator: "FindIA",
  openGraph: {
    title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
    description: "Estrategias personalizadas, seguimiento motivador y IA que te guía hacia la libertad financiera.",
    type: "website",
    locale: "es_ES",
    siteName: "FindIA",
  },
  twitter: {
    card: "summary_large_image",
    title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
    description: "Estrategias personalizadas, seguimiento motivador y IA que te guía hacia la libertad financiera.",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/favicon-32x32.svg", sizes: "32x32", type: "image/svg+xml" },
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" }
    ],
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" }
    ]
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4F46E5"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
