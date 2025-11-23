import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../src/components/ui/card';

describe('Card Components', () => {
  describe('Card', () => {
    it('renders card component', () => {
      render(<Card data-testid="card">Card Content</Card>);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('applies default card styling', () => {
      render(<Card data-testid="card">Content</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'shadow-sm');
    });

    it('applies custom className', () => {
      render(
        <Card className="custom-card" data-testid="card">
          Content
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Card ref={ref}>Content</Card>);
      expect(ref).toHaveBeenCalled();
    });

    it('renders children', () => {
      render(<Card>Card Children</Card>);
      expect(screen.getByText(/Card Children/i)).toBeInTheDocument();
    });
  });

  describe('CardHeader', () => {
    it('renders card header', () => {
      render(<CardHeader data-testid="header">Header Content</CardHeader>);
      expect(screen.getByTestId('header')).toBeInTheDocument();
    });

    it('applies default header styling', () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
    });

    it('applies custom className', () => {
      render(
        <CardHeader className="custom-header" data-testid="header">
          Header
        </CardHeader>
      );
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('custom-header');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<CardHeader ref={ref}>Header</CardHeader>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('CardTitle', () => {
    it('renders card title', () => {
      render(<CardTitle>Card Title</CardTitle>);
      expect(screen.getByText(/Card Title/i)).toBeInTheDocument();
    });

    it('applies default title styling', () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight');
    });

    it('applies custom className', () => {
      render(
        <CardTitle className="custom-title" data-testid="title">
          Title
        </CardTitle>
      );
      const title = screen.getByTestId('title');
      expect(title).toHaveClass('custom-title');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<CardTitle ref={ref}>Title</CardTitle>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('CardDescription', () => {
    it('renders card description', () => {
      render(<CardDescription>Card Description</CardDescription>);
      expect(screen.getByText(/Card Description/i)).toBeInTheDocument();
    });

    it('applies default description styling', () => {
      render(<CardDescription data-testid="description">Description</CardDescription>);
      const description = screen.getByTestId('description');
      expect(description).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('applies custom className', () => {
      render(
        <CardDescription className="custom-desc" data-testid="description">
          Description
        </CardDescription>
      );
      const description = screen.getByTestId('description');
      expect(description).toHaveClass('custom-desc');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<CardDescription ref={ref}>Description</CardDescription>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('CardContent', () => {
    it('renders card content', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      expect(screen.getByTestId('content')).toBeInTheDocument();
    });

    it('applies default content styling', () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('p-6', 'pt-0');
    });

    it('applies custom className', () => {
      render(
        <CardContent className="custom-content" data-testid="content">
          Content
        </CardContent>
      );
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('custom-content');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<CardContent ref={ref}>Content</CardContent>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('CardFooter', () => {
    it('renders card footer', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('applies default footer styling', () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
    });

    it('applies custom className', () => {
      render(
        <CardFooter className="custom-footer" data-testid="footer">
          Footer
        </CardFooter>
      );
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('custom-footer');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<CardFooter ref={ref}>Footer</CardFooter>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Complete Card Composition', () => {
    it('renders all card components together', () => {
      const { container } = render(
        <Card data-testid="full-card">
          <CardHeader>
            <CardTitle>Complete Card</CardTitle>
            <CardDescription>This is a complete card example</CardDescription>
          </CardHeader>
          <CardContent>Main content goes here</CardContent>
          <CardFooter>Footer content</CardFooter>
        </Card>
      );

      expect(screen.getByTestId('full-card')).toBeInTheDocument();
      expect(container.textContent).toContain('Complete Card');
      expect(container.textContent).toContain('This is a complete card example');
      expect(container.textContent).toContain('Main content goes here');
      expect(container.textContent).toContain('Footer content');
    });

    it('renders card with header and content only', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Simple Card</CardTitle>
          </CardHeader>
          <CardContent>Content only</CardContent>
        </Card>
      );

      expect(screen.getByText(/Simple Card/i)).toBeInTheDocument();
      expect(screen.getByText(/Content only/i)).toBeInTheDocument();
    });

    it('renders card with custom components in content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card with Button</CardTitle>
          </CardHeader>
          <CardContent>
            <button>Click me</button>
          </CardContent>
        </Card>
      );

      expect(screen.getByText(/Card with Button/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Click me/i })).toBeInTheDocument();
    });
  });

  describe('HTML Attributes', () => {
    it('supports data attributes on card', () => {
      render(<Card data-card-id="123" data-testid="card">Card</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('data-card-id', '123');
    });

    it('supports aria attributes', () => {
      render(<Card aria-label="User profile card" data-testid="card">Card</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('aria-label', 'User profile card');
    });
  });
});
