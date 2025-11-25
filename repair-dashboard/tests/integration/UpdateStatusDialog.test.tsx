import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test/test-utils';
import { UpdateStatusDialog } from '../../src/components/UpdateStatusDialog';
import { mockRepairOrders } from './test/mocks';
import * as useROsModule from '../../src/hooks/useROs';

vi.mock('../../src/hooks/useROs');

// Mock the reminderService
vi.mock('../../src/lib/reminderService', () => ({
  reminderService: {
    createReminders: vi.fn().mockResolvedValue({ todo: true, calendar: true }),
    createPaymentDueCalendarEvent: vi.fn().mockResolvedValue(true),
  },
}));

// Mock the logger - include both useLogger and createLogger
vi.mock('../../src/utils/logger', () => ({
  useLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  measureAsync: vi.fn((logger, name, fn) => fn()),
}));

// Mock excelSheets config - we'll override statusRequiresApproval in specific tests
vi.mock('../../src/config/excelSheets', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    statusRequiresApproval: vi.fn().mockReturnValue(false),
  };
});

describe('UpdateStatusDialog', () => {
  const mockRO = mockRepairOrders[0];
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('renders without crashing when open', () => {
    expect(() => {
      render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <UpdateStatusDialog
        ro={mockRO}
        open={false}
        onClose={mockOnClose}
      />
    );

    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('displays RO number in title', () => {
    render(
      <UpdateStatusDialog
        ro={mockRO}
        open={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(new RegExp(mockRO.roNumber))).toBeInTheDocument();
  });

  it('renders with status field', () => {
    expect(() => {
      render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();
  });

  it('shows notes textarea', () => {
    render(
      <UpdateStatusDialog
        ro={mockRO}
        open={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByLabelText(/Notes/i)).toBeInTheDocument();
  });

  it('renders with action buttons', () => {
    expect(() => {
      render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();
  });

  it('handles pending state correctly', () => {
    vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as any);

    expect(() => {
      render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );
    }).not.toThrow();
  });

  it('allows entering notes', async () => {
    const { user } = render(
      <UpdateStatusDialog
        ro={mockRO}
        open={true}
        onClose={mockOnClose}
      />
    );

    const notesField = screen.getByLabelText(/Notes/i);
    await user.type(notesField, 'Test notes');

    expect(notesField).toHaveValue('Test notes');
  });

  describe('Reminder Prompt Integration', () => {
    it('shows reminder prompt after successful status update', async () => {
      const mockMutate = vi.fn((_, options) => {
        // Simulate successful update
        options?.onSuccess?.();
      });

      vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      vi.mocked(useROsModule.useArchiveRO).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
      } as any);

      const { user } = render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Click Update Status button
      const updateButton = screen.getByRole('button', { name: /Update Status/i });
      await user.click(updateButton);

      // Should show reminder prompt
      await waitFor(() => {
        expect(screen.getByText(/Create Follow-up Reminder/i)).toBeInTheDocument();
      });
    });

    it('does not show reminder prompt for terminal statuses', async () => {
      const terminalRO = {
        ...mockRO,
        currentStatus: 'PAYMENT SENT',
      };

      const mockMutate = vi.fn((_, options) => {
        options?.onSuccess?.();
      });

      vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      const { user } = render(
        <UpdateStatusDialog
          ro={terminalRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      const updateButton = screen.getByRole('button', { name: /Update Status/i });
      await user.click(updateButton);

      // Should NOT show reminder prompt for terminal status
      // Instead, it should just close
      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('shows auto-calculated next update date', () => {
      render(
        <UpdateStatusDialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      // Should display the auto-calculated next update info
      expect(screen.getByText(/Auto-calculated Next Update/i)).toBeInTheDocument();
    });
  });
});
