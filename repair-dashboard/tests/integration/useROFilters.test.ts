import { describe, it, expect } from 'vitest';
import { renderHook, act } from '../../src/test/test-utils';
import { useROFilters } from '../../src/hooks/useROFilters';
import { mockRepairOrders } from '../../src/test/mocks';

describe('useROFilters', () => {
  it('initially returns all repair orders when no filters are active', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    expect(result.current.filteredROs).toHaveLength(2);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('filters overdue repair orders', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('overdue', true);
    });

    expect(result.current.filteredROs).toHaveLength(1);
    expect(result.current.filteredROs[0].roNumber).toBe('RO-002');
    expect(result.current.activeFilterCount).toBe(1);
  });

  it('filters high value repair orders', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('highValue', true);
    });

    // Only RO-001 has estimatedCost > 5000
    expect(result.current.filteredROs).toHaveLength(1);
    expect(result.current.filteredROs[0].roNumber).toBe('RO-001');
  });

  it('filters waiting for quote orders', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('waitingAction', true);
    });

    expect(result.current.filteredROs).toHaveLength(1);
    expect(result.current.filteredROs[0].roNumber).toBe('RO-002');
  });

  it('combines multiple filters with AND logic', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('overdue', true);
      result.current.setFilter('waitingAction', true);
    });

    // RO-002 is both overdue and waiting for quote
    expect(result.current.filteredROs).toHaveLength(1);
    expect(result.current.filteredROs[0].roNumber).toBe('RO-002');
    expect(result.current.activeFilterCount).toBe(2);
  });

  it('clears all filters', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('overdue', true);
      result.current.setFilter('highValue', true);
    });

    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.filteredROs).toHaveLength(2);
  });

  it('handles empty repair orders array', () => {
    const { result } = renderHook(() => useROFilters([]));

    expect(result.current.filteredROs).toHaveLength(0);
    expect(result.current.activeFilterCount).toBe(0);
  });

  it('updates filters correctly when toggling on and off', () => {
    const { result } = renderHook(() => useROFilters(mockRepairOrders));

    act(() => {
      result.current.setFilter('overdue', true);
    });
    expect(result.current.filters.overdue).toBe(true);

    act(() => {
      result.current.setFilter('overdue', false);
    });
    expect(result.current.filters.overdue).toBe(false);
    expect(result.current.filteredROs).toHaveLength(2);
  });
});
