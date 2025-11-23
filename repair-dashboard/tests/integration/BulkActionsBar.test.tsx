import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../test/test-utils';
import { BulkActionsBar } from '../../src/components/BulkActionsBar';

describe('BulkActionsBar', () => {
  const mockHandlers = {
    onClearSelection: vi.fn(),
    onMarkAsSent: vi.fn(),
    onRequestUpdates: vi.fn(),
    onExportSelected: vi.fn(),
  };

  it('does not render when no items selected', () => {
    const { container } = render(
      <BulkActionsBar
        selectedCount={0}
        {...mockHandlers}
      />
    );

    // Component should not be visible when selectedCount is 0
    expect(container.querySelector('.fixed')).not.toBeInTheDocument();
  });

  it('renders when items are selected', () => {
    render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('3 items selected')).toBeInTheDocument();
  });

  it('displays correct count with singular form', () => {
    render(
      <BulkActionsBar
        selectedCount={1}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('1 item selected')).toBeInTheDocument();
  });

  it('displays correct count with plural form', () => {
    render(
      <BulkActionsBar
        selectedCount={5}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('5 items selected')).toBeInTheDocument();
  });

  it('calls onClearSelection when clear button clicked', async () => {
    const { user } = render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    expect(mockHandlers.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onMarkAsSent when mark as sent button clicked', async () => {
    const { user } = render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    const markAsSentButton = screen.getByRole('button', { name: /mark as sent/i });
    await user.click(markAsSentButton);

    expect(mockHandlers.onMarkAsSent).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestUpdates when request updates button clicked', async () => {
    const { user } = render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    const requestUpdatesButton = screen.getByRole('button', { name: /request updates/i });
    await user.click(requestUpdatesButton);

    expect(mockHandlers.onRequestUpdates).toHaveBeenCalledTimes(1);
  });

  it('calls onExportSelected when export button clicked', async () => {
    const { user } = render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    const exportButton = screen.getByRole('button', { name: /export selected/i });
    await user.click(exportButton);

    expect(mockHandlers.onExportSelected).toHaveBeenCalledTimes(1);
  });

  it('renders all action buttons', () => {
    render(
      <BulkActionsBar
        selectedCount={3}
        {...mockHandlers}
      />
    );

    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as sent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request updates/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export selected/i })).toBeInTheDocument();
  });
});
