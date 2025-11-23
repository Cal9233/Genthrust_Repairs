import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '../../test/test-utils';
import { Input } from '../../src/components/ui/input';

describe('Input', () => {
  describe('Rendering', () => {
    it('renders input element', () => {
      render(<Input data-testid="test-input" />);
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText(/Enter text/i)).toBeInTheDocument();
    });

    it('applies default styling', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('flex', 'h-10', 'w-full', 'rounded-md', 'border');
    });

    it('applies custom className', () => {
      render(<Input className="custom-input" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('custom-input');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Input Types', () => {
    it('renders text input by default', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('text');
    });

    it('renders email input', () => {
      render(<Input type="email" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('email');
    });

    it('renders password input', () => {
      render(<Input type="password" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('password');
    });

    it('renders number input', () => {
      render(<Input type="number" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('number');
    });

    it('renders date input', () => {
      render(<Input type="date" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('date');
    });

    it('renders file input', () => {
      render(<Input type="file" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.type).toBe('file');
    });
  });

  describe('User Interactions', () => {
    it('allows typing text', async () => {
      const { user } = render(<Input data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await user.type(input, 'Hello World');
      expect(input.value).toBe('Hello World');
    });

    it('calls onChange handler', async () => {
      const handleChange = vi.fn();
      const { user } = render(<Input onChange={handleChange} data-testid="input" />);

      const input = screen.getByTestId('input');
      await user.type(input, 'Test');

      expect(handleChange).toHaveBeenCalled();
    });

    it('supports controlled input', async () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return (
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="input"
          />
        );
      };

      const { user } = render(<TestComponent />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await user.type(input, 'Controlled');
      expect(input.value).toBe('Controlled');
    });

    it('supports uncontrolled input', () => {
      render(<Input defaultValue="Initial" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('Initial');
    });
  });

  describe('States', () => {
    it('renders disabled input', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    it('prevents typing when disabled', async () => {
      const { user } = render(<Input disabled data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await user.type(input, 'Text');
      expect(input.value).toBe('');
    });

    it('renders readonly input', () => {
      render(<Input readOnly value="Read only" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('HTML Attributes', () => {
    it('supports name attribute', () => {
      render(<Input name="username" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'username');
    });

    it('supports required attribute', () => {
      render(<Input required data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toBeRequired();
    });

    it('supports maxLength attribute', () => {
      render(<Input maxLength={10} data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('maxLength', '10');
    });

    it('supports min and max for number inputs', () => {
      render(<Input type="number" min={0} max={100} data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '100');
    });

    it('supports pattern attribute', () => {
      render(<Input pattern="[0-9]*" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
    });

    it('supports aria-label', () => {
      render(<Input aria-label="Search field" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-label', 'Search field');
    });

    it('supports aria-describedby', () => {
      render(<Input aria-describedby="help-text" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
    });
  });

  describe('Value Handling', () => {
    it('renders with initial value', () => {
      render(<Input defaultValue="Initial value" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toBe('Initial value');
    });

    it('clears value', async () => {
      const { user } = render(<Input defaultValue="Clear me" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await user.clear(input);
      expect(input.value).toBe('');
    });

    it('handles numeric values', async () => {
      const { user } = render(<Input type="number" data-testid="input" />);
      const input = screen.getByTestId('input') as HTMLInputElement;

      await user.type(input, '123');
      expect(input.value).toBe('123');
    });
  });

  describe('Focus and Blur', () => {
    it('can be focused', () => {
      render(<Input data-testid="input" />);
      const input = screen.getByTestId('input');

      input.focus();
      expect(input).toHaveFocus();
    });

    it('calls onFocus handler', async () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} data-testid="input" />);

      const input = screen.getByTestId('input');
      input.focus();

      expect(handleFocus).toHaveBeenCalled();
    });

    it('calls onBlur handler', async () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} data-testid="input" />);

      const input = screen.getByTestId('input');
      input.focus();
      input.blur();

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('Autocomplete', () => {
    it('supports autocomplete attribute', () => {
      render(<Input autoComplete="email" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('autocomplete', 'email');
    });

    it('supports autocomplete off', () => {
      render(<Input autoComplete="off" data-testid="input" />);
      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('autocomplete', 'off');
    });
  });
});
