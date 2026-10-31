import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    if (typeof fetch === 'function') {
      try {
        fetch('/api/client-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'react.error_boundary',
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            url: typeof window !== 'undefined' ? window.location.href : '',
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      } catch {
        // Ignore logging failures
      }
    }
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleResetStateAndReload = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // Ignore
      }
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex min-h-screen items-center justify-center bg-canvas p-8 font-sans text-fg">
          <div className="w-full max-w-170 rounded-md border border-red/40 bg-surface p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="mb-4 flex items-center gap-3 text-red">
              <ShieldAlert size={28} />
              <h2 className="m-0 text-xl font-bold">
                {this.props.fallbackTitle || 'Application Rendering Error'}
              </h2>
            </div>

            <p className="mb-5 text-base leading-normal text-fg-secondary">
              An unexpected error occurred while rendering this tournament view. The error details below can help diagnose the cause.
            </p>

            {this.state.error && (
              <div className="mb-4 overflow-x-auto rounded-md border border-red/25 bg-canvas p-4 font-mono text-sm whitespace-pre-wrap text-red-bright [word-break:break-word]">
                {this.state.error.toString()}
              </div>
            )}

            {this.state.errorInfo?.componentStack && (
              <details className="mb-6">
                <summary className="mb-2 cursor-pointer text-caption text-fg-muted select-none">
                  View Component Stack Trace
                </summary>
                <div className="max-h-50 overflow-y-auto rounded-md border border-white/8 bg-canvas p-3 font-mono text-xs whitespace-pre-wrap text-fg-secondary">
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={this.handleReload} className="px-5 py-2.5">
                <RefreshCw size={16} /> Reload Page
              </Button>
              <Button variant="secondary" onClick={this.handleResetStateAndReload} className="px-5 py-2.5">
                <Home size={16} /> Return to Tournaments
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
