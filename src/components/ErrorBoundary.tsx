import { Component, ReactNode, ErrorInfo } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, background: '#FFF8F4', textAlign: 'center',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>😅</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 8 }}>
          Kuch toot gaya
        </h1>
        <p style={{ fontSize: 14, color: '#666', maxWidth: 320, marginBottom: 24, lineHeight: 1.5 }}>
          App mein chhota sa error aa gaya. Refresh karne se theek ho jayega.
        </p>
        {process.env.NODE_ENV !== 'production' && this.state.error && (
          <pre style={{
            fontSize: 11, color: '#c00', background: '#fee',
            padding: 12, borderRadius: 8, maxWidth: '90%',
            overflow: 'auto', marginBottom: 16, textAlign: 'left',
          }}>
            {this.state.error.message}
          </pre>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={this.handleReload} style={{
            padding: '12px 24px', borderRadius: 50,
            background: '#FF6B35', color: 'white',
            border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            🔄 Refresh karein
          </button>
          <button onClick={this.handleReset} style={{
            padding: '12px 24px', borderRadius: 50,
            background: 'white', color: '#1A1A1A',
            border: '1.5px solid #E5E5E5', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            🏠 Home
          </button>
        </div>
      </div>
    );
  }
}
