import { Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /**
   * Size variant of the loading spinner
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';

  /**
   * Optional loading text to display below the spinner
   */
  text?: string;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Aviation-themed loading spinner with plane flying in circular orbit
 * Adapts to light/dark theme automatically
 */
export function LoadingSpinner({
  size = 'md',
  text,
  className
}: LoadingSpinnerProps) {
  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'w-16 h-16',
      plane: 'w-6 h-6',
      trail: 'w-16 h-16',
      text: 'text-sm mt-2',
    },
    md: {
      container: 'w-24 h-24',
      plane: 'w-8 h-8',
      trail: 'w-24 h-24',
      text: 'text-base mt-3',
    },
    lg: {
      container: 'w-32 h-32',
      plane: 'w-10 h-10',
      trail: 'w-32 h-32',
      text: 'text-lg mt-4',
    },
    fullscreen: {
      container: 'w-40 h-40',
      plane: 'w-12 h-12',
      trail: 'w-40 h-40',
      text: 'text-xl mt-4',
    },
  };

  const config = sizeConfig[size];
  const ariaLabel = text || 'Loading';

  // Fullscreen variant renders with overlay
  if (size === 'fullscreen') {
    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
          className
        )}
        data-size={size}
        role="status"
        aria-label={ariaLabel}
        aria-live="polite"
      >
        <div className="flex flex-col items-center justify-center" data-testid="loading-spinner">
          {/* Orbital path with gradient trail */}
          <div className={cn('relative', config.container)}>
            {/* Gradient trail circle */}
            <div
              className={cn(
                'absolute inset-0 rounded-full',
                'bg-gradient-to-r from-bright-blue via-electric to-bright-blue',
                'opacity-20 animate-trail-fade',
                config.trail
              )}
              style={{
                background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--bright-blue)) 50%, transparent 100%)',
              }}
            />

            {/* Orbital rings */}
            <div className={cn(
              'absolute inset-0 rounded-full border-2 border-bright-blue/30',
              config.trail
            )} />
            <div className={cn(
              'absolute inset-2 rounded-full border border-electric/20',
              'w-[calc(100%-1rem)] h-[calc(100%-1rem)]'
            )} />

            {/* Orbiting plane */}
            <div className="absolute inset-0 animate-orbit">
              <Plane
                className={cn(
                  'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
                  'text-bright-blue dark:text-electric drop-shadow-lg',
                  config.plane
                )}
                strokeWidth={2.5}
              />
            </div>
          </div>

          {/* Loading text */}
          {text && (
            <p className={cn(
              'font-medium text-foreground/80',
              config.text
            )}>
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Regular variant (sm, md, lg)
  return (
    <div
      className={cn('flex flex-col items-center justify-center py-8', className)}
      data-size={size}
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
    >
      <div className="flex flex-col items-center" data-testid="loading-spinner">
        {/* Orbital path with gradient trail */}
        <div className={cn('relative', config.container)}>
          {/* Gradient trail circle */}
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              'bg-gradient-to-r from-bright-blue via-electric to-bright-blue',
              'opacity-20 animate-trail-fade',
              config.trail
            )}
            style={{
              background: 'conic-gradient(from 0deg, transparent 0%, hsl(var(--bright-blue)) 50%, transparent 100%)',
            }}
          />

          {/* Orbital rings */}
          <div className={cn(
            'absolute inset-0 rounded-full border-2 border-bright-blue/30 dark:border-electric/30',
            config.trail
          )} />
          <div className={cn(
            'absolute inset-2 rounded-full border border-electric/20 dark:border-bright-blue/20',
            'w-[calc(100%-1rem)] h-[calc(100%-1rem)]'
          )} />

          {/* Orbiting plane */}
          <div className="absolute inset-0 animate-orbit">
            <Plane
              className={cn(
                'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
                'text-bright-blue dark:text-electric drop-shadow-lg',
                config.plane
              )}
              strokeWidth={2.5}
            />
          </div>
        </div>

        {/* Loading text */}
        {text && (
          <p className={cn(
            'font-medium text-foreground/80 text-center max-w-xs',
            config.text
          )}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
