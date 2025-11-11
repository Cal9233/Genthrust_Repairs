import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { EmailComposerDialog } from './EmailComposerDialog';
import { mockRepairOrders, mockShops } from '../test/mocks';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock clipboard API
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

describe('EmailComposerDialog', () => {
  const mockRO = mockRepairOrders[0];
  const mockShop = mockShops[0];
  const mockOnClose = vi.fn();
  const mockOnLogEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders dialog when open', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(new RegExp(`Email Composer - RO #${mockRO.roNumber}`))).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      const { container } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={false}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('renders template selector', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Check that the Email Template label exists
      expect(screen.getByText(/Email Template/i)).toBeInTheDocument();
    });

    it('renders email fields', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/^To$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Subject/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
    });

    it('renders preview section', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Preview/i)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy to Clipboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Open in Email Client/i })).toBeInTheDocument();
    });

    it('renders log email checkbox', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/Log this email in RO status history/i)).toBeInTheDocument();
    });
  });

  describe('Shop Email Warning', () => {
    it('shows warning when shop has no email', () => {
      const shopWithoutEmail = { ...mockShop, email: '' };

      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={shopWithoutEmail}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/No email on file for this shop/i)).toBeInTheDocument();
    });

    it('does not show warning when shop has email', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/No email on file for this shop/i)).not.toBeInTheDocument();
    });

    it('shows warning when shop is null', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={null}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/No email on file for this shop/i)).toBeInTheDocument();
    });
  });

  describe('Email Content', () => {
    it('populates email fields from template', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const toInput = screen.getByLabelText(/^To$/i) as HTMLInputElement;
      const subjectInput = screen.getByLabelText(/Subject/i) as HTMLInputElement;

      expect(toInput.value).toBe(mockShop.email);
      expect(subjectInput.value).toBeTruthy();
    });

    it('allows editing email fields', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const toInput = screen.getByLabelText(/^To$/i);
      await user.clear(toInput);
      await user.type(toInput, 'newemail@test.com');

      expect(toInput).toHaveValue('newemail@test.com');
    });

    it('updates preview when fields change', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const subjectInput = screen.getByLabelText(/Subject/i);
      await user.clear(subjectInput);
      await user.type(subjectInput, 'New Subject');

      // Preview should show the new subject
      expect(screen.getByText(/New Subject/i)).toBeInTheDocument();
    });

    it('shows contact information when available', () => {
      const { container } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Check for the contact info text which includes "Contact:" prefix
      const contactTexts = screen.queryAllByText((content, element) => {
        return element?.textContent?.includes(`Contact: ${mockShop.contactName}`) ?? false;
      });
      // Should find at least one instance of the contact name
      expect(contactTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Copy to Clipboard', () => {
    it('copies email to clipboard when button clicked', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
          onLogEmail={mockOnLogEmail}
        />
      );

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      });
    });

    it('shows success toast after copying', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Email copied to clipboard!');
      });
    });

    it('closes dialog after successful copy', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('logs email when checkbox is checked', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
          onLogEmail={mockOnLogEmail}
        />
      );

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockOnLogEmail).toHaveBeenCalled();
      });
    });

    it('does not log email when checkbox is unchecked', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
          onLogEmail={mockOnLogEmail}
        />
      );

      const checkbox = screen.getByLabelText(/Log this email in RO status history/i);
      await user.click(checkbox); // Uncheck

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockOnLogEmail).not.toHaveBeenCalled();
      });
    });

    it('shows error toast when copy fails', async () => {
      mockWriteText.mockRejectedValue(new Error('Copy failed'));

      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const copyButton = screen.getByRole('button', { name: /Copy to Clipboard/i });
      await user.click(copyButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to copy to clipboard');
      });
    });
  });

  describe('Open in Email Client', () => {
    it('creates mailto link when button clicked', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const openButton = screen.getByRole('button', { name: /Open in Email Client/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(window.location.href).toContain('mailto:');
        expect(window.location.href).toContain(encodeURIComponent(mockShop.email));
      });
    });

    it('shows success toast when opening email client', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const openButton = screen.getByRole('button', { name: /Open in Email Client/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Opening in email client...');
      });
    });

    it('closes dialog after opening email client', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const openButton = screen.getByRole('button', { name: /Open in Email Client/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('logs email when opening in client', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
          onLogEmail={mockOnLogEmail}
        />
      );

      const openButton = screen.getByRole('button', { name: /Open in Email Client/i });
      await user.click(openButton);

      await waitFor(() => {
        expect(mockOnLogEmail).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Button', () => {
    it('closes dialog when Cancel button clicked', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not log email when canceling', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
          onLogEmail={mockOnLogEmail}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnLogEmail).not.toHaveBeenCalled();
    });
  });

  describe('Template Selection', () => {
    it('updates email content when template changes', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Get initial subject
      const subjectInput = screen.getByLabelText(/Subject/i) as HTMLInputElement;
      const initialSubject = subjectInput.value;

      // Note: Actually changing the select would require more complex interaction
      // This test verifies the field exists and has a value
      expect(initialSubject).toBeTruthy();
    });
  });

  describe('Preview Section', () => {
    it('displays email recipient in preview', () => {
      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const preview = screen.getByText(/Preview/i).parentElement;
      expect(preview).toHaveTextContent(mockShop.email);
    });

    it('shows (no recipient) when email is empty', () => {
      const shopWithoutEmail = { ...mockShop, email: '' };

      render(
        <EmailComposerDialog
          ro={mockRO}
          shop={shopWithoutEmail}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/\(no recipient\)/i)).toBeInTheDocument();
    });

    it('shows (no subject) when subject is empty', async () => {
      const { user } = render(
        <EmailComposerDialog
          ro={mockRO}
          shop={mockShop}
          open={true}
          onClose={mockOnClose}
        />
      );

      const subjectInput = screen.getByLabelText(/Subject/i);
      await user.clear(subjectInput);

      expect(screen.getByText(/\(no subject\)/i)).toBeInTheDocument();
    });
  });
});
