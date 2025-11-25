import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReminderService } from '../../src/lib/reminderService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock MSAL instance that returns proper values
const createMockMsalInstance = () => ({
  getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@test.com' }]),
  acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
  acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
});

describe('ReminderService', () => {
  let reminderService: ReminderService;
  let mockMsalInstance: ReturnType<typeof createMockMsalInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMsalInstance = createMockMsalInstance();
    reminderService = new ReminderService();
    reminderService.setMsalInstance(mockMsalInstance as any);

    // Default successful fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ value: [] }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('setMsalInstance', () => {
    it('sets the MSAL instance', () => {
      const service = new ReminderService();
      expect(() => service.setMsalInstance(mockMsalInstance as any)).not.toThrow();
    });
  });

  describe('formatDateForGraph', () => {
    it('formats date correctly for Graph API', () => {
      const service = new ReminderService();
      const date = new Date(2024, 11, 15, 9, 30, 0); // Dec 15, 2024, 9:30 AM

      // Access private method via bracket notation
      const formatted = (service as any).formatDateForGraph(date);

      expect(formatted).toBe('2024-12-15T09:30:00');
    });

    it('pads single-digit months and days', () => {
      const service = new ReminderService();
      const date = new Date(2024, 0, 5, 8, 5, 3); // Jan 5, 2024, 8:05:03 AM

      const formatted = (service as any).formatDateForGraph(date);

      expect(formatted).toBe('2024-01-05T08:05:03');
    });
  });

  describe('getLocalTimeZone', () => {
    it('returns a timezone string', () => {
      const service = new ReminderService();
      const timezone = (service as any).getLocalTimeZone();

      expect(typeof timezone).toBe('string');
      expect(timezone.length).toBeGreaterThan(0);
    });
  });

  describe('addBusinessDays', () => {
    it('adds business days skipping weekends', () => {
      const service = new ReminderService();
      // Monday Nov 18, 2024 + 5 business days = Monday Nov 25, 2024
      const monday = new Date(2024, 10, 18); // Nov 18, 2024 (Monday)
      const result = (service as any).addBusinessDays(monday, 5);

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(10); // November
      expect(result.getDate()).toBe(25); // Nov 25 (Monday)
    });

    it('skips Saturday and Sunday', () => {
      const service = new ReminderService();
      // Friday Nov 15, 2024 + 1 business day = Monday Nov 18, 2024
      const friday = new Date(2024, 10, 15); // Nov 15, 2024 (Friday)
      const result = (service as any).addBusinessDays(friday, 1);

      expect(result.getDate()).toBe(18); // Monday Nov 18
      expect(result.getDay()).toBe(1); // Monday
    });

    it('handles multiple weeks correctly', () => {
      const service = new ReminderService();
      // Monday Nov 18, 2024 + 10 business days = Monday Dec 2, 2024
      const monday = new Date(2024, 10, 18); // Nov 18, 2024 (Monday)
      const result = (service as any).addBusinessDays(monday, 10);

      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(11); // December
      expect(result.getDate()).toBe(2); // Dec 2 (Monday)
    });

    it('handles starting on weekend', () => {
      const service = new ReminderService();
      // Saturday Nov 16, 2024 + 1 business day = Monday Nov 18, 2024
      const saturday = new Date(2024, 10, 16); // Nov 16, 2024 (Saturday)
      const result = (service as any).addBusinessDays(saturday, 1);

      expect(result.getDate()).toBe(18); // Monday Nov 18
      expect(result.getDay()).toBe(1); // Monday
    });

    it('handles NET 30 business days calculation', () => {
      const service = new ReminderService();
      // Friday Nov 15, 2024 + 30 business days
      // 30 business days = 6 weeks = 42 calendar days (approx)
      // Nov 15 + 42 days = Dec 27, but with exact business day calc...
      const friday = new Date(2024, 10, 15); // Nov 15, 2024 (Friday)
      const result = (service as any).addBusinessDays(friday, 30);

      // Result should be a weekday
      expect(result.getDay()).not.toBe(0); // Not Sunday
      expect(result.getDay()).not.toBe(6); // Not Saturday
    });
  });

  describe('extractNetDays', () => {
    it('extracts NET 30', () => {
      expect(ReminderService.extractNetDays('NET 30')).toBe(30);
    });

    it('extracts NET30 without space', () => {
      expect(ReminderService.extractNetDays('NET30')).toBe(30);
    });

    it('extracts Net 45 (mixed case)', () => {
      expect(ReminderService.extractNetDays('Net 45')).toBe(45);
    });

    it('extracts net-60 with dash', () => {
      expect(ReminderService.extractNetDays('net-60')).toBe(60);
    });

    it('returns null for COD', () => {
      expect(ReminderService.extractNetDays('COD')).toBeNull();
    });

    it('returns null for Prepaid', () => {
      expect(ReminderService.extractNetDays('Prepaid')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(ReminderService.extractNetDays('')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(ReminderService.extractNetDays(null as any)).toBeNull();
    });
  });

  describe('createToDoTask', () => {
    beforeEach(() => {
      // Mock getting default list
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
          }),
        })
        // Mock creating task
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'task-456' }),
        });
    });

    it('creates a To Do task successfully', async () => {
      await expect(
        reminderService.createToDoTask({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
          notes: 'Test notes',
        })
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('formats task title correctly', async () => {
      await reminderService.createToDoTask({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);

      expect(body.title).toBe('[RO RO-123] Follow up');
    });

    it('sets high importance', async () => {
      await reminderService.createToDoTask({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const createCall = mockFetch.mock.calls[1];
      const body = JSON.parse(createCall[1].body);

      expect(body.importance).toBe('high');
    });

    it('throws error when service not initialized', async () => {
      const uninitializedService = new ReminderService();

      await expect(
        uninitializedService.createToDoTask({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        })
      ).rejects.toThrow('Service not initialized');
    });
  });

  describe('createCalendarEvent', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'event-789' }),
      });
    });

    it('creates a Calendar event successfully', async () => {
      await expect(
        reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        })
      ).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('formats subject correctly', async () => {
      await reminderService.createCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.subject).toBe('[REMINDER] RO RO-123 - Follow up');
    });

    it('sets showAs to free', async () => {
      await reminderService.createCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.showAs).toBe('free');
    });

    it('sets reminder 15 minutes before', async () => {
      await reminderService.createCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.isReminderOn).toBe(true);
      expect(body.reminderMinutesBeforeStart).toBe(15);
    });

    it('sets event to 30 minutes', async () => {
      await reminderService.createCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        title: 'Follow up',
        dueDate: new Date('2024-12-15'),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Start should be at 9:00, end at 9:30
      expect(body.start.dateTime).toContain('T09:00:00');
      expect(body.end.dateTime).toContain('T09:30:00');
    });
  });

  describe('createReminders', () => {
    beforeEach(() => {
      // Mock all API calls for both To Do and Calendar
      mockFetch
        // Get default list for To Do
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
          }),
        })
        // Create To Do task
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'task-456' }),
        })
        // Create Calendar event
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'event-789' }),
        });
    });

    it('creates both To Do and Calendar when both requested', async () => {
      const result = await reminderService.createReminders(
        {
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        },
        { todo: true, calendar: true }
      );

      expect(result.todo).toBe(true);
      expect(result.calendar).toBe(true);
    });

    it('creates only To Do when calendar is false', async () => {
      const result = await reminderService.createReminders(
        {
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        },
        { todo: true, calendar: false }
      );

      expect(result.todo).toBe(true);
      expect(result.calendar).toBe(false);
    });

    it('creates only Calendar when todo is false', async () => {
      // Reset mock to only handle calendar call
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'event-789' }),
      });

      const result = await reminderService.createReminders(
        {
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        },
        { todo: false, calendar: true }
      );

      expect(result.todo).toBe(false);
      expect(result.calendar).toBe(true);
    });

    it('handles To Do failure gracefully', async () => {
      mockFetch.mockReset();
      mockFetch
        // Get default list succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
          }),
        })
        // Create To Do fails
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad request'),
        })
        // Create Calendar succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: 'event-789' }),
        });

      const result = await reminderService.createReminders(
        {
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        },
        { todo: true, calendar: true }
      );

      expect(result.todo).toBe(false);
      expect(result.calendar).toBe(true);
    });
  });

  describe('createPaymentDueCalendarEvent', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 'payment-event-123' }),
      });
    });

    it('creates payment due calendar event', async () => {
      const result = await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500.50,
        netDays: 30,
      });

      expect(result).toBe(true);
    });

    it('calculates due date using business days (skips weekends)', async () => {
      // Use Date constructor with explicit args to create local time date
      // Monday Nov 18, 2024 + 5 business days = Monday Nov 25, 2024
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date(2024, 10, 18), // Nov 18, 2024 (Monday)
        amount: 1500,
        netDays: 5,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Nov 18 (Mon) + 5 business days = Nov 25 (Mon)
      expect(body.start.dateTime).toContain('2024-11-25');
    });

    it('skips weekends when calculating NET payment due date', async () => {
      // Friday Nov 15, 2024 + 1 business day = Monday Nov 18, 2024
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date(2024, 10, 15), // Nov 15, 2024 (Friday)
        amount: 1500,
        netDays: 1,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Friday + 1 business day = Monday (skips weekend)
      expect(body.start.dateTime).toContain('2024-11-18');
    });

    it('includes amount in event body', async () => {
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500.50,
        netDays: 30,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.body.content).toContain('$1,500.50');
    });

    it('includes "business days" label in event body', async () => {
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500,
        netDays: 30,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.body.content).toContain('business days');
    });

    it('sets showAs to busy', async () => {
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500,
        netDays: 30,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.showAs).toBe('busy');
    });

    it('sets reminder 1 day before (1440 minutes)', async () => {
      await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500,
        netDays: 30,
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);

      expect(body.reminderMinutesBeforeStart).toBe(1440);
    });

    it('returns false on error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      const result = await reminderService.createPaymentDueCalendarEvent({
        roNumber: 'RO-123',
        shopName: 'Test Shop',
        invoiceDate: new Date('2024-11-15'),
        amount: 1500,
        netDays: 30,
      });

      expect(result).toBe(false);
    });
  });

  describe('Error Classification', () => {
    it('provides user-friendly message for 401 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        })
      ).rejects.toThrow('Authentication expired');
    });

    it('provides user-friendly message for 403 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(
        reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        })
      ).rejects.toThrow('Permission denied');
    });

    it('provides user-friendly message for 429 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too many requests'),
      });

      await expect(
        reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        })
      ).rejects.toThrow('Too many requests');
    });

    it('sets canRetry for 429 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Too many requests'),
      });

      try {
        await reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        });
      } catch (error: any) {
        expect(error.canRetry).toBe(true);
      }
    });

    it('sets canRetry for 500+ errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service unavailable'),
      });

      try {
        await reminderService.createCalendarEvent({
          roNumber: 'RO-123',
          shopName: 'Test Shop',
          title: 'Follow up',
          dueDate: new Date('2024-12-15'),
        });
      } catch (error: any) {
        expect(error.canRetry).toBe(true);
      }
    });
  });

  describe('getToDoTasks', () => {
    it('retrieves all To Do tasks from default list', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [
              { id: 'task-1', title: '[RO RO-123] Follow up', status: 'notStarted' },
              { id: 'task-2', title: '[RO RO-456] Check status', status: 'notStarted' },
            ],
          }),
        });

      const tasks = await reminderService.getToDoTasks();

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe('task-1');
    });

    it('throws error when API call fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Server error'),
        });

      await expect(reminderService.getToDoTasks()).rejects.toThrow();
    });
  });

  describe('deleteToDoTask', () => {
    beforeEach(() => {
      // Mock getting default list first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          value: [{ id: 'list-123', isOwner: true, wellknownListName: 'defaultList' }],
        }),
      });
    });

    it('deletes a To Do task successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const result = await reminderService.deleteToDoTask('task-123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks/task-123'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('returns false on delete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      const result = await reminderService.deleteToDoTask('task-999');

      expect(result).toBe(false);
    });
  });

  describe('getDefaultToDoList', () => {
    it('returns default list ID when found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          value: [
            { id: 'list-default', isOwner: true, wellknownListName: 'defaultList' },
            { id: 'list-other', isOwner: true },
          ],
        }),
      });

      const listId = await reminderService.getDefaultToDoList();

      expect(listId).toBe('list-default');
    });

    it('falls back to first list when no default', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          value: [{ id: 'list-custom', isOwner: true }],
        }),
      });

      const listId = await reminderService.getDefaultToDoList();

      expect(listId).toBe('list-custom');
    });

    it('throws error when no lists exist', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ value: [] }),
      });

      await expect(reminderService.getDefaultToDoList()).rejects.toThrow('No To Do lists found');
    });
  });
});
