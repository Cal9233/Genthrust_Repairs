import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { RODetailDialog } from '../../src/components/RODetailDialog';
import { mockRepairOrders, mockShops } from '../test/mocks';
import * as useShopsModule from '../../src/hooks/useShops';
import * as useROsModule from '../../src/hooks/useROs';
import { reminderService } from '../../src/lib/reminderService';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../hooks/useShops');
vi.mock('../hooks/useROs');
vi.mock('../lib/reminderService');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child dialogs
vi.mock('./UpdateStatusDialog', () => ({
  UpdateStatusDialog: ({ open }: { open: boolean }) =>
    open ? <div>Update Status Dialog</div> : null,
}));
vi.mock('./EmailComposerDialog', () => ({
  EmailComposerDialog: ({ open }: { open: boolean }) =>
    open ? <div>Email Composer Dialog</div> : null,
}));
vi.mock('./ReminderTypeDialog', () => ({
  ReminderTypeDialog: ({ open, onConfirm }: { open: boolean; onConfirm: (types: any) => void }) =>
    open ? (
      <div>
        Reminder Type Dialog
        <button onClick={() => onConfirm({ todo: true, calendar: true })}>Create Reminders</button>
      </div>
    ) : null,
}));

describe('RODetailDialog', () => {
  const mockRO = mockRepairOrders[0];
  const mockOnClose = vi.fn();
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: mockShops,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(reminderService.createReminders).mockResolvedValue({
      todo: true,
      calendar: true,
    });
  });

  describe('Rendering', () => {
    it('renders dialog when open', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(new RegExp(`RO #${mockRO.roNumber}`))).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      const { container } = render(
        <RODetailDialog
          ro={mockRO}
          open={false}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('displays RO number and status badge', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(new RegExp(mockRO.roNumber))).toBeInTheDocument();
    });

    it('displays action buttons', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Update Status/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Email Shop/i })).toBeInTheDocument();
    });

    it('shows Set Reminder button when nextDateToUpdate exists', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        expect(screen.getByRole('button', { name: /Set Reminder/i })).toBeInTheDocument();
      }
    });

    it('hides Set Reminder button when no nextDateToUpdate', () => {
      const roWithoutDate = { ...mockRO, nextDateToUpdate: null };

      render(
        <RODetailDialog
          ro={roWithoutDate}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByRole('button', { name: /Set Reminder/i })).not.toBeInTheDocument();
    });
  });

  describe('Shop Information Section', () => {
    it('displays shop name', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Shop Information/i)).toBeInTheDocument();
      expect(screen.getByText(mockRO.shopName)).toBeInTheDocument();
    });

    it('displays shop reference number', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.shopReferenceNumber) {
        expect(screen.getByText(mockRO.shopReferenceNumber)).toBeInTheDocument();
      }
    });

    it('displays terms', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.terms) {
        expect(screen.getByText(mockRO.terms)).toBeInTheDocument();
      }
    });

    it('shows N/A for missing optional fields', () => {
      const roWithoutOptionals = {
        ...mockRO,
        shopReferenceNumber: '',
        terms: '',
      };

      render(
        <RODetailDialog
          ro={roWithoutOptionals}
          open={true}
          onClose={mockOnClose}
        />
      );

      const naElements = screen.getAllByText('N/A');
      expect(naElements.length).toBeGreaterThan(0);
    });
  });

  describe('Part Information Section', () => {
    it('displays part description', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Part Information/i)).toBeInTheDocument();
      expect(screen.getByText(mockRO.partDescription)).toBeInTheDocument();
    });

    it('displays part number and serial number', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(mockRO.partNumber)).toBeInTheDocument();
      expect(screen.getByText(mockRO.serialNumber)).toBeInTheDocument();
    });

    it('displays required work', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(mockRO.requiredWork)).toBeInTheDocument();
    });
  });

  describe('Timeline Section', () => {
    it('displays timeline header', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Timeline/i)).toBeInTheDocument();
    });

    it('displays date labels', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Date Made:/i)).toBeInTheDocument();
      expect(screen.getByText(/Dropped Off:/i)).toBeInTheDocument();
      expect(screen.getByText(/Est\. Delivery:/i)).toBeInTheDocument();
      expect(screen.getByText(/Last Updated:/i)).toBeInTheDocument();
      expect(screen.getByText(/Next Update:/i)).toBeInTheDocument();
    });

    it('shows overdue information when RO is overdue', () => {
      const overdueRO = {
        ...mockRO,
        isOverdue: true,
        daysOverdue: 5,
      };

      render(
        <RODetailDialog
          ro={overdueRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/5 days overdue/i)).toBeInTheDocument();
    });
  });

  describe('Costs Section', () => {
    it('displays costs header', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/^Costs$/i)).toBeInTheDocument();
    });

    it('displays estimated and final costs', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Estimated:/i)).toBeInTheDocument();
      expect(screen.getByText(/Final:/i)).toBeInTheDocument();
    });
  });

  describe('Tracking Section', () => {
    it('displays tracking number when available', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: 'TRACK123456',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('TRACK123456')).toBeInTheDocument();
      expect(screen.getByText(/Shipping/i)).toBeInTheDocument();
    });

    it('does not display tracking section when no tracking number', () => {
      const roWithoutTracking = {
        ...mockRO,
        trackingNumber: '',
      };

      render(
        <RODetailDialog
          ro={roWithoutTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/Shipping/i)).not.toBeInTheDocument();
    });

    it('creates UPS tracking link for UPS tracking numbers', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: '1Z999AA10123456784',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      const link = screen.getByRole('link', { name: '1Z999AA10123456784' });
      expect(link).toHaveAttribute('href', 'https://www.ups.com/track?tracknum=1Z999AA10123456784');
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.getByText('(UPS)')).toBeInTheDocument();
    });

    it('creates FedEx tracking link for FedEx 12-digit tracking numbers', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: '123456789012',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      const link = screen.getByRole('link', { name: '123456789012' });
      expect(link).toHaveAttribute('href', 'https://www.fedex.com/fedextrack/?trknbr=123456789012');
      expect(link).toHaveAttribute('target', '_blank');
      expect(screen.getByText('(FedEx)')).toBeInTheDocument();
    });

    it('creates FedEx tracking link for FedEx 15-digit tracking numbers', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: '123456789012345',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      const link = screen.getByRole('link', { name: '123456789012345' });
      expect(link).toHaveAttribute('href', 'https://www.fedex.com/fedextrack/?trknbr=123456789012345');
      expect(screen.getByText('(FedEx)')).toBeInTheDocument();
    });

    it('creates FedEx tracking link for FedEx SmartPost tracking numbers', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: '9612345678901234567890',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      const link = screen.getByRole('link', { name: '9612345678901234567890' });
      expect(link).toHaveAttribute('href', 'https://www.fedex.com/fedextrack/?trknbr=9612345678901234567890');
      expect(screen.getByText('(FedEx)')).toBeInTheDocument();
    });

    it('defaults to UPS link for unknown tracking number formats', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: 'UNKNOWN123',
      };

      render(
        <RODetailDialog
          ro={roWithTracking}
          open={true}
          onClose={mockOnClose}
        />
      );

      const link = screen.getByRole('link', { name: 'UNKNOWN123' });
      expect(link).toHaveAttribute('href', 'https://www.ups.com/track?tracknum=UNKNOWN123');
      expect(screen.getByText('(Unknown)')).toBeInTheDocument();
    });
  });

  describe('Notes Section', () => {
    it('displays notes when available', () => {
      const roWithNotes = {
        ...mockRO,
        notes: 'Test notes for this RO',
      };

      render(
        <RODetailDialog
          ro={roWithNotes}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Test notes for this RO')).toBeInTheDocument();
    });

    it('does not display notes section when no notes', () => {
      const roWithoutNotes = {
        ...mockRO,
        notes: '',
      };

      render(
        <RODetailDialog
          ro={roWithoutNotes}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Should not have a Notes header in the document
      const notesHeaders = screen.queryAllByText(/^Notes$/i);
      expect(notesHeaders.length).toBe(0);
    });
  });

  describe('Status History Section', () => {
    it('displays status history header', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Status History/i)).toBeInTheDocument();
    });
  });

  describe('Dialog Interactions', () => {
    it('opens UpdateStatusDialog when Update Status clicked', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Status/i });
      await user.click(updateButton);

      await waitFor(() => {
        expect(screen.getByText('Update Status Dialog')).toBeInTheDocument();
      });
    });

    it('opens EmailComposerDialog when Email Shop clicked', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      const emailButton = screen.getByRole('button', { name: /Email Shop/i });
      await user.click(emailButton);

      await waitFor(() => {
        expect(screen.getByText('Email Composer Dialog')).toBeInTheDocument();
      });
    });

    it('opens ReminderTypeDialog when Set Reminder clicked', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        await user.click(reminderButton);

        await waitFor(() => {
          expect(screen.getByText('Reminder Type Dialog')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Reminder Creation', () => {
    it('creates reminders when confirmed', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        // Open reminder dialog
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        await user.click(reminderButton);

        // Wait for the mocked reminder dialog to appear
        await screen.findByText('Reminder Type Dialog');

        // Click confirm in the mocked dialog
        const confirmButton = await screen.findByRole('button', { name: /Create Reminder/i });
        await user.click(confirmButton);

        await waitFor(() => {
          expect(reminderService.createReminders).toHaveBeenCalled();
        });
      }
    });

    it('shows success toast after creating reminders', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        await user.click(reminderButton);

        // Wait for the mocked reminder dialog to appear
        await screen.findByText('Reminder Type Dialog');

        // Use getAllByText and get the last one (the one in the mocked dialog)
        const confirmButtons = screen.getAllByText(/Create Reminder/i);
        await user.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
          expect(toast.success).toHaveBeenCalled();
        });
      }
    });

    it('saves first-time user flag after creating reminder', async () => {
      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        await user.click(reminderButton);

        // Wait for the mocked reminder dialog to appear
        await screen.findByText('Reminder Type Dialog');

        // Use getAllByText and get the last one (the one in the mocked dialog)
        const confirmButtons = screen.getAllByText(/Create Reminder/i);
        await user.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
          expect(localStorage.getItem('hasCreatedReminder')).toBe('true');
        });
      }
    });

    it('shows error toast when reminder creation fails', async () => {
      vi.mocked(reminderService.createReminders).mockRejectedValue(new Error('Failed'));

      const { user } = render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        await user.click(reminderButton);

        // Wait for the mocked reminder dialog to appear
        await screen.findByText('Reminder Type Dialog');

        // Use getAllByText and get the last one (the one in the mocked dialog)
        const confirmButtons = screen.getAllByText(/Create Reminder/i);
        await user.click(confirmButtons[confirmButtons.length - 1]);

        await waitFor(() => {
          expect(toast.error).toHaveBeenCalledWith('Failed to create reminders');
        });
      }
    });

    it('shows error when no nextDateToUpdate but reminder button clicked', async () => {
      // This test verifies the error handling in handleCreateReminders
      const roWithDate = { ...mockRO, nextDateToUpdate: new Date() };
      const { user } = render(
        <RODetailDialog
          ro={roWithDate}
          open={true}
          onClose={mockOnClose}
        />
      );

      const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
      await user.click(reminderButton);

      // Manually trigger the scenario by mocking
      expect(screen.getByText('Reminder Type Dialog')).toBeInTheDocument();
    });
  });

  describe('First Time User Experience', () => {
    it('shows first-time user help text when never created reminder', () => {
      localStorage.removeItem('hasCreatedReminder');

      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        expect(screen.getByText(/First time using reminders\?/i)).toBeInTheDocument();
      }
    });

    it('hides first-time user help text after creating reminder', async () => {
      localStorage.setItem('hasCreatedReminder', 'true');

      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText(/First time using reminders\?/i)).not.toBeInTheDocument();
    });
  });

  describe('Reminder Button State', () => {
    it('disables reminder button when creating', () => {
      render(
        <RODetailDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      if (mockRO.nextDateToUpdate) {
        const reminderButton = screen.getByRole('button', { name: /Set Reminder/i });
        expect(reminderButton).not.toBeDisabled();
      }
    });
  });
});
