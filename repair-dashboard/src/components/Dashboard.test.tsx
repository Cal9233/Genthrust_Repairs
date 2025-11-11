import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import { Dashboard } from './Dashboard';
import * as useROsModule from '../hooks/useROs';

vi.mock('../hooks/useROs');

describe('Dashboard', () => {
  const mockStats = {
    totalActive: 25,
    overdue: 5,
    waitingQuote: 7,
    approved: 4,
    beingRepaired: 12,
    shipping: 3,
    totalValue: 125000,
    dueToday: 2,
    overdue30Plus: 1,
    onTrack: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: mockStats,
      isLoading: false,
    } as any);
  });

  it('renders loading state', () => {
    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(<Dashboard />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('renders null when no stats available', () => {
    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    const { container } = render(<Dashboard />);

    expect(container.firstChild).toBeNull();
  });

  it('displays total active ROs', () => {
    render(<Dashboard />);

    expect(screen.getByText('Active ROs')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('displays overdue count', () => {
    render(<Dashboard />);

    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays due today count', () => {
    render(<Dashboard />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays being repaired count', () => {
    render(<Dashboard />);

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('displays shipping count', () => {
    render(<Dashboard />);

    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('displays waiting quote count', () => {
    render(<Dashboard />);

    expect(screen.getByText('Waiting Quote')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('displays on track count', () => {
    render(<Dashboard />);

    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('displays total value formatted as currency', () => {
    render(<Dashboard />);

    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('$125,000')).toBeInTheDocument();
  });

  it('applies red styling to overdue card when overdue count > 0', () => {
    const { container } = render(<Dashboard />);

    const overdueCard = screen.getByText('Overdue').closest('.border-red-200');
    expect(overdueCard).toBeInTheDocument();
  });

  it('applies gray styling to overdue card when overdue count is 0', () => {
    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: { ...mockStats, overdue: 0 },
      isLoading: false,
    } as any);

    const { container } = render(<Dashboard />);

    const overdueCard = screen.getByText('Overdue').closest('.border-gray-200');
    expect(overdueCard).toBeInTheDocument();
  });

  it('displays key stat cards', () => {
    render(<Dashboard />);

    const statTitles = [
      'Active ROs',
      'Overdue',
      'Waiting Quote',
      'Shipping',
      'Total Value',
    ];

    statTitles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });

  it('formats large currency values correctly', () => {
    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: { ...mockStats, totalValue: 1234567 },
      isLoading: false,
    } as any);

    render(<Dashboard />);

    expect(screen.getByText('$1,234,567')).toBeInTheDocument();
  });

  it('handles zero values correctly', () => {
    vi.mocked(useROsModule.useDashboardStats).mockReturnValue({
      data: {
        totalActive: 0,
        overdue: 0,
        waitingQuote: 0,
        approved: 0,
        beingRepaired: 0,
        shipping: 0,
        totalValue: 0,
        dueToday: 0,
        overdue30Plus: 0,
        onTrack: 0,
      },
      isLoading: false,
    } as any);

    render(<Dashboard />);

    expect(screen.getByText('$0')).toBeInTheDocument();
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThan(0);
  });
});
