import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { ROTable } from './ROTable';
import { mockRepairOrders, mockShops } from '../test/mocks';
import * as useROsModule from '../hooks/useROs';
import * as useShopsModule from '../hooks/useShops';
import * as useROFiltersModule from '../hooks/useROFilters';

// Mock the hooks
vi.mock('../hooks/useROs');
vi.mock('../hooks/useShops');
vi.mock('../hooks/useROFilters');

describe('ROTable Integration Tests', () => {
  beforeEach(() => {
    // Setup default mock implementations
    vi.mocked(useROsModule.useROs).mockReturnValue({
      data: mockRepairOrders,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useROsModule.useUpdateROStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useROsModule.useBulkUpdateStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useROsModule.useDeleteRepairOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useROsModule.useAddRepairOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useROsModule.useUpdateRepairOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: mockShops,
      isLoading: false,
    } as any);

    vi.mocked(useShopsModule.useAddShop).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useShopsModule.useUpdateShop).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useROFiltersModule.useROFilters).mockReturnValue({
      filters: {
        overdue: false,
        dueThisWeek: false,
        highValue: false,
        shop: null,
        waitingAction: false,
      },
      setFilter: vi.fn(),
      clearFilters: vi.fn(),
      filteredROs: mockRepairOrders,
      activeFilterCount: 0,
    });
  });

  it('renders loading state', () => {
    vi.mocked(useROsModule.useROs).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<ROTable />);
    expect(screen.getByText('Loading repair orders...')).toBeInTheDocument();
  });

  it('renders repair orders table', async () => {
    render(<ROTable />);

    await waitFor(() => {
      expect(screen.getByText('RO-001')).toBeInTheDocument();
      expect(screen.getByText('RO-002')).toBeInTheDocument();
      expect(screen.getByText('Test Shop A')).toBeInTheDocument();
      expect(screen.getByText('Test Shop B')).toBeInTheDocument();
    });
  });

  it('displays correct count of repair orders', async () => {
    render(<ROTable />);

    await waitFor(() => {
      expect(screen.getByText('2 of 2 ROs')).toBeInTheDocument();
    });
  });

  it('filters repair orders by search term', async () => {
    render(<ROTable />);

    const searchInput = screen.getByPlaceholderText('Search ROs, shops, parts...');
    expect(searchInput).toBeInTheDocument();

    // Note: Testing actual filtering requires integration with real useROFilters
    // This test verifies the search input exists and is functional
  });

  it('handles numeric roNumber in search', async () => {
    // Create a repair order with numeric roNumber
    const numericRO = {
      ...mockRepairOrders[0],
      roNumber: 123 as any, // Simulate numeric roNumber from Excel
    };

    vi.mocked(useROsModule.useROs).mockReturnValue({
      data: [numericRO],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useROFiltersModule.useROFilters).mockReturnValue({
      filters: {
        overdue: false,
        dueThisWeek: false,
        highValue: false,
        shop: null,
        waitingAction: false,
      },
      setFilter: vi.fn(),
      clearFilters: vi.fn(),
      filteredROs: [numericRO],
      activeFilterCount: 0,
    });

    render(<ROTable />);

    // This should not crash even though roNumber is a number
    await waitFor(() => {
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('displays overdue badge for overdue orders', async () => {
    render(<ROTable />);

    await waitFor(() => {
      expect(screen.getByText('5 days overdue')).toBeInTheDocument();
    });
  });

  it('shows filter buttons', () => {
    render(<ROTable />);

    expect(screen.getByText('🔴 Overdue')).toBeInTheDocument();
    expect(screen.getByText('⏰ Due This Week')).toBeInTheDocument();
    expect(screen.getByText('💰 High Value ($5K+)')).toBeInTheDocument();
    expect(screen.getByText('📋 Waiting Quote')).toBeInTheDocument();
  });

  it('displays New RO button', () => {
    render(<ROTable />);

    expect(screen.getByText('New RO')).toBeInTheDocument();
  });

  it('shows View Details buttons for each RO', async () => {
    render(<ROTable />);

    await waitFor(() => {
      const viewDetailsButtons = screen.getAllByText('View Details');
      expect(viewDetailsButtons).toHaveLength(2);
    });
  });

  it('allows selecting multiple repair orders', async () => {
    const { user } = render(<ROTable />);

    await waitFor(() => {
      expect(screen.getByText('RO-001')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    const firstROCheckbox = checkboxes[1]; // First checkbox after "select all"

    await user.click(firstROCheckbox);

    // Check if bulk actions would be available (implementation dependent)
    expect(firstROCheckbox).toBeChecked();
  });
});
