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
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F5F6FA' }}>
          <div className="text-center max-w-sm">
            <p className="text-3xl mb-4">😵</p>
            <h1 className="text-lg font-bold mb-2" style={{ color: '#1A1A2E' }}>Something went wrong</h1>
            <p className="text-sm mb-6" style={{ color: '#4A5068' }}>
              Try refreshing the page. If the problem persists, check your internet connection.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-xl text-sm font-bold"
              style={{ backgroundColor: '#1B2A6B', color: '#FFFFFF' }}
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
