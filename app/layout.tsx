import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import ChromeIOSBanner from "@/components/ChromeIOSBanner";
import UpdateAvailableBanner from "@/components/UpdateAvailableBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FindIA - Tu Asistente Financiero",
  description: "Organizá tus deudas, comparás estrategias de pago y seguís tu progreso, todo en un mismo lugar.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/logo.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: "/logo.ico",
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "167x167", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "152x152", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FindIA",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "FindIA",
    title: "FindIA - Tu Asistente Financiero",
    description: "Organizá tus deudas, comparás estrategias de pago y seguís tu progreso, todo en un mismo lugar.",
  },
  twitter: {
    card: "summary",
    title: "FindIA - Tu Asistente Financiero",
    description: "Organizá tus deudas, comparás estrategias de pago y seguís tu progreso, todo en un mismo lugar.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#FF3A5F",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="FindIA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FindIA" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#FF3A5F" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#FF3A5F" />
        
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-192x192.png" />

        {/* Splash screens iOS — usa el ícono 512x512 como fallback hasta tener imágenes específicas */}
        <link rel="apple-touch-startup-image" media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-startup-image" media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/icons/icon-512x512.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/logo.ico" />
        <link rel="icon" type="image/png" sizes="16x16" href="/logo.ico" />
        <link rel="manifest" href="/manifest.json?v=3" />
        <link rel="mask-icon" href="/logo.ico" color="#FF3A5F" />
        <link rel="shortcut icon" href="/logo.ico" />
        
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let shouldUseDark = false;
                const savedTheme = localStorage.getItem('findia-theme');
                
                if (savedTheme) {
                  shouldUseDark = savedTheme === 'dark';
                } else {
                  // Detectar preferencia del sistema si no hay tema guardado
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  shouldUseDark = prefersDark;
                  // Guardar la preferencia detectada
                  localStorage.setItem('findia-theme', prefersDark ? 'dark' : 'light');
                }
                
                if (shouldUseDark) {
                  document.documentElement.classList.add('dark');
                  // Actualizar theme-color para PWA
                  const meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) meta.setAttribute('content', '#1a1a1a');
                } else {
                  document.documentElement.classList.remove('dark');
                  const meta = document.querySelector('meta[name="theme-color"]');
                  if (meta) meta.setAttribute('content', '#FF3A5F');
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
          <ChromeIOSBanner />
          <PWAInstallBanner />
          <UpdateAvailableBanner />
        </Providers>
      </body>
    </html>
  );
}
