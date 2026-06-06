/**
 * apps/web/src/modules/_shared/ui/error-boundary.tsx
 *
 * I-605 — Error boundary. Bắt unhandled error ở React tree, hiện fallback UI
 * với retry button.
 */
"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Phase 6: Sentry.captureException(error, { extra: info });
    // eslint-disable-next-line no-console
    console.error("[error-boundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className="m-6 rounded border border-destructive/30 bg-destructive/10 p-6 text-center">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <p className="mt-1 text-sm text-destructive/80">{this.state.error.message}</p>
          <button
            onClick={this.reset}
            className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
