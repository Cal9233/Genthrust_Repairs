import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { Button } from './button';

describe('Button', () => {
  describe('Rendering', () => {
    it('renders button with children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: /Click me/i })).toBeInTheDocument();
    });

    it('renders as disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);
      const button = screen.getByRole('button', { name: /Disabled Button/i });
      expect(button).toBeDisabled();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      const button = screen.getByRole('button', { name: /Button/i });
      expect(button).toHaveClass('custom-class');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Button ref={ref}>Button</Button>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole('button', { name: /Default/i });
      expect(button).toHaveClass('bg-primary');
    });

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button', { name: /Delete/i });
      expect(button).toHaveClass('bg-destructive');
    });

    it('renders outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button', { name: /Outline/i });
      expect(button).toHaveClass('border');
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button', { name: /Secondary/i });
      expect(button).toHaveClass('bg-secondary');
    });

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button', { name: /Ghost/i });
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole('button', { name: /Link/i });
      expect(button).toHaveClass('underline-offset-4');
    });
  });

  describe('Sizes', () => {
    it('renders default size', () => {
      render(<Button size="default">Default Size</Button>);
      const button = screen.getByRole('button', { name: /Default Size/i });
      expect(button).toHaveClass('h-10');
    });

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button', { name: /Small/i });
      expect(button).toHaveClass('h-9');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button', { name: /Large/i });
      expect(button).toHaveClass('h-11');
    });

    it('renders icon size', () => {
      render(<Button size="icon" aria-label="Icon button">X</Button>);
      const button = screen.getByRole('button', { name: /Icon button/i });
      expect(button).toHaveClass('h-10', 'w-10');
    });
  });

  describe('Interactions', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      const { user } = render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button', { name: /Click me/i });
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      const { user } = render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>
      );

      const button = screen.getByRole('button', { name: /Disabled/i });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('supports keyboard navigation', async () => {
      const handleClick = vi.fn();
      const { user } = render(<Button onClick={handleClick}>Press Enter</Button>);

      const button = screen.getByRole('button', { name: /Press Enter/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('HTML Attributes', () => {
    it('supports type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button', { name: /Submit/i });
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>);
      expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument();
    });

    it('supports data attributes', () => {
      render(<Button data-testid="custom-button">Button</Button>);
      expect(screen.getByTestId('custom-button')).toBeInTheDocument();
    });
  });

  describe('asChild Prop', () => {
    it('renders as child component when asChild is true', () => {
      render(
        <Button asChild>
          <a href="/link">Link Button</a>
        </Button>
      );

      const link = screen.getByRole('link', { name: /Link Button/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/link');
    });
  });
});
