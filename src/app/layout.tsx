import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
  description: "Gestiona tus deudas de manera inteligente con la ayuda de IA. Rastrea tu progreso, recibe sugerencias personalizadas y libérate de las deudas más rápido.",
  keywords: ["finanzas", "deudas", "IA", "gestión financiera", "pagos", "presupuesto"],
  authors: [{ name: "FindIA Team" }],
  creator: "FindIA",
  publisher: "FindIA",
  robots: "index, follow",
  openGraph: {
    title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
    description: "Gestiona tus deudas de manera inteligente con la ayuda de IA",
    type: "website",
    locale: "es_ES",
    siteName: "FindIA",
  },
  twitter: {
    card: "summary_large_image",
    title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
    description: "Gestiona tus deudas de manera inteligente con la ayuda de IA",
  },
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
