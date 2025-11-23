/**
 * Data Source Indicator Component
 *
 * Displays current data source (MySQL or Excel) and allows manual retry.
 * Shows warning badge when in Excel fallback mode.
 */

import { useState, useEffect } from 'react';
import { hybridDataService } from '@/services/hybridDataService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Database, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function DataSourceIndicator() {
  const [isInFallbackMode, setIsInFallbackMode] = useState(false);
  const [metrics, setMetrics] = useState(hybridDataService.getMetrics());
  const [isRetrying, setIsRetrying] = useState(false);
  const queryClient = useQueryClient();

  // Poll fallback status every 5 seconds
  useEffect(() => {
    const checkStatus = () => {
      const inFallback = hybridDataService.isInFallbackMode();
      const currentMetrics = hybridDataService.getMetrics();

      setIsInFallbackMode(inFallback);
      setMetrics(currentMetrics);
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      // Force a retry by resetting fallback state and refetching data
      hybridDataService.resetFallbackState();

      // Invalidate all queries to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['ros'] });

      toast.info('Retrying database connection - Attempting to reconnect to database...');

      // Wait a bit for the query to execute
      setTimeout(() => {
        const stillInFallback = hybridDataService.isInFallbackMode();

        if (!stillInFallback) {
          toast.success('✅ Database reconnected - Successfully connected to primary database');
        } else {
          toast.warning('⚠️ Still using Excel - Database connection failed. Will retry automatically.');
        }

        setIsRetrying(false);
      }, 2000);
    } catch (error) {
      setIsRetrying(false);
      toast.error('Retry failed - Could not reconnect to database');
    }
  };

  const getStatusColor = () => {
    return isInFallbackMode ? 'bg-yellow-500' : 'bg-green-500';
  };

  const getStatusText = () => {
    return isInFallbackMode ? 'Excel (Fallback)' : 'Database';
  };

  const getStatusIcon = () => {
    return isInFallbackMode ? (
      <AlertTriangle className="h-3 w-3" />
    ) : (
      <CheckCircle className="h-3 w-3" />
    );
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number | null) => {
    if (!timestamp) return 'Never';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  // Calculate uptime percentage
  const getUptimePercentage = () => {
    const total = metrics.mysqlSuccessCount + metrics.mysqlFailureCount;
    if (total === 0) return 100;

    return Math.round((metrics.mysqlSuccessCount / total) * 100);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2"
        >
          <Database className="h-4 w-4" />
          <Badge
            variant={isInFallbackMode ? 'default' : 'secondary'}
            className={`${getStatusColor()} text-white gap-1`}
          >
            {getStatusIcon()}
            <span className="text-xs">{getStatusText()}</span>
          </Badge>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-sm mb-2">Data Source Status</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Source:</span>
              <Badge className={`${getStatusColor()} text-white gap-1`}>
                {getStatusIcon()}
                {getStatusText()}
              </Badge>
            </div>
          </div>

          {isInFallbackMode && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="h-3 w-3 inline mr-1" />
                Database unavailable. Reading from Excel.
                Data will sync when database reconnects.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Database Uptime:</span>
                <span className="font-medium">{getUptimePercentage()}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Successful Requests:</span>
                <span className="font-medium">{metrics.mysqlSuccessCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed Requests:</span>
                <span className="font-medium">{metrics.mysqlFailureCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excel Fallbacks:</span>
                <span className="font-medium">{metrics.excelFallbackCount}</span>
              </div>
            </div>

            <div className="pt-2 border-t space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Last Success:</span>
                <span className="font-medium">
                  {formatTimestamp(metrics.lastMySQLSuccess)}
                </span>
              </div>
              {metrics.lastMySQLFailure && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Last Failure:</span>
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {formatTimestamp(metrics.lastMySQLFailure)}
                  </span>
                </div>
              )}
              {metrics.lastFailureReason && (
                <div className="text-xs mt-2">
                  <span className="text-muted-foreground">Reason:</span>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-mono">
                    {metrics.lastFailureReason.slice(0, 100)}
                    {metrics.lastFailureReason.length > 100 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isInFallbackMode && (
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              size="sm"
              className="w-full"
              variant="outline"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Database Connection
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            The system automatically retries database connection every minute.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
