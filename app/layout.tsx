import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FindIA - Tu Asistente Financiero con IA",
  description: "Gestiona tus finanzas de manera inteligente con la ayuda de IA. Rastrea gastos, recibe sugerencias personalizadas y alcanza tus metas financieras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('findia-theme');
                // Default to light mode if no saved theme
                const shouldUseDark = savedTheme === 'dark';
                
                if (shouldUseDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {
                // Fallback en caso de error
                console.log('Error loading theme:', e);
              }
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased font-sans`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
