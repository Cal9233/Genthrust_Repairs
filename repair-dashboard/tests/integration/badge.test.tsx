import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { Badge } from '../../src/components/ui/badge';

describe('Badge', () => {
  describe('Rendering', () => {
    it('renders badge with children', () => {
      render(<Badge>New</Badge>);
      expect(screen.getByText(/New/i)).toBeInTheDocument();
    });

    it('renders badge with custom text', () => {
      render(<Badge>Beta</Badge>);
      expect(screen.getByText(/Beta/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Badge className="custom-badge">Badge</Badge>);
      const badge = screen.getByText(/Badge/i);
      expect(badge).toHaveClass('custom-badge');
    });

    it('renders with default styling', () => {
      render(<Badge>Default</Badge>);
      const badge = screen.getByText(/Default/i);
      expect(badge).toHaveClass('inline-flex', 'items-center', 'rounded-full');
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText(/Default/i);
      expect(badge).toHaveClass('bg-primary');
    });

    it('renders secondary variant', () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      const badge = screen.getByText(/Secondary/i);
      expect(badge).toHaveClass('bg-secondary');
    });

    it('renders destructive variant', () => {
      render(<Badge variant="destructive">Error</Badge>);
      const badge = screen.getByText(/Error/i);
      expect(badge).toHaveClass('bg-destructive');
    });

    it('renders outline variant', () => {
      render(<Badge variant="outline">Outline</Badge>);
      const badge = screen.getByText(/Outline/i);
      expect(badge).toHaveClass('text-foreground');
    });
  });

  describe('HTML Attributes', () => {
    it('supports data attributes', () => {
      render(<Badge data-testid="status-badge">Active</Badge>);
      expect(screen.getByTestId('status-badge')).toBeInTheDocument();
    });

    it('supports aria attributes', () => {
      render(<Badge aria-label="Status indicator">Live</Badge>);
      const badge = screen.getByText(/Live/i);
      expect(badge).toHaveAttribute('aria-label', 'Status indicator');
    });

    it('supports title attribute', () => {
      render(<Badge title="Tooltip text">Hover</Badge>);
      const badge = screen.getByText(/Hover/i);
      expect(badge).toHaveAttribute('title', 'Tooltip text');
    });
  });

  describe('Content', () => {
    it('renders numeric content', () => {
      render(<Badge>99+</Badge>);
      expect(screen.getByText(/99\+/i)).toBeInTheDocument();
    });

    it('renders with icon and text', () => {
      render(
        <Badge>
          <span>●</span> Online
        </Badge>
      );
      expect(screen.getByText(/Online/i)).toBeInTheDocument();
    });

    it('renders empty badge', () => {
      const { container } = render(<Badge />);
      const badge = container.querySelector('div');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('rounded-full');
    });
  });

  describe('Styling', () => {
    it('has proper text sizing', () => {
      render(<Badge>Small Text</Badge>);
      const badge = screen.getByText(/Small Text/i);
      expect(badge).toHaveClass('text-xs');
    });

    it('has proper padding', () => {
      render(<Badge>Padded</Badge>);
      const badge = screen.getByText(/Padded/i);
      expect(badge).toHaveClass('px-2.5', 'py-0.5');
    });

    it('has font-semibold class', () => {
      render(<Badge>Bold</Badge>);
      const badge = screen.getByText(/Bold/i);
      expect(badge).toHaveClass('font-semibold');
    });
  });

  describe('Combined Variants and Styling', () => {
    it('combines variant with custom className', () => {
      render(
        <Badge variant="destructive" className="ml-2">
          Error
        </Badge>
      );
      const badge = screen.getByText(/Error/i);
      expect(badge).toHaveClass('bg-destructive', 'ml-2');
    });

    it('renders multiple badges independently', () => {
      render(
        <div>
          <Badge variant="default">Badge 1</Badge>
          <Badge variant="secondary">Badge 2</Badge>
          <Badge variant="destructive">Badge 3</Badge>
        </div>
      );

      expect(screen.getByText(/Badge 1/i)).toHaveClass('bg-primary');
      expect(screen.getByText(/Badge 2/i)).toHaveClass('bg-secondary');
      expect(screen.getByText(/Badge 3/i)).toHaveClass('bg-destructive');
    });
  });
});
