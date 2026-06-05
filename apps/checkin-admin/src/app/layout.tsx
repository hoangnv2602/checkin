import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SaaS Check-in Admin",
  description: "Platform owner console (audience: internal staff only)",
  robots: { index: false, follow: false },  // KHÔNG index public search
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
