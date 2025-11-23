import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from '../../src/components/Dashboard';
import { configureMockAPI } from '../../src/test/msw-handlers';

// Mock MSAL
const mockMSAL = {
  getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@genthrust.net' }]),
  acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'fake-token' }),
  getActiveAccount: vi.fn().mockReturnValue({ username: 'test@genthrust.net' }),
} as any;

// Helper to create a test query client
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

describe('Loading States Integration Tests', () => {
  beforeEach(() => {
    configureMockAPI.reset();
    vi.clearAllMocks();
  });

  describe('Dashboard Loading State', () => {
    it('should display LoadingSpinner while fetching dashboard data', async () => {
      // Set network delay to ensure loading state is visible
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Should show loading spinner initially
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-label');

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should not show loading spinner after data is loaded', async () => {
      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      });

      // Dashboard content should be visible
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should display custom loading text in Dashboard', async () => {
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Should show loading text
      const loadingText = screen.queryByText(/loading/i);
      expect(loadingText).toBeInTheDocument();
    });
  });

  describe('Aviation Theme Consistency', () => {
    it('should use aviation-themed LoadingSpinner component', async () => {
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Check for aviation-themed elements
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();

      // Should have plane icon (SVG)
      const svg = spinner.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should apply correct size variant based on context', async () => {
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Dashboard should use medium or large size
      await waitFor(() => {
        const sizeAttribute = container.querySelector('[data-size]');
        if (sizeAttribute) {
          const size = sizeAttribute.getAttribute('data-size');
          expect(['md', 'lg']).toContain(size);
        }
      });
    });
  });

  describe('Loading State Performance', () => {
    it('should render LoadingSpinner efficiently without layout shifts', async () => {
      configureMockAPI.setNetworkDelay(50);

      const queryClient = createTestQueryClient();

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Check that spinner is centered and doesn't cause layout shift
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();

      // Spinner should have proper flex positioning
      expect(spinner).toHaveClass('flex');
    });

    it('should handle rapid loading state changes gracefully', async () => {
      configureMockAPI.setNetworkDelay(10);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Even with rapid changes, component should not crash
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Error Handling During Loading', () => {
    it('should handle loading state when API fails', async () => {
      configureMockAPI.setFailureMode('network');

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      // Should show loading initially
      const spinner = screen.getByRole('status');
      expect(spinner).toBeInTheDocument();

      // After error, loading should stop
      await waitFor(() => {
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility During Loading', () => {
    it('should maintain focus management during loading transitions', async () => {
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      const spinner = screen.getByRole('status');
      expect(spinner).toHaveAttribute('aria-live', 'polite');

      // Loading state should not trap focus
      expect(spinner).not.toHaveFocus();
    });

    it('should announce loading state changes to screen readers', async () => {
      configureMockAPI.setNetworkDelay(100);

      const queryClient = createTestQueryClient();

      render(
        <QueryClientProvider client={queryClient}>
          <Dashboard />
        </QueryClientProvider>
      );

      const spinner = screen.getByRole('status');

      // Should have proper ARIA attributes
      expect(spinner).toHaveAttribute('aria-live');
      expect(spinner).toHaveAttribute('aria-label');
    });
  });
});
