import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '../../test/test-utils';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  describe('Rendering', () => {
    it('renders checkbox element', () => {
      render(<Checkbox data-testid="checkbox" />);
      expect(screen.getByTestId('checkbox')).toBeInTheDocument();
    });

    it('renders checkbox with role', () => {
      render(<Checkbox aria-label="Accept terms" />);
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('applies default styling', () => {
      render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveClass('h-4', 'w-4', 'rounded-sm', 'border');
    });

    it('applies custom className', () => {
      render(<Checkbox className="custom-checkbox" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveClass('custom-checkbox');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Checkbox ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('can be checked', async () => {
      const { user } = render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('can be unchecked', async () => {
      const { user } = render(<Checkbox defaultChecked data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('calls onCheckedChange handler', async () => {
      const handleChange = vi.fn();
      const { user } = render(<Checkbox onCheckedChange={handleChange} data-testid="checkbox" />);

      const checkbox = screen.getByTestId('checkbox');
      await user.click(checkbox);

      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('supports controlled checkbox', async () => {
      const TestComponent = () => {
        const [checked, setChecked] = React.useState(false);
        return <Checkbox checked={checked} onCheckedChange={setChecked} data-testid="checkbox" />;
      };

      const { user } = render(<TestComponent />);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(checkbox);
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('supports uncontrolled checkbox', () => {
      render(<Checkbox defaultChecked data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });
  });

  describe('States', () => {
    it('renders disabled checkbox', () => {
      render(<Checkbox disabled data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Checkbox disabled data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    it('prevents interaction when disabled', async () => {
      const handleChange = vi.fn();
      const { user } = render(
        <Checkbox disabled onCheckedChange={handleChange} data-testid="checkbox" />
      );

      const checkbox = screen.getByTestId('checkbox');
      await user.click(checkbox);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it('renders checked state', () => {
      render(<Checkbox checked data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('renders unchecked state', () => {
      render(<Checkbox checked={false} data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'unchecked');
    });

    it('supports indeterminate state', () => {
      render(<Checkbox checked="indeterminate" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('data-state', 'indeterminate');
    });
  });

  describe('HTML Attributes', () => {
    it('supports value attribute', () => {
      render(<Checkbox value="accepted" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('value', 'accepted');
    });

    it('supports required attribute', () => {
      render(<Checkbox required data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toBeRequired();
    });

    it('supports aria-label', () => {
      render(<Checkbox aria-label="Accept privacy policy" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('aria-label', 'Accept privacy policy');
    });

    it('supports aria-describedby', () => {
      render(<Checkbox aria-describedby="help-text" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('supports data attributes', () => {
      render(<Checkbox data-custom="value" data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');
      expect(checkbox).toHaveAttribute('data-custom', 'value');
    });
  });

  describe('Keyboard Interaction', () => {
    it('can be toggled with Space key', async () => {
      const { user } = render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      checkbox.focus();
      await user.keyboard(' ');

      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('can be focused with Tab key', async () => {
      const { user } = render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      await user.tab();
      expect(checkbox).toHaveFocus();
    });
  });

  describe('Form Integration', () => {
    it('works with label', async () => {
      const { user } = render(
        <div>
          <Checkbox id="terms" data-testid="checkbox" />
          <label htmlFor="terms">Accept terms and conditions</label>
        </div>
      );

      const label = screen.getByText(/Accept terms and conditions/i);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(label);
      expect(checkbox).toHaveAttribute('data-state', 'checked');
    });

    it('renders multiple checkboxes independently', async () => {
      const { user } = render(
        <div>
          <Checkbox data-testid="checkbox1" />
          <Checkbox data-testid="checkbox2" />
          <Checkbox data-testid="checkbox3" />
        </div>
      );

      const checkbox1 = screen.getByTestId('checkbox1');
      const checkbox2 = screen.getByTestId('checkbox2');

      await user.click(checkbox1);

      expect(checkbox1).toHaveAttribute('data-state', 'checked');
      expect(checkbox2).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('Visual Indicator', () => {
    it('shows check icon when checked', async () => {
      const { user, container } = render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(checkbox);

      // Check icon should be rendered
      const checkIcon = container.querySelector('svg');
      expect(checkIcon).toBeInTheDocument();
    });
  });

  describe('Checked State Styling', () => {
    it('applies checked styling', async () => {
      const { user } = render(<Checkbox data-testid="checkbox" />);
      const checkbox = screen.getByTestId('checkbox');

      await user.click(checkbox);

      expect(checkbox).toHaveClass('data-[state=checked]:bg-primary');
      expect(checkbox).toHaveClass('data-[state=checked]:text-primary-foreground');
    });
  });
});
