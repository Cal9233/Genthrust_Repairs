import { describe, it, expect } from 'vitest';
import {
  generateQuoteRequestEmail,
  generateFollowUpEmail,
  generateApprovalEmail,
  generateExpeditedRequestEmail,
  generateReceiptConfirmationEmail,
  getAvailableTemplates,
  generateEmail,
} from './emailTemplates';
import { mockRepairOrders, mockShops } from '../test/mocks';
import type { RepairOrder, Shop } from '../types';

describe('emailTemplates', () => {
  const mockRO: RepairOrder = mockRepairOrders[0];
  const mockShop: Shop = mockShops[0];

  describe('generateQuoteRequestEmail', () => {
    it('generates email with correct recipient', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      expect(result.to).toBe(mockShop.email);
    });

    it('includes RO number in subject', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      expect(result.subject).toContain(mockRO.roNumber);
    });

    it('includes part description in subject', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      expect(result.subject).toContain(mockRO.partDescription);
    });

    it('includes all repair order details in body', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      expect(result.body).toContain(mockRO.roNumber);
      expect(result.body).toContain(mockRO.partDescription);
      expect(result.body).toContain(mockRO.partNumber);
      expect(result.body).toContain(mockRO.serialNumber);
    });

    it('addresses contact person by name if available', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      expect(result.body).toContain(mockShop.contactName);
    });

    it('uses default greeting when no shop provided', () => {
      const result = generateQuoteRequestEmail(mockRO, null);

      expect(result.body).toContain('Sir/Madam');
    });

    it('includes shop reference number if provided', () => {
      const result = generateQuoteRequestEmail(mockRO, mockShop);

      if (mockRO.shopReferenceNumber) {
        expect(result.body).toContain(mockRO.shopReferenceNumber);
      }
    });
  });

  describe('generateFollowUpEmail', () => {
    it('generates email with correct recipient', () => {
      const result = generateFollowUpEmail(mockRO, mockShop);

      expect(result.to).toBe(mockShop.email);
    });

    it('includes RO number in subject', () => {
      const result = generateFollowUpEmail(mockRO, mockShop);

      expect(result.subject).toContain(mockRO.roNumber);
    });

    it('includes current status in body', () => {
      const result = generateFollowUpEmail(mockRO, mockShop);

      expect(result.body).toContain(mockRO.currentStatus);
    });

    it('formats last updated date', () => {
      const result = generateFollowUpEmail(mockRO, mockShop);

      expect(result.body).toContain('Last Updated:');
    });

    it('requests specific information', () => {
      const result = generateFollowUpEmail(mockRO, mockShop);

      expect(result.body).toContain('repair progress');
      expect(result.body).toContain('completion date');
    });
  });

  describe('generateApprovalEmail', () => {
    it('generates email with correct recipient', () => {
      const result = generateApprovalEmail(mockRO, mockShop);

      expect(result.to).toBe(mockShop.email);
    });

    it('includes approval indicator in subject', () => {
      const result = generateApprovalEmail(mockRO, mockShop);

      expect(result.subject).toContain('Approved');
    });

    it('includes estimated cost when available', () => {
      const result = generateApprovalEmail(mockRO, mockShop);

      if (mockRO.estimatedCost) {
        expect(result.body).toContain('$');
      }
    });

    it('includes payment terms', () => {
      const result = generateApprovalEmail(mockRO, mockShop);

      expect(result.body).toContain('Terms:');
    });

    it('requests confirmation', () => {
      const result = generateApprovalEmail(mockRO, mockShop);

      expect(result.body).toContain('Confirmation');
    });

    it('formats currency correctly', () => {
      const roWithCost = {
        ...mockRO,
        estimatedCost: 1234.56,
      };

      const result = generateApprovalEmail(roWithCost, mockShop);

      expect(result.body).toContain('$1,234.56');
    });
  });

  describe('generateExpeditedRequestEmail', () => {
    it('generates email with correct recipient', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.to).toBe(mockShop.email);
    });

    it('includes URGENT in subject', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.subject).toContain('URGENT');
    });

    it('mentions expedite in subject', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.subject).toContain('Expedite');
    });

    it('includes current status', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.body).toContain(mockRO.currentStatus);
    });

    it('mentions original delivery date', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.body).toContain('Original Expected Delivery');
    });

    it('requests expedited timeline information', () => {
      const result = generateExpeditedRequestEmail(mockRO, mockShop);

      expect(result.body).toContain('expedited');
      expect(result.body).toContain('prioritize');
    });
  });

  describe('generateReceiptConfirmationEmail', () => {
    it('generates email with correct recipient', () => {
      const result = generateReceiptConfirmationEmail(mockRO, mockShop);

      expect(result.to).toBe(mockShop.email);
    });

    it('includes confirmation in subject', () => {
      const result = generateReceiptConfirmationEmail(mockRO, mockShop);

      expect(result.subject).toContain('Confirmation');
    });

    it('confirms receipt in body', () => {
      const result = generateReceiptConfirmationEmail(mockRO, mockShop);

      expect(result.body).toContain('received');
    });

    it('thanks the shop', () => {
      const result = generateReceiptConfirmationEmail(mockRO, mockShop);

      expect(result.body).toContain('Thank you');
    });

    it('includes tracking number if available', () => {
      const roWithTracking = {
        ...mockRO,
        trackingNumber: 'TRACK123',
      };

      const result = generateReceiptConfirmationEmail(roWithTracking, mockShop);

      expect(result.body).toContain('TRACK123');
    });
  });

  describe('getAvailableTemplates', () => {
    it('returns Request Quote template for TO SEND status', () => {
      const result = getAvailableTemplates('TO SEND');

      expect(result).toContain('Request Quote');
      expect(result).toContain('Custom');
    });

    it('returns Status Update template for WAITING QUOTE status', () => {
      const result = getAvailableTemplates('WAITING QUOTE');

      expect(result).toContain('Request Status Update');
      expect(result).toContain('Custom');
    });

    it('returns appropriate templates for APPROVED status', () => {
      const result = getAvailableTemplates('APPROVED');

      expect(result).toContain('Request Status Update');
      expect(result).toContain('Expedite Request');
      expect(result).toContain('Custom');
    });

    it('returns appropriate templates for BEING REPAIRED status', () => {
      const result = getAvailableTemplates('BEING REPAIRED');

      expect(result).toContain('Request Status Update');
      expect(result).toContain('Expedite Request');
      expect(result).toContain('Custom');
    });

    it('returns Confirm Receipt template for SHIPPING status', () => {
      const result = getAvailableTemplates('SHIPPING');

      expect(result).toContain('Confirm Receipt');
      expect(result).toContain('Custom');
    });

    it('returns all templates for unknown status', () => {
      const result = getAvailableTemplates('UNKNOWN STATUS');

      expect(result.length).toBeGreaterThan(2);
      expect(result).toContain('Custom');
    });

    it('always includes Custom template', () => {
      const statuses = ['TO SEND', 'WAITING QUOTE', 'APPROVED', 'SHIPPING'];

      statuses.forEach((status) => {
        const result = getAvailableTemplates(status);
        expect(result).toContain('Custom');
      });
    });
  });

  describe('generateEmail', () => {
    it('generates quote request for Request Quote template', () => {
      const result = generateEmail('Request Quote', mockRO, mockShop);

      expect(result.subject).toContain('Quote Request');
    });

    it('generates follow-up for Request Status Update template', () => {
      const result = generateEmail('Request Status Update', mockRO, mockShop);

      expect(result.subject).toContain('Status Update Request');
    });

    it('generates approval for Approve Repair template', () => {
      const result = generateEmail('Approve Repair', mockRO, mockShop);

      expect(result.subject).toContain('Approved');
    });

    it('generates expedited request for Expedite Request template', () => {
      const result = generateEmail('Expedite Request', mockRO, mockShop);

      expect(result.subject).toContain('URGENT');
    });

    it('generates receipt confirmation for Confirm Receipt template', () => {
      const result = generateEmail('Confirm Receipt', mockRO, mockShop);

      expect(result.subject).toContain('Confirmation');
    });

    it('generates custom template with basic structure', () => {
      const result = generateEmail('Custom', mockRO, mockShop);

      expect(result.subject).toContain(mockRO.roNumber);
      expect(result.body).toContain(mockShop.contactName);
      expect(result.body).toContain('Best regards');
    });

    it('defaults to follow-up for unknown template', () => {
      const result = generateEmail('Unknown Template', mockRO, mockShop);

      expect(result.subject).toContain('Status Update Request');
    });

    it('handles null shop gracefully', () => {
      const result = generateEmail('Custom', mockRO, null);

      expect(result.to).toBe('');
      expect(result.body).toContain('Sir/Madam');
    });
  });

  describe('email content validation', () => {
    it('all templates include company name', () => {
      const templates = [
        'Request Quote',
        'Request Status Update',
        'Approve Repair',
        'Expedite Request',
        'Confirm Receipt',
      ];

      templates.forEach((template) => {
        const result = generateEmail(template, mockRO, mockShop);
        expect(result.body).toContain('GenThrust');
      });
    });

    it('all templates include contact email', () => {
      const templates = [
        'Request Quote',
        'Request Status Update',
        'Approve Repair',
        'Expedite Request',
        'Confirm Receipt',
      ];

      templates.forEach((template) => {
        const result = generateEmail(template, mockRO, mockShop);
        expect(result.body).toContain('repairs@genthrust.com');
      });
    });

    it('all templates include closing', () => {
      const templates = [
        'Request Quote',
        'Request Status Update',
        'Approve Repair',
        'Expedite Request',
        'Confirm Receipt',
      ];

      templates.forEach((template) => {
        const result = generateEmail(template, mockRO, mockShop);
        expect(result.body).toContain('Best regards');
      });
    });
  });
});
