"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Providers — root React provider tree.
 *
 * Phase 0: TanStack Query only.
 * Phase 1+ sẽ thêm:
 *   - NextIntlClientProvider
 *   - ThemeProvider (dark/light)
 *   - AuthProvider (JWT context)
 *   - ToastProvider (sonner)
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
