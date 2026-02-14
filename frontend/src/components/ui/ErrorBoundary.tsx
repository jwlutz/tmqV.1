import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error | null }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="text-4xl mb-4">&#9888;&#65039;</div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md">
        {error?.message || 'An unexpected error occurred'}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-[var(--green-up)] text-[var(--bg-darkest)] rounded-lg
                   font-medium hover:brightness-110 transition-all"
      >
        Reload Page
      </button>
    </div>
  );
}
