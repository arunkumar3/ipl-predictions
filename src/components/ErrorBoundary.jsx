import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          style={{ backgroundColor: '#0E1842' }}
        >
          <div className="text-center max-w-sm">
            <p className="text-3xl mb-4">😵</p>
            <h1 className="text-lg font-bold mb-2" style={{ color: '#F1F5F9' }}>
              Something went wrong
            </h1>
            <p className="text-sm mb-6" style={{ color: '#9CAED4' }}>
              Try refreshing the page. If the problem persists, check your internet connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl text-sm font-bold"
              style={{
                backgroundColor: 'rgba(200, 230, 41, 0.1)',
                color: '#C8E629',
                border: '1px solid rgba(200, 230, 41, 0.2)',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
