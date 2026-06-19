"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--color-danger-soft)" }}
          >
            <AlertTriangle className="w-6 h-6" style={{ color: "var(--color-fg-danger)" }} />
          </div>
          <h3
            className="text-base font-semibold mb-1"
            style={{ color: "var(--color-heading)", fontFamily: "var(--font-serif)" }}
          >
            {this.props.section ? `${this.props.section} Error` : "Something went wrong"}
          </h3>
          <p className="text-sm mb-4 max-w-md" style={{ color: "var(--color-body-subtle)" }}>
            {this.state.error?.message || "An unexpected error occurred. Try refreshing this section."}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "var(--color-brand-softer)",
              color: "var(--color-fg-brand-strong)",
              border: "1px solid var(--color-border-brand-subtle)",
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
