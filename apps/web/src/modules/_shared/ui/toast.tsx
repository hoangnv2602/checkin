/**
 * apps/web/src/modules/_shared/ui/toast.tsx
 *
 * I-605 — Toast notification. Lightweight wrapper dùng sonner-style
 * provider. Auto-dismiss sau 5s, action button optional.
 */
"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "info" | "success" | "warning" | "destructive";

interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface ToastContextValue {
  show: (t: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (t: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => {
      const id = Math.random().toString(36).slice(2);
      const toast: Toast = { ...t, id, durationMs: t.durationMs ?? 5000 };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => dismiss(id), toast.durationMs);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded border p-4 shadow ${KIND_CLASS[t.kind]}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && (
                  <p className="mt-1 text-xs opacity-80">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="text-xs opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
            {t.actionLabel && t.onAction && (
              <button
                onClick={() => {
                  t.onAction!();
                  dismiss(t.id);
                }}
                className="mt-2 text-xs font-medium underline"
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_CLASS: Record<ToastKind, string> = {
  info: "border-border bg-card text-foreground",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
