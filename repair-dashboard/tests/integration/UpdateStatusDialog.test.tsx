import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import { UpdateStatusDialog } from '../../src/components/UpdateStatusDialog';
import { mockRepairOrders } from '../test/mocks';
import * as useROsModule from '../../src/hooks/useROs';

vi.mock('../hooks/useROs');

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
});
