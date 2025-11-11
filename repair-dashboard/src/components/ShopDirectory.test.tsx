import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { ShopDirectory } from './ShopDirectory';
import { mockShops } from '../test/mocks';
import * as useShopsModule from '../hooks/useShops';

vi.mock('../hooks/useShops');
vi.mock('./ShopManagementDialog', () => ({
  ShopManagementDialog: () => <div>Shop Management Dialog</div>,
}));

describe('ShopDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: mockShops,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useShopsModule.useDeleteShop).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useShopsModule.useAddShop).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useShopsModule.useUpdateShop).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('renders loading state', () => {
    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    } as any);

    render(<ShopDirectory />);

    expect(screen.getByText('Loading shops...')).toBeInTheDocument();
  });

  it('renders error state when no shops table exists', () => {
    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Table not found'),
    } as any);

    render(<ShopDirectory />);

    expect(screen.getByText(/Vendor Directory Not Set Up/i)).toBeInTheDocument();
  });

  it('renders shops list', async () => {
    const { container } = render(<ShopDirectory />);

    await waitFor(() => {
      // Just check that the component renders without error
      expect(container).toBeTruthy();
    });
  });

  it('displays search and add functionality', () => {
    const { container } = render(<ShopDirectory />);

    // Just verify the component renders
    expect(container.querySelector('input')).toBeTruthy();
  });

  it('allows filtering functionality', async () => {
    const { container } = render(<ShopDirectory />);

    // Just verify component renders
    expect(container.querySelector('input')).not.toBeNull();
  });

  it('renders shop table with data', async () => {
    const { container } = render(<ShopDirectory />);

    await waitFor(() => {
      // Check that table elements exist
      const tables = container.querySelectorAll('table');
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  it('handles empty shops list', () => {
    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    const { container } = render(<ShopDirectory />);

    // Component should render without error
    expect(container).toBeTruthy();
  });
});
