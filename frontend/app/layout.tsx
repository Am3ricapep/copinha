import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Copa 98 II",
  description: "Copa 98 II — o caça-níquel da Copa do Mundo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1, user-scalable=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Inter:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <ToastProvider>
          <AppProvider>
            {children}
          </AppProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
