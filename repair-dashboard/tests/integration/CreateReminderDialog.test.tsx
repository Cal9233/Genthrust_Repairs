import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from './test/test-utils';
import { CreateReminderDialog } from '../../src/components/CreateReminderDialog';

// Mock the reminderService
vi.mock('../../src/lib/reminderService', () => ({
  reminderService: {
    createReminders: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
  useLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { reminderService } from '../../src/lib/reminderService';

describe('CreateReminderDialog', () => {
  const mockOnClose = vi.fn();
  const mockProps = {
    open: true,
    onClose: mockOnClose,
    roNumber: 'RO-123',
    shopName: 'Test Shop',
    status: 'WAITING QUOTE',
    nextDateToUpdate: new Date('2024-12-15'),
    partDescription: 'Test Part',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reminderService.createReminders).mockResolvedValue({
      todo: true,
      calendar: true,
    });
  });

  describe('Rendering', () => {
    it('renders dialog when open', () => {
      render(<CreateReminderDialog {...mockProps} />);

      expect(screen.getByText(/Create Follow-up Reminder/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      const { container } = render(
        <CreateReminderDialog {...mockProps} open={false} />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('displays status in description', () => {
      render(<CreateReminderDialog {...mockProps} />);

      expect(screen.getByText(mockProps.status)).toBeInTheDocument();
    });

    it('displays formatted due date', () => {
      render(<CreateReminderDialog {...mockProps} />);

      // Should show "Due Date" label
      expect(screen.getByText(/Due Date/i)).toBeInTheDocument();
    });

    it('renders Microsoft To Do option', () => {
      render(<CreateReminderDialog {...mockProps} />);

      expect(screen.getByText(/Microsoft To Do/i)).toBeInTheDocument();
    });

    it('renders Outlook Calendar option', () => {
      render(<CreateReminderDialog {...mockProps} />);

      expect(screen.getByText(/Outlook Calendar/i)).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      render(<CreateReminderDialog {...mockProps} />);

      expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create Reminder/i })).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('has both options selected by default', () => {
      render(<CreateReminderDialog {...mockProps} />);

      // Button text should be plural
      expect(screen.getByRole('button', { name: /Create Reminders/i })).toBeInTheDocument();
    });

    it('toggles To Do option when clicked', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const todoOption = screen.getByText(/Microsoft To Do/i).closest('button');
      await user.click(todoOption!);

      // After clicking, only one should be selected, so singular form
      expect(screen.getByRole('button', { name: /^Create Reminder$/i })).toBeInTheDocument();
    });

    it('toggles Calendar option when clicked', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const calendarOption = screen.getByText(/Outlook Calendar/i).closest('button');
      await user.click(calendarOption!);

      // After clicking, only one should be selected, so singular form
      expect(screen.getByRole('button', { name: /^Create Reminder$/i })).toBeInTheDocument();
    });
  });

  describe('Create Reminders', () => {
    it('calls reminderService.createReminders when Create button clicked', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(reminderService.createReminders).toHaveBeenCalledWith(
          expect.objectContaining({
            roNumber: mockProps.roNumber,
            shopName: mockProps.shopName,
            title: expect.stringContaining(mockProps.status),
          }),
          { todo: true, calendar: true }
        );
      });
    });

    it('calls onClose after successful creation', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('shows loading state during creation', async () => {
      // Make the createReminders call hang
      vi.mocked(reminderService.createReminders).mockImplementation(
        () => new Promise(() => {})
      );

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      expect(screen.getByText(/Creating.../i)).toBeInTheDocument();
    });

    it('creates only To Do when calendar deselected', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      // Deselect calendar
      const calendarOption = screen.getByText(/Outlook Calendar/i).closest('button');
      await user.click(calendarOption!);

      const createButton = screen.getByRole('button', { name: /^Create Reminder$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(reminderService.createReminders).toHaveBeenCalledWith(
          expect.anything(),
          { todo: true, calendar: false }
        );
      });
    });

    it('creates only Calendar when To Do deselected', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      // Deselect To Do
      const todoOption = screen.getByText(/Microsoft To Do/i).closest('button');
      await user.click(todoOption!);

      const createButton = screen.getByRole('button', { name: /^Create Reminder$/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(reminderService.createReminders).toHaveBeenCalledWith(
          expect.anything(),
          { todo: false, calendar: true }
        );
      });
    });
  });

  describe('Skip Functionality', () => {
    it('calls onClose when Skip button clicked', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await user.click(skipButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not call createReminders when Skip clicked', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await user.click(skipButton);

      expect(reminderService.createReminders).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('shows error message when creation fails', async () => {
      vi.mocked(reminderService.createReminders).mockRejectedValue(
        new Error('Network error')
      );

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('shows retry button when error is retryable', async () => {
      vi.mocked(reminderService.createReminders).mockRejectedValue(
        new Error('Server error')
      );

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Retry/i)).toBeInTheDocument();
      });
    });

    it('retries when Retry button clicked', async () => {
      vi.mocked(reminderService.createReminders)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ todo: true, calendar: true });

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      // First attempt - fails
      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Retry/i)).toBeInTheDocument();
      });

      // Retry - succeeds
      const retryButton = screen.getByText(/Retry/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(reminderService.createReminders).toHaveBeenCalledTimes(2);
      });
    });

    it('handles partial failure (To Do fails, Calendar succeeds)', async () => {
      vi.mocked(reminderService.createReminders).mockResolvedValue({
        todo: false,
        calendar: true,
      });

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      // Should show error for partial failure - the error message says "Failed to create To Do reminder"
      await waitFor(() => {
        expect(screen.getByText(/Failed to create To Do reminder/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('disables Create button when no options selected', async () => {
      const { user } = render(<CreateReminderDialog {...mockProps} />);

      // Deselect both options
      const todoOption = screen.getByText(/Microsoft To Do/i).closest('button');
      const calendarOption = screen.getByText(/Outlook Calendar/i).closest('button');

      await user.click(todoOption!);
      await user.click(calendarOption!);

      const createButton = screen.getByRole('button', { name: /Create Reminder/i });
      expect(createButton).toBeDisabled();
    });

    it('disables options during creation', async () => {
      vi.mocked(reminderService.createReminders).mockImplementation(
        () => new Promise(() => {})
      );

      const { user } = render(<CreateReminderDialog {...mockProps} />);

      const createButton = screen.getByRole('button', { name: /Create Reminders/i });
      await user.click(createButton);

      const todoOption = screen.getByText(/Microsoft To Do/i).closest('button');
      expect(todoOption).toBeDisabled();
    });
  });
});
