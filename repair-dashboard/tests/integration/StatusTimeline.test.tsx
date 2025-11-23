import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { StatusTimeline } from '../../src/components/StatusTimeline';
import type { StatusHistoryEntry } from '../../src/types';

describe('StatusTimeline', () => {
  const mockHistory: StatusHistoryEntry[] = [
    {
      status: 'RECEIVED',
      date: new Date('2024-01-15T10:00:00'),
      user: 'John Doe',
      notes: 'Item received from shop',
    },
    {
      status: 'QUOTE SENT',
      date: new Date('2024-01-16T14:30:00'),
      user: 'Jane Smith',
      cost: 1500,
      notes: 'Quote sent to customer',
    },
    {
      status: 'APPROVED',
      date: new Date('2024-01-17T09:15:00'),
      user: 'Bob Johnson',
      deliveryDate: new Date('2024-02-01T00:00:00'),
      notes: 'Repair approved by customer',
    },
    {
      status: 'IN REPAIR',
      date: new Date('2024-01-18T11:00:00'),
      user: 'Alice Williams',
    },
  ];

  it('renders empty state when no history provided', () => {
    render(<StatusTimeline history={[]} />);

    expect(screen.getByText('No status history available')).toBeInTheDocument();
  });

  it('renders all history entries', () => {
    render(<StatusTimeline history={mockHistory} />);

    expect(screen.getByText('RECEIVED')).toBeInTheDocument();
    expect(screen.getByText('QUOTE SENT')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('IN REPAIR')).toBeInTheDocument();
  });

  it('displays history in reverse chronological order (most recent first)', () => {
    render(<StatusTimeline history={mockHistory} />);

    const statuses = screen.getAllByText(/RECEIVED|QUOTE SENT|APPROVED|IN REPAIR/);

    // Most recent should be first
    expect(statuses[0].textContent).toBe('IN REPAIR');
    expect(statuses[3].textContent).toBe('RECEIVED');
  });

  it('displays user information for each entry', () => {
    render(<StatusTimeline history={mockHistory} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(screen.getByText('Alice Williams')).toBeInTheDocument();
  });

  it('displays formatted dates', () => {
    render(<StatusTimeline history={mockHistory} />);

    // Check that dates are formatted (not exact match due to locale)
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Jan 16, 2024/)).toBeInTheDocument();
  });

  it('displays cost when provided', () => {
    render(<StatusTimeline history={mockHistory} />);

    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('displays delivery date when provided', () => {
    render(<StatusTimeline history={mockHistory} />);

    expect(screen.getByText(/Delivery:.*Feb 1, 2024/)).toBeInTheDocument();
  });

  it('displays notes when provided', () => {
    render(<StatusTimeline history={mockHistory} />);

    expect(screen.getByText('Item received from shop')).toBeInTheDocument();
    expect(screen.getByText('Quote sent to customer')).toBeInTheDocument();
    expect(screen.getByText('Repair approved by customer')).toBeInTheDocument();
  });

  it('does not display additional details section when no cost, delivery date, or notes', () => {
    const historyWithoutDetails: StatusHistoryEntry[] = [
      {
        status: 'IN PROGRESS',
        date: new Date('2024-01-20'),
        user: 'Test User',
      },
    ];

    const { container } = render(<StatusTimeline history={historyWithoutDetails} />);

    // Check that there's no border-t (separator for additional details)
    const detailsSection = container.querySelector('.border-t');
    expect(detailsSection).not.toBeInTheDocument();
  });

  it('renders timeline connecting lines between entries', () => {
    const { container } = render(<StatusTimeline history={mockHistory} />);

    // Timeline lines should exist (except for the last entry)
    const timelineLines = container.querySelectorAll('.bg-gray-200');
    expect(timelineLines.length).toBeGreaterThan(0);
  });

  it('applies correct color class for different status types', () => {
    const statusTypes: StatusHistoryEntry[] = [
      { status: 'TO SEND', date: new Date(), user: 'User' },
      { status: 'WAITING QUOTE', date: new Date(), user: 'User' },
      { status: 'APPROVED', date: new Date(), user: 'User' },
      { status: 'IN REPAIR', date: new Date(), user: 'User' },
      { status: 'SHIPPING', date: new Date(), user: 'User' },
      { status: 'PAID', date: new Date(), user: 'User' },
    ];

    const { container } = render(<StatusTimeline history={statusTypes} />);

    // Check that different colored badges are present
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-purple-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-orange-500')).toBeInTheDocument();
    expect(container.querySelector('.bg-emerald-500')).toBeInTheDocument();
  });

  it('handles single entry correctly', () => {
    const singleEntry: StatusHistoryEntry[] = [
      {
        status: 'RECEIVED',
        date: new Date('2024-01-15'),
        user: 'Test User',
        notes: 'Single entry test',
      },
    ];

    render(<StatusTimeline history={singleEntry} />);

    expect(screen.getByText('RECEIVED')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Single entry test')).toBeInTheDocument();
  });

  it('formats currency correctly for different amounts', () => {
    const historyWithCosts: StatusHistoryEntry[] = [
      {
        status: 'QUOTE 1',
        date: new Date('2024-01-15'),
        user: 'User',
        cost: 100.50,
      },
      {
        status: 'QUOTE 2',
        date: new Date('2024-01-16'),
        user: 'User',
        cost: 10000,
      },
    ];

    render(<StatusTimeline history={historyWithCosts} />);

    expect(screen.getByText('$100.50')).toBeInTheDocument();
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
  });
});
