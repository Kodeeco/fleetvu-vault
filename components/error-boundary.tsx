'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Unique key — remounts children when changed (recovery) */
  fallbackKey?: string | number;
  /** Optional compact mode for nested HUD panels */
  compact?: boolean;
  /** Label for logging / UI */
  name?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

/**
 * Defensive React error boundary — isolates UI crashes so a single panel
 * or network-layer failure never takes down the FleetVu Command surface.
 */
export class FleetVuErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    retryCount: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[FleetVu ErrorBoundary:${this.props.name || 'root'}]`, error, info.componentStack);
    try {
      this.props.onError?.(error, info);
    } catch {
      /* swallow */
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.fallbackKey !== this.props.fallbackKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState((s) => ({
      hasError: false,
      error: null,
      retryCount: s.retryCount + 1,
    }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      if (this.props.compact) {
        return (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 truncate">
              {this.props.name || 'Panel'} recovered from an error
            </span>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-amber-100 hover:bg-amber-500/20"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        );
      }

      return (
        <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <div>
            <div className="text-sm font-semibold text-white">
              {this.props.name || 'This section'} hit an unexpected error
            </div>
            <div className="mt-1 max-w-md text-xs text-slate-400">
              Your data is safe. Local event queues were not corrupted. You can retry without reloading the entire app.
            </div>
            {this.state.error?.message && (
              <div className="mt-2 font-mono text-[10px] text-slate-500">
                {this.state.error.message.slice(0, 160)}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      );
    }

    return (
      <React.Fragment key={`eb-${this.state.retryCount}-${this.props.fallbackKey ?? 0}`}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

/** HOC helper for wrapping functional components. */
export function withErrorBoundary<P extends object>(
  Wrapped: React.ComponentType<P>,
  name?: string,
): React.FC<P> {
  const Bound: React.FC<P> = (props) => (
    <FleetVuErrorBoundary name={name || Wrapped.displayName || Wrapped.name}>
      <Wrapped {...props} />
    </FleetVuErrorBoundary>
  );
  Bound.displayName = `withErrorBoundary(${name || Wrapped.displayName || Wrapped.name || 'Component'})`;
  return Bound;
}
