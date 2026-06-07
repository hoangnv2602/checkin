import type { Metadata } from "next";
import { Providers } from "@/modules/_shared/providers/Providers";
import { ErrorBoundary, KeyboardShortcutsHost } from "@/modules/_shared/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Check-in",
  description: "Multi-tenant event check-in platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
          <KeyboardShortcutsHost />
        </Providers>
      </body>
    </html>
  );
}
