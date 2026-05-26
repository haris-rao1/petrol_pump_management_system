import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata = {
  title: "Petrol Pump Management System",
  description: "Production-ready petrol pump operations dashboard for Pakistani pump owners and staff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          {children}
          <Toaster richColors position="top-right" theme="system" />
        </Providers>
      </body>
    </html>
  );
}
