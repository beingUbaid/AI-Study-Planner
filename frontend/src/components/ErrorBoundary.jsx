import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4 text-center">
          <div className="max-w-md space-y-6">
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Something went wrong ⚠️</h1>
            <p className="text-gray-500 dark:text-gray-400">
              An unexpected error occurred. Please try reloading the page or contact support if the issue persists.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition duration-200"
            >
              Reload Page 🚀
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
