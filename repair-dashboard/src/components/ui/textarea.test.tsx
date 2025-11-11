import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '../../test/test-utils';
import { Textarea } from './textarea';

describe('Textarea', () => {
  describe('Rendering', () => {
    it('renders textarea element', () => {
      render(<Textarea data-testid="textarea" />);
      expect(screen.getByTestId('textarea')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Textarea placeholder="Enter your message" />);
      expect(screen.getByPlaceholderText(/Enter your message/i)).toBeInTheDocument();
    });

    it('applies default styling', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('flex', 'min-h-[80px]', 'w-full', 'rounded-md', 'border');
    });

    it('applies custom className', () => {
      render(<Textarea className="custom-textarea" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('custom-textarea');
    });

    it('forwards ref correctly', () => {
      const ref = vi.fn();
      render(<Textarea ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('User Interactions', () => {
    it('allows typing text', async () => {
      const { user } = render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.type(textarea, 'Hello World');
      expect(textarea.value).toBe('Hello World');
    });

    it('allows multiline text', async () => {
      const { user } = render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3');
      expect(textarea.value).toContain('Line 1');
      expect(textarea.value).toContain('Line 2');
      expect(textarea.value).toContain('Line 3');
    });

    it('calls onChange handler', async () => {
      const handleChange = vi.fn();
      const { user } = render(<Textarea onChange={handleChange} data-testid="textarea" />);

      const textarea = screen.getByTestId('textarea');
      await user.type(textarea, 'Test');

      expect(handleChange).toHaveBeenCalled();
    });

    it('supports controlled textarea', async () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('');
        return (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-testid="textarea"
          />
        );
      };

      const { user } = render(<TestComponent />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.type(textarea, 'Controlled');
      expect(textarea.value).toBe('Controlled');
    });

    it('supports uncontrolled textarea', () => {
      render(<Textarea defaultValue="Initial text" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Initial text');
    });
  });

  describe('States', () => {
    it('renders disabled textarea', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-50');
    });

    it('prevents typing when disabled', async () => {
      const { user } = render(<Textarea disabled data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.type(textarea, 'Text');
      expect(textarea.value).toBe('');
    });

    it('renders readonly textarea', () => {
      render(<Textarea readOnly value="Read only text" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('readonly');
    });
  });

  describe('HTML Attributes', () => {
    it('supports name attribute', () => {
      render(<Textarea name="message" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('name', 'message');
    });

    it('supports required attribute', () => {
      render(<Textarea required data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toBeRequired();
    });

    it('supports maxLength attribute', () => {
      render(<Textarea maxLength={100} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('maxLength', '100');
    });

    it('supports rows attribute', () => {
      render(<Textarea rows={5} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('supports cols attribute', () => {
      render(<Textarea cols={50} data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('cols', '50');
    });

    it('supports aria-label', () => {
      render(<Textarea aria-label="Message field" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('aria-label', 'Message field');
    });

    it('supports aria-describedby', () => {
      render(<Textarea aria-describedby="help-text" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveAttribute('aria-describedby', 'help-text');
    });
  });

  describe('Value Handling', () => {
    it('renders with initial value', () => {
      render(<Textarea defaultValue="Initial value" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Initial value');
    });

    it('clears value', async () => {
      const { user } = render(<Textarea defaultValue="Clear me" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.clear(textarea);
      expect(textarea.value).toBe('');
    });

    it('handles long text', async () => {
      const longText = 'Lorem ipsum dolor sit amet';
      const { user } = render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

      await user.type(textarea, longText);
      expect(textarea.value).toBe(longText);
    });
  });

  describe('Focus and Blur', () => {
    it('can be focused', () => {
      render(<Textarea data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');

      textarea.focus();
      expect(textarea).toHaveFocus();
    });

    it('calls onFocus handler', async () => {
      const handleFocus = vi.fn();
      render(<Textarea onFocus={handleFocus} data-testid="textarea" />);

      const textarea = screen.getByTestId('textarea');
      textarea.focus();

      expect(handleFocus).toHaveBeenCalled();
    });

    it('calls onBlur handler', async () => {
      const handleBlur = vi.fn();
      render(<Textarea onBlur={handleBlur} data-testid="textarea" />);

      const textarea = screen.getByTestId('textarea');
      textarea.focus();
      textarea.blur();

      expect(handleBlur).toHaveBeenCalled();
    });
  });

  describe('Resize', () => {
    it('can set resize behavior via className', () => {
      render(<Textarea className="resize-none" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('resize-none');
    });

    it('allows vertical resize by default via className', () => {
      render(<Textarea className="resize-y" data-testid="textarea" />);
      const textarea = screen.getByTestId('textarea');
      expect(textarea).toHaveClass('resize-y');
    });
  });

  describe('Form Integration', () => {
    it('works in a form', () => {
      render(
        <form>
          <label htmlFor="comment">Comment</label>
          <Textarea id="comment" name="comment" />
        </form>
      );

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('id', 'comment');
      expect(textarea).toHaveAttribute('name', 'comment');
    });
  });
});
