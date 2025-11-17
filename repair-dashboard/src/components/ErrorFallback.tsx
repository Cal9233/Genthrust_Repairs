import { AlertCircle, RefreshCw, LogIn, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useState } from 'react';
import { getErrorInfo, getRecoverySuggestions, type ErrorInfo } from '@/utils/errorUtils';
import logo from '../assets/GENLOGO.png';

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  resetError: () => void;
  onSignIn?: () => void;
}

export function ErrorFallback({ error, errorInfo, resetError, onSignIn }: ErrorFallbackProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const isDevelopment = import.meta.env.DEV;

  const errorDetails: ErrorInfo = getErrorInfo(error);
  const suggestions = getRecoverySuggestions(errorDetails.type);

  // Error type specific icons and colors
  const errorConfig = {
    network: {
      icon: AlertCircle,
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-50 dark:bg-orange-950/20',
      borderClass: 'border-orange-200 dark:border-orange-900',
    },
    auth: {
      icon: LogIn,
      colorClass: 'text-red-500',
      bgClass: 'bg-red-50 dark:bg-red-950/20',
      borderClass: 'border-red-200 dark:border-red-900',
    },
    api: {
      icon: AlertCircle,
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-50 dark:bg-blue-950/20',
      borderClass: 'border-blue-200 dark:border-blue-900',
    },
    render: {
      icon: AlertCircle,
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-50 dark:bg-purple-950/20',
      borderClass: 'border-purple-200 dark:border-purple-900',
    },
    unknown: {
      icon: AlertCircle,
      colorClass: 'text-gray-500',
      bgClass: 'bg-gray-50 dark:bg-gray-950/20',
      borderClass: 'border-gray-200 dark:border-gray-900',
    },
  };

  const config = errorConfig[errorDetails.type];
  const Icon = config.icon;

  const handleReset = () => {
    // Clear any corrupted state
    try {
      sessionStorage.removeItem('error-boundary-count');
    } catch {
      // Ignore
    }
    resetError();
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full">
        <Card className={`p-8 shadow-lg ${config.borderClass} border-2`}>
          {/* Header with logo and icon */}
          <div className="flex items-center justify-between mb-6">
            <img src={logo} alt="GenThrust Logo" className="h-10 w-auto object-contain" />
            <div className={`p-3 rounded-full ${config.bgClass}`}>
              <Icon className={`h-8 w-8 ${config.colorClass}`} />
            </div>
          </div>

          {/* Error title and message */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-3">{errorDetails.title}</h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              {errorDetails.userMessage}
            </p>
          </div>

          {/* Recovery suggestions */}
          {suggestions.length > 0 && (
            <div className={`mb-6 p-4 rounded-lg ${config.bgClass} border ${config.borderClass}`}>
              <h2 className="font-semibold text-sm text-foreground mb-3">
                What you can do:
              </h2>
              <ul className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className={`mt-0.5 ${config.colorClass}`}>•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {errorDetails.type === 'auth' && onSignIn && (
              <Button
                onClick={onSignIn}
                className="flex items-center gap-2 bg-gradient-blue text-white shadow-md hover:shadow-lg"
              >
                <LogIn className="h-4 w-4" />
                Sign In Again
              </Button>
            )}

            {errorDetails.recoverable && (
              <Button
                onClick={handleReset}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            )}

            <Button onClick={handleReload} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reload Page
            </Button>

            <Button onClick={handleGoHome} variant="ghost" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Go Home
            </Button>
          </div>

          {/* Technical details (development only or expandable) */}
          {(isDevelopment || showTechnicalDetails) && (
            <div className="mt-6 border-t border-border pt-6">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                {showTechnicalDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showTechnicalDetails ? 'Hide' : 'Show'} Technical Details
              </button>

              {showTechnicalDetails && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Error Type
                    </h3>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {errorDetails.type}
                    </code>
                  </div>

                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                      Error Message
                    </h3>
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap break-words">
                      {error.name}: {error.message}
                    </pre>
                  </div>

                  {error.stack && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Stack Trace
                      </h3>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap break-words">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && isDevelopment && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        Component Stack
                      </h3>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 overflow-y-auto font-mono whitespace-pre-wrap break-words">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Support contact */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              If this error continues, please contact{' '}
              <a
                href="mailto:cmalagon@genthrust.net"
                className="text-bright-blue hover:underline font-medium"
              >
                support
              </a>{' '}
              with the technical details above.
            </p>
          </div>
        </Card>

        {/* Environment indicator (development only) */}
        {isDevelopment && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded-full">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              Development Mode
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
