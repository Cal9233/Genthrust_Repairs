/**
 * Error Utility Functions
 * Detects error types and provides contextual error messages
 */

export interface ErrorInfo {
  type: 'network' | 'auth' | 'render' | 'api' | 'unknown';
  title: string;
  message: string;
  userMessage: string;
  actionable: boolean;
  recoverable: boolean;
}

/**
 * Detect error type based on error properties
 */
export function detectErrorType(error: Error): ErrorInfo['type'] {
  const errorMessage = error.message?.toLowerCase() || '';
  const errorName = error.name?.toLowerCase() || '';

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('timeout') ||
    errorName === 'networkerror'
  ) {
    return 'network';
  }

  // Authentication errors
  if (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('token') ||
    errorMessage.includes('login') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403') ||
    errorName === 'autherror'
  ) {
    return 'auth';
  }

  // API/Graph API errors
  if (
    errorMessage.includes('api') ||
    errorMessage.includes('graph') ||
    errorMessage.includes('sharepoint') ||
    errorMessage.includes('excel') ||
    errorMessage.includes('404') ||
    errorMessage.includes('500') ||
    errorMessage.includes('429')
  ) {
    return 'api';
  }

  // React rendering errors
  if (
    errorMessage.includes('render') ||
    errorMessage.includes('component') ||
    errorMessage.includes('react') ||
    errorName === 'invariant violation'
  ) {
    return 'render';
  }

  return 'unknown';
}

/**
 * Get detailed error information based on error type
 */
export function getErrorInfo(error: Error): ErrorInfo {
  const type = detectErrorType(error);

  const errorInfoMap: Record<ErrorInfo['type'], Omit<ErrorInfo, 'type'>> = {
    network: {
      title: 'Network Connection Error',
      message: error.message,
      userMessage:
        'Unable to connect to the server. Please check your internet connection and try again.',
      actionable: true,
      recoverable: true,
    },
    auth: {
      title: 'Authentication Error',
      message: error.message,
      userMessage:
        'Your session has expired or you do not have permission to access this resource. Please sign in again.',
      actionable: true,
      recoverable: true,
    },
    api: {
      title: 'Service Error',
      message: error.message,
      userMessage:
        'There was an issue communicating with Microsoft services. The service may be temporarily unavailable. Please try again in a few moments.',
      actionable: true,
      recoverable: true,
    },
    render: {
      title: 'Application Error',
      message: error.message,
      userMessage:
        'An unexpected error occurred while displaying this content. Please refresh the page or contact support if the issue persists.',
      actionable: true,
      recoverable: true,
    },
    unknown: {
      title: 'Unexpected Error',
      message: error.message,
      userMessage:
        'An unexpected error occurred. Please refresh the page or contact support if the issue continues.',
      actionable: true,
      recoverable: true,
    },
  };

  return {
    type,
    ...errorInfoMap[type],
  };
}

/**
 * Get recovery suggestions based on error type
 */
export function getRecoverySuggestions(type: ErrorInfo['type']): string[] {
  const suggestions: Record<ErrorInfo['type'], string[]> = {
    network: [
      'Check your internet connection',
      'Verify you can access other websites',
      'Try disabling VPN if you have one active',
      'Wait a moment and try again',
    ],
    auth: [
      'Click the "Sign In Again" button below',
      'Clear your browser cache and cookies',
      'Ensure pop-ups are not blocked for this site',
      'Contact your administrator if the issue persists',
    ],
    api: [
      'Wait a few moments and try again',
      'Check if Microsoft services are experiencing issues',
      'Try refreshing the page',
      'Contact support if the error continues',
    ],
    render: [
      'Try refreshing the page',
      'Clear your browser cache',
      'Try using a different browser',
      'Contact support with error details',
    ],
    unknown: [
      'Refresh the page',
      'Clear your browser cache',
      'Try again later',
      'Contact support if the problem persists',
    ],
  };

  return suggestions[type];
}

/**
 * Format error for logging (sanitize sensitive data)
 */
export function formatErrorForLogging(error: Error, errorInfo?: React.ErrorInfo): Record<string, any> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo?.componentStack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };
}

/**
 * Check if error is recoverable (can reset error boundary)
 */
export function isRecoverable(error: Error): boolean {
  const errorType = detectErrorType(error);

  // Most errors are recoverable except catastrophic failures
  const unrecoverablePatterns = [
    'out of memory',
    'stack overflow',
    'maximum call stack',
  ];

  const errorMessage = error.message?.toLowerCase() || '';

  return !unrecoverablePatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Get session recovery data to restore state
 */
export function getSessionRecoveryData(): Record<string, any> {
  try {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      timestamp: Date.now(),
    };
  } catch {
    return {};
  }
}

/**
 * Attempt to restore session after error recovery
 */
export function attemptSessionRestore(recoveryData: Record<string, any>): void {
  try {
    if (recoveryData.pathname && recoveryData.pathname !== window.location.pathname) {
      // Could navigate back to original location if using router
      // For now, just log the attempt
      console.log('Session recovery data available:', recoveryData);
    }
  } catch (error) {
    console.error('Failed to restore session:', error);
  }
}
