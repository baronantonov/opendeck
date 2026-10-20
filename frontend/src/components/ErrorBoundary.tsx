import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OpenDeck ErrorBoundary] Uncaught React render error:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      localStorage.removeItem('opendeck_user_session_v1');
    } catch {}
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            background: 'var(--color-bg, #1a1e1d)',
            color: 'var(--color-text, #ffffff)',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(245, 146, 110, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              marginBottom: 16,
            }}
          >
            🎧
          </div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              margin: '0 0 8px',
              fontFamily: 'var(--font-display, sans-serif)',
            }}
          >
            Синхронизация деки
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-text-dim, #9ca3af)',
              maxWidth: 320,
              margin: '0 0 24px',
              lineHeight: 1.5,
            }}
          >
            Произошла небольшая заминка при отрисовке интерфейса. Нажми кнопку ниже, чтобы перезапустить.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '12px 28px',
              borderRadius: 14,
              background: 'var(--brand-mint, #8ce2c8)',
              color: '#0b0d0c',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(140, 226, 200, 0.3)',
            }}
          >
            Перезапустить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
