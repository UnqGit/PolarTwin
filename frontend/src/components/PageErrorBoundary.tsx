import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  pageName: string;
  children: ReactNode;
  resetKey?: any;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[PageErrorBoundary - ${this.props.pageName}] unhandled page error:`, error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          padding: 24,
          color: 'var(--text-secondary)',
          background: 'var(--bg-main)'
        }}>
          <AlertTriangle size={36} color="#f59e0b" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {this.props.pageName} encountered an unexpected issue
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 450, textAlign: 'center', marginBottom: 16 }}>
            {this.state.error?.message || 'A render exception occurred in this module.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} />
            <span>Reload Module</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
