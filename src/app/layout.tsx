export const metadata = {
  title: "FindIA - Tu Compañero IA para Liberarte de Deudas",
  description: "Aplicación inteligente que te ayuda a salir de deudas",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
