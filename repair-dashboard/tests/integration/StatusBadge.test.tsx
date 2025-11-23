import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/test-utils';
import { StatusBadge } from '../../src/components/StatusBadge';

describe('StatusBadge', () => {
  it('renders received status correctly', () => {
    render(<StatusBadge status="RECEIVED" isOverdue={false} />);
    expect(screen.getByText('RECEIVED')).toBeInTheDocument();
  });

  it('renders in progress status correctly', () => {
    render(<StatusBadge status="IN PROGRESS" isOverdue={false} />);
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('renders waiting for quote status correctly', () => {
    render(<StatusBadge status="WAITING FOR QUOTE" isOverdue={false} />);
    expect(screen.getByText('WAITING FOR QUOTE')).toBeInTheDocument();
  });

  it('renders complete status correctly', () => {
    render(<StatusBadge status="COMPLETE" isOverdue={false} />);
    expect(screen.getByText('COMPLETE')).toBeInTheDocument();
  });

  it('renders to send status correctly', () => {
    render(<StatusBadge status="TO SEND" isOverdue={false} />);
    expect(screen.getByText('TO SEND')).toBeInTheDocument();
  });

  it('applies overdue styling when isOverdue is true', () => {
    const { container } = render(<StatusBadge status="IN PROGRESS" isOverdue={true} />);
    const badge = container.querySelector('.bg-red-100');
    expect(badge).toBeInTheDocument();
  });

  it('does not apply overdue styling when isOverdue is false', () => {
    const { container } = render(<StatusBadge status="IN PROGRESS" isOverdue={false} />);
    const badge = container.querySelector('.bg-red-100');
    expect(badge).not.toBeInTheDocument();
  });

  it('renders unknown status with default styling', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" isOverdue={false} />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });
});
