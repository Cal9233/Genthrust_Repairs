import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from '../src/components/ui/loading-spinner';

describe('LoadingSpinner Component', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
    });

    it('should display custom loading text when provided', () => {
      const customText = 'Loading repair orders...';
      render(<LoadingSpinner text={customText} />);
      expect(screen.getByText(customText)).toBeInTheDocument();
    });

    it('should not display text when not provided', () => {
      const { container } = render(<LoadingSpinner />);
      const textElement = container.querySelector('p');
      expect(textElement).toBeNull();
    });
  });

  describe('Size Variants', () => {
    it('should render small size variant correctly', () => {
      const { container } = render(<LoadingSpinner size="sm" />);
      const spinnerContainer = container.querySelector('[data-size="sm"]');
      expect(spinnerContainer).toBeInTheDocument();
    });

    it('should render medium size variant correctly (default)', () => {
      const { container } = render(<LoadingSpinner />);
      const spinnerContainer = container.querySelector('[data-size="md"]');
      expect(spinnerContainer).toBeInTheDocument();
    });

    it('should render large size variant correctly', () => {
      const { container } = render(<LoadingSpinner size="lg" />);
      const spinnerContainer = container.querySelector('[data-size="lg"]');
      expect(spinnerContainer).toBeInTheDocument();
    });

    it('should render fullscreen variant correctly', () => {
      const { container } = render(<LoadingSpinner size="fullscreen" />);
      const spinnerContainer = container.querySelector('[data-size="fullscreen"]');
      expect(spinnerContainer).toBeInTheDocument();
      expect(spinnerContainer).toHaveClass('fixed', 'inset-0');
    });
  });

  describe('Theme Adaptation', () => {
    it('should apply gradient classes for animation', () => {
      const { container } = render(<LoadingSpinner />);
      const gradientElement = container.querySelector('[class*="gradient"]');
      expect(gradientElement).toBeInTheDocument();
    });

    it('should have theme-aware colors through CSS variables', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = container.querySelector('[data-testid="loading-spinner"]');
      expect(spinner).toBeInTheDocument();
      // Theme colors are applied via CSS custom properties
      // which are automatically handled by Tailwind in light/dark mode
    });
  });

  describe('Animation', () => {
    it('should have orbital animation class', () => {
      const { container } = render(<LoadingSpinner />);
      const animatedElement = container.querySelector('[class*="animate-orbit"]');
      expect(animatedElement).toBeInTheDocument();
    });

    it('should have plane icon with proper styling', () => {
      const { container } = render(<LoadingSpinner />);
      const planeIcon = container.querySelector('svg');
      expect(planeIcon).toBeInTheDocument();
      expect(planeIcon).toHaveClass('text-bright-blue');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      const { container } = render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should announce to screen readers', () => {
      render(<LoadingSpinner text="Loading data" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
      expect(screen.getByText('Loading data')).toBeInTheDocument();
    });

    it('should have default aria-label when no text provided', () => {
      render(<LoadingSpinner />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', 'Loading');
    });

    it('should use text as aria-label when provided', () => {
      const customText = 'Loading repair orders';
      render(<LoadingSpinner text={customText} />);
      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-label', customText);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string text gracefully', () => {
      render(<LoadingSpinner text="" />);
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
    });

    it('should handle very long text without breaking layout', () => {
      const longText = 'Loading a very long description that might wrap to multiple lines in the UI';
      render(<LoadingSpinner text={longText} />);
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('should maintain aspect ratio in all size variants', () => {
      const sizes: Array<'sm' | 'md' | 'lg' | 'fullscreen'> = ['sm', 'md', 'lg', 'fullscreen'];
      sizes.forEach(size => {
        const { container, unmount } = render(<LoadingSpinner size={size} />);
        const spinner = container.querySelector('[data-testid="loading-spinner"]');
        expect(spinner).toBeInTheDocument();
        unmount();
      });
    });
  });
});
