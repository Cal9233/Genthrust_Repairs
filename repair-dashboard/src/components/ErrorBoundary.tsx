import React, { Component, ReactNode } from 'react';
import { ErrorFallback } from './ErrorFallback';
import { createLogger } from '@/utils/logger';
import {
  formatErrorForLogging,
  isRecoverable,
  getSessionRecoveryData,
  attemptSessionRestore,
} from '@/utils/errorUtils';

const logger = createLogger('ErrorBoundary');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo, resetError: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
  onSignIn?: () => void;
  resetKeys?: Array<string | number>;
  level?: 'app' | 'route' | 'component';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
  sessionRecoveryData: Record<string, any>;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs error details, and displays a fallback UI.
 *
 * Features:
 * - Automatic error logging with Winston
 * - Session recovery mechanism
 * - Error type detection (network, auth, render, api)
 * - Different fallback UIs based on error type
 * - Reset functionality to recover without full page reload
 * - Configurable at different levels (app, route, component)
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary level="app" onSignIn={handleSignIn}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      sessionRecoveryData: {},
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { level = 'component', onError } = this.props;

    // Increment error count
    const errorCount = this.state.errorCount + 1;

    // Save session recovery data
    const sessionRecoveryData = getSessionRecoveryData();

    this.setState({
      errorInfo,
      errorCount,
      sessionRecoveryData,
    });

    // Log error with Winston
    const errorData = formatErrorForLogging(error, errorInfo);
    logger.error(`[${level.toUpperCase()}] Error caught by boundary`, error, {
      ...errorData,
      level,
      errorCount,
      recoverable: isRecoverable(error),
    });

    // Call custom error handler if provided
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        logger.error('Error in custom error handler', handlerError as Error);
      }
    }

    // Track error count in session storage
    try {
      const key = `error-boundary-count-${level}`;
      sessionStorage.setItem(key, String(errorCount));

      // If too many errors, suggest full reload
      if (errorCount >= 3) {
        logger.warn('Multiple errors detected, suggesting full page reload', {
          errorCount,
          level,
        });
      }
    } catch (storageError) {
      // Ignore storage errors
    }

    // In development, also log to console for better DX
    if (import.meta.env.DEV) {
      console.group(`🚨 Error Boundary (${level})`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys = [] } = this.props;
    const { hasError } = this.state;

    // Auto-reset if resetKeys change
    if (
      hasError &&
      resetKeys.length > 0 &&
      resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
    ) {
      logger.info('Reset keys changed, automatically resetting error boundary');
      this.resetError();
    }
  }

  componentWillUnmount() {
    // Clean up any pending timeouts
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  resetError = () => {
    const { onReset } = this.props;
    const { sessionRecoveryData } = this.state;

    logger.info('Resetting error boundary');

    // Call custom reset handler
    if (onReset) {
      try {
        onReset();
      } catch (resetError) {
        logger.error('Error in custom reset handler', resetError as Error);
      }
    }

    // Attempt to restore session
    attemptSessionRestore(sessionRecoveryData);

    // Reset state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      sessionRecoveryData: {},
    });

    // Clear error count after successful reset
    try {
      const key = `error-boundary-count-${this.props.level || 'component'}`;
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  };

  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { children, fallback, onSignIn, level = 'component' } = this.props;

    if (hasError && error) {
      // If custom fallback provided, use it
      if (fallback) {
        return fallback(error, errorInfo!, this.resetError);
      }

      // Check if we should suggest full reload (too many errors)
      const shouldSuggestReload = errorCount >= 3;

      // For app-level errors or too many errors, show full-screen error
      if (level === 'app' || shouldSuggestReload) {
        return (
          <ErrorFallback
            error={error}
            errorInfo={errorInfo!}
            resetError={this.resetError}
            onSignIn={onSignIn}
          />
        );
      }

      // For route/component level errors, show inline error
      return (
        <div className="p-6 m-4 border-2 border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="text-red-600 dark:text-red-400 text-xl">⚠</span>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                This component encountered an error. You can try again or refresh the page.
              </p>

              {import.meta.env.DEV && (
                <details className="mb-4">
                  <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/20 p-3 rounded overflow-x-auto">
                    {error.toString()}
                  </pre>
                </details>
              )}

              <button
                onClick={this.resetError}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook to imperatively trigger error boundary
 * (for use in event handlers where throwing won't be caught)
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
