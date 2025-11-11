import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { Label } from './label';
import { Input } from './input';

describe('Label', () => {
  describe('Rendering', () => {
    it('renders label element', () => {
      render(<Label>Label Text</Label>);
      expect(screen.getByText(/Label Text/i)).toBeInTheDocument();
    });

    it('renders with htmlFor attribute', () => {
      render(<Label htmlFor="input-id">Label</Label>);
      const label = screen.getByText(/Label/i);
      expect(label).toHaveAttribute('for', 'input-id');
    });

    it('applies default styling', () => {
      render(<Label data-testid="label">Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('text-sm', 'font-medium', 'leading-none');
    });

    it('applies custom className', () => {
      render(
        <Label className="custom-label" data-testid="label">
          Label
        </Label>
      );
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('custom-label');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Label ref={ref}>Label</Label>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Label-Input Association', () => {
    it('associates with input via htmlFor', () => {
      render(
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" />
        </div>
      );

      const label = screen.getByText(/Username/i);
      const input = screen.getByRole('textbox');

      expect(label).toHaveAttribute('for', 'username');
      expect(input).toHaveAttribute('id', 'username');
    });

    it('clicking label focuses associated input', async () => {
      const { user } = render(
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" />
        </div>
      );

      const label = screen.getByText(/Email/i);
      const input = screen.getByRole('textbox');

      await user.click(label);
      expect(input).toHaveFocus();
    });
  });

  describe('HTML Attributes', () => {
    it('supports data attributes', () => {
      render(<Label data-testid="custom-label">Label</Label>);
      expect(screen.getByTestId('custom-label')).toBeInTheDocument();
    });

    it('supports aria attributes', () => {
      render(<Label aria-label="Form label">Label</Label>);
      const label = screen.getByText(/Label/i);
      expect(label).toHaveAttribute('aria-label', 'Form label');
    });

    it('supports title attribute', () => {
      render(<Label title="Tooltip">Label</Label>);
      const label = screen.getByText(/Label/i);
      expect(label).toHaveAttribute('title', 'Tooltip');
    });
  });

  describe('Content', () => {
    it('renders text content', () => {
      render(<Label>Simple Text</Label>);
      expect(screen.getByText(/Simple Text/i)).toBeInTheDocument();
    });

    it('renders with required indicator', () => {
      render(
        <Label>
          Name <span className="text-red-500">*</span>
        </Label>
      );
      expect(screen.getByText(/Name/i)).toBeInTheDocument();
    });

    it('renders with icon', () => {
      render(
        <Label>
          <span>●</span> Status
        </Label>
      );
      expect(screen.getByText(/Status/i)).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('applies peer-disabled styles', () => {
      render(<Label data-testid="label">Disabled Label</Label>);
      const label = screen.getByTestId('label');
      expect(label).toHaveClass('peer-disabled:cursor-not-allowed', 'peer-disabled:opacity-70');
    });
  });

  describe('Form Integration', () => {
    it('works with multiple form fields', () => {
      render(
        <form>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" />

          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" />

          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" />
        </form>
      );

      expect(screen.getByText(/First Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Last Name/i)).toBeInTheDocument();
      expect(screen.getByText(/Email/i)).toBeInTheDocument();
    });

    it('renders in fieldset', () => {
      render(
        <fieldset>
          <legend>User Information</legend>
          <Label htmlFor="username">Username</Label>
          <Input id="username" />
        </fieldset>
      );

      expect(screen.getByText(/User Information/i)).toBeInTheDocument();
      expect(screen.getByText(/Username/i)).toBeInTheDocument();
    });
  });
});
