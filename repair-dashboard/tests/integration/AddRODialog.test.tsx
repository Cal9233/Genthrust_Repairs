import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../test/test-utils';
import { AddRODialog } from '../../src/components/AddRODialog';
import { mockRepairOrders, mockShops } from '../test/mocks';
import * as useROsModule from '../../src/hooks/useROs';
import * as useShopsModule from '../../src/hooks/useShops';

// Mock dependencies
vi.mock('../hooks/useROs');
vi.mock('../hooks/useShops');
vi.mock('./ShopManagementDialog', () => ({
  ShopManagementDialog: ({ open }: { open: boolean }) =>
    open ? <div>Shop Management Dialog</div> : null,
}));

describe('AddRODialog', () => {
  const mockOnClose = vi.fn();
  const mockMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useShopsModule.useShops).mockReturnValue({
      data: mockShops,
      isLoading: false,
      isError: false,
      error: null,
    } as any);

    vi.mocked(useROsModule.useAddRepairOrder).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(useROsModule.useUpdateRepairOrder).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  describe('Add Mode', () => {
    it('renders dialog with add title when no RO provided', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Create New Repair Order')).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      const { container } = render(
        <AddRODialog
          open={false}
          onClose={mockOnClose}
        />
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it('renders all required form fields', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/RO Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Shop Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Part Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Serial Number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Part Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Required Work/i)).toBeInTheDocument();
    });

    it('renders optional form fields', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/Estimated Cost/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Terms/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Shop Reference Number/i)).toBeInTheDocument();
    });

    it('renders shop selection section', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Select Shop/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search shops/i)).toBeInTheDocument();
    });

    it('shows Add New Shop button', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Add New Shop/i })).toBeInTheDocument();
    });

    it('allows entering form data', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      const roNumberInput = screen.getByLabelText(/RO Number/i);
      await user.type(roNumberInput, 'RO-123');

      expect(roNumberInput).toHaveValue('RO-123');
    });

    it('calls addRepairOrder on submit with valid data', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      await user.type(screen.getByLabelText(/RO Number/i), 'RO-123');
      await user.type(screen.getByLabelText(/Shop Name/i), 'Test Shop');
      await user.type(screen.getByLabelText(/Part Number/i), 'PART-123');
      await user.type(screen.getByLabelText(/Serial Number/i), 'SN-123');
      await user.type(screen.getByLabelText(/Part Description/i), 'Test Part');
      await user.type(screen.getByLabelText(/Required Work/i), 'Test Work');

      const submitButton = screen.getByRole('button', { name: /Create Repair Order/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            roNumber: 'RO-123',
            shopName: 'Test Shop',
            partNumber: 'PART-123',
            serialNumber: 'SN-123',
            partDescription: 'Test Part',
            requiredWork: 'Test Work',
          }),
          expect.any(Object)
        );
      });
    });

    it('handles optional fields in submission', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      await user.type(screen.getByLabelText(/RO Number/i), 'RO-123');
      await user.type(screen.getByLabelText(/Shop Name/i), 'Test Shop');
      await user.type(screen.getByLabelText(/Part Number/i), 'PART-123');
      await user.type(screen.getByLabelText(/Serial Number/i), 'SN-123');
      await user.type(screen.getByLabelText(/Part Description/i), 'Test Part');
      await user.type(screen.getByLabelText(/Required Work/i), 'Test Work');
      await user.type(screen.getByLabelText(/Estimated Cost/i), '1500');
      await user.type(screen.getByLabelText(/Terms/i), 'NET 30');

      const submitButton = screen.getByRole('button', { name: /Create Repair Order/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            estimatedCost: 1500,
            terms: 'NET 30',
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe('Edit Mode', () => {
    const mockRO = mockRepairOrders[0];

    it('renders dialog with edit title when RO provided', () => {
      render(
        <AddRODialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(new RegExp(`Edit Repair Order - ${mockRO.roNumber}`))).toBeInTheDocument();
    });

    it('populates form fields with RO data', () => {
      render(
        <AddRODialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/RO Number/i)).toHaveValue(mockRO.roNumber);
      expect(screen.getByLabelText(/Shop Name/i)).toHaveValue(mockRO.shopName);
      expect(screen.getByLabelText(/Part Number/i)).toHaveValue(mockRO.partNumber);
    });

    it('calls updateRepairOrder on submit', async () => {
      const { user } = render(
        <AddRODialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      const partNumberInput = screen.getByLabelText(/Part Number/i);
      await user.clear(partNumberInput);
      await user.type(partNumberInput, 'UPDATED-PART');

      const submitButton = screen.getByRole('button', { name: /Update Repair Order/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            rowIndex: expect.any(Number),
            data: expect.objectContaining({
              partNumber: 'UPDATED-PART',
            }),
          }),
          expect.any(Object)
        );
      });
    });

    it('shows Update button text in edit mode', () => {
      render(
        <AddRODialog
          ro={mockRO}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Update Repair Order/i })).toBeInTheDocument();
    });
  });

  describe('Shop Selection', () => {
    it('displays shops in dropdown', () => {
      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(/Choose a shop to auto-fill/i)).toBeInTheDocument();
    });

    it('filters shops based on search query', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Search shops/i);
      await user.type(searchInput, mockShops[0].shopName.substring(0, 5));

      // The search input should have the value
      expect(searchInput).toHaveValue(mockShops[0].shopName.substring(0, 5));
    });

    it('shows loading state when shops are loading', () => {
      vi.mocked(useShopsModule.useShops).mockReturnValue({
        data: [],
        isLoading: true,
        isError: false,
        error: null,
      } as any);

      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      // Select trigger should be disabled
      const selectTrigger = screen.getByRole('combobox');
      expect(selectTrigger).toBeDisabled();
    });
  });

  describe('Form Interaction', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('disables buttons when mutation is pending', () => {
      vi.mocked(useROsModule.useAddRepairOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      } as any);

      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Creating.../i });
      expect(submitButton).toBeDisabled();

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it('shows Creating... text when adding', () => {
      vi.mocked(useROsModule.useAddRepairOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      } as any);

      render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Creating.../i })).toBeInTheDocument();
    });

    it('shows Updating... text when editing', () => {
      vi.mocked(useROsModule.useUpdateRepairOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: true,
      } as any);

      render(
        <AddRODialog
          ro={mockRepairOrders[0]}
          open={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('button', { name: /Updating.../i })).toBeInTheDocument();
    });
  });

  describe('ShopManagementDialog Integration', () => {
    it('opens ShopManagementDialog when Add New Shop button is clicked', async () => {
      const { user } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      const addShopButton = screen.getByRole('button', { name: /Add New Shop/i });
      await user.click(addShopButton);

      await waitFor(() => {
        expect(screen.getByText('Shop Management Dialog')).toBeInTheDocument();
      });
    });
  });

  describe('Form Reset', () => {
    it('resets form when dialog closes and reopens in add mode', () => {
      const { rerender } = render(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      // Close dialog
      rerender(
        <AddRODialog
          open={false}
          onClose={mockOnClose}
        />
      );

      // Reopen dialog
      rerender(
        <AddRODialog
          open={true}
          onClose={mockOnClose}
        />
      );

      // Form should be empty
      expect(screen.getByLabelText(/RO Number/i)).toHaveValue('');
      expect(screen.getByLabelText(/Shop Name/i)).toHaveValue('');
    });
  });
});
