import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import { createLogger, measureAsync } from '@/utils/logger';

const logger = createLogger('ReminderService');

export interface ToDoTask {
  id: string;
  title: string;
  body?: {
    content: string;
  };
  dueDateTime?: {
    dateTime: string;
    timeZone: string;
  };
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  createdDateTime: string;
  isReminderOn: boolean;
  reminderDateTime?: {
    dateTime: string;
    timeZone: string;
  };
}

export interface CalendarEvent {
  id: string;
  subject: string;
  body?: {
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isReminderOn: boolean;
  reminderMinutesBeforeStart: number;
  createdDateTime: string;
}

export interface ROReminder {
  roNumber: string;
  type: 'todo' | 'calendar' | 'both';
  todoTask?: ToDoTask;
  calendarEvent?: CalendarEvent;
  dueDate: Date;
}

export class ReminderService {
  private msalInstance: IPublicClientApplication | null = null;
  private defaultListId: string | null = null;

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
  }

  /**
   * Format a date for Microsoft Graph API
   * Graph API expects ISO 8601 format: YYYY-MM-DDTHH:mm:ss
   * When using timeZone property, we should NOT include the 'Z' suffix
   * This ensures the time is interpreted in the specified timezone
   */
  private formatDateForGraph(date: Date): string {
    // Format as local ISO string without timezone suffix
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get the user's local timezone name for Graph API
   */
  private getLocalTimeZone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }

  /**
   * Add business days to a date (skips weekends)
   * @param date - Start date
   * @param days - Number of business days to add
   * @returns New date after adding business days
   */
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;

    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        addedDays++;
      }
    }

    return result;
  }

  private async getAccessToken(additionalScopes: string[] = []): Promise<string> {
    if (!this.msalInstance) {
      throw new Error("MSAL instance not set");
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error("No active account");
    }

    // Use the specified scopes or fall back to login scopes
    const scopes = additionalScopes.length > 0 ? additionalScopes : loginRequest.scopes;

    try {
      // Try to get token silently first (from cache)
      const response = await this.msalInstance.acquireTokenSilent({
        scopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      // If silent fails, fall back to popup (shouldn't happen since we request at login)
      logger.warn("Silent token acquisition failed, using popup");
      const response = await this.msalInstance.acquireTokenPopup({
        scopes,
        account,
      });
      return response.accessToken;
    }
  }

  private async callGraphAPI(endpoint: string, method = "GET", body?: any, scopes?: string[]) {
    const token = await this.getAccessToken(scopes);

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails: any = {};

      // Try to parse error response for more details
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = { rawError: errorText };
      }

      // Classify error for better user guidance
      let userMessage: string;
      switch (response.status) {
        case 401:
          userMessage = "Authentication expired. Please sign out and sign back in.";
          break;
        case 403:
          userMessage = "Permission denied. Please ensure the app has access to your To Do and Calendar.";
          break;
        case 429:
          userMessage = "Too many requests. Please wait a moment and try again.";
          break;
        case 400:
          userMessage = "Invalid request. Please check the data and try again.";
          break;
        case 404:
          userMessage = "Resource not found. The To Do list or Calendar may not exist.";
          break;
        default:
          userMessage = `Microsoft service error (${response.status}). Please try again.`;
      }

      logger.error(`${method} ${endpoint} failed`, new Error(errorText), {
        method,
        endpoint,
        status: response.status,
        statusText: response.statusText,
        errorCode: errorDetails?.error?.code,
        errorMessage: errorDetails?.error?.message
      });

      // Include status code in error for downstream handling
      const error = new Error(userMessage);
      (error as any).statusCode = response.status;
      (error as any).canRetry = response.status === 429 || response.status >= 500;
      throw error;
    }

    // DELETE requests return 204 No Content (empty body)
    // Don't try to parse JSON for empty responses
    if (response.status === 204 || method === "DELETE") {
      return null;
    }

    return response.json();
  }

  /**
   * Get the default To Do list
   */
  async getDefaultToDoList(scopes?: string[]): Promise<string> {
    const lists = await this.callGraphAPI(
      "https://graph.microsoft.com/v1.0/me/todo/lists",
      "GET",
      undefined,
      scopes
    );

    // Find the default "Tasks" list or use the first one
    const defaultList = lists.value.find((list: any) => list.isOwner && list.wellknownListName === "defaultList");

    if (defaultList) {
      return defaultList.id;
    }

    // If no default list, use the first one
    if (lists.value.length > 0) {
      return lists.value[0].id;
    }

    throw new Error("No To Do lists found");
  }

  /**
   * Create a To Do task for an RO follow-up
   */
  async createToDoTask(
    data: {
      roNumber: string;
      shopName: string;
      title: string;
      dueDate: Date;
      notes?: string;
    },
    scopes?: string[]
  ): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const listId = await this.getDefaultToDoList(scopes);
    const localTimeZone = this.getLocalTimeZone();

    // Set due date to 9 AM local time for the reminder
    const dueDateTime = new Date(data.dueDate);
    dueDateTime.setHours(9, 0, 0, 0);

    const taskBody = {
      title: `[RO ${data.roNumber}] ${data.title}`,
      body: {
        content: data.notes || `Follow up on repair order ${data.roNumber} for ${data.shopName}`,
        contentType: "text",
      },
      dueDateTime: {
        dateTime: this.formatDateForGraph(dueDateTime),
        timeZone: localTimeZone,
      },
      importance: "high",
      reminderDateTime: {
        dateTime: this.formatDateForGraph(dueDateTime),
        timeZone: localTimeZone,
      },
    };

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`,
      "POST",
      taskBody,
      scopes
    );

    logger.info("Created To Do task", {
      roNumber: data.roNumber,
      title: data.title,
      dueDate: this.formatDateForGraph(dueDateTime),
      timeZone: localTimeZone
    });
  }

  /**
   * Create a Calendar event for an RO follow-up
   */
  async createCalendarEvent(
    data: {
      roNumber: string;
      shopName: string;
      title: string;
      dueDate: Date;
      notes?: string;
    },
    scopes?: string[]
  ): Promise<void> {
    if (!this.msalInstance) {
      throw new Error("Service not initialized. Please refresh the page and try again.");
    }

    const localTimeZone = this.getLocalTimeZone();

    const startDate = new Date(data.dueDate);
    startDate.setHours(9, 0, 0, 0); // 9 AM local time

    const endDate = new Date(data.dueDate);
    endDate.setHours(9, 30, 0, 0); // 9:30 AM local time

    const eventBody = {
      subject: `[REMINDER] RO ${data.roNumber} - ${data.title}`,
      body: {
        contentType: "text",
        content: data.notes || `Follow up on repair order ${data.roNumber} for ${data.shopName}`,
      },
      start: {
        dateTime: this.formatDateForGraph(startDate),
        timeZone: localTimeZone,
      },
      end: {
        dateTime: this.formatDateForGraph(endDate),
        timeZone: localTimeZone,
      },
      showAs: "free",  // Doesn't block your calendar
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
      categories: ["Repair Orders"],
    };

    await this.callGraphAPI(
      "https://graph.microsoft.com/v1.0/me/calendar/events",
      "POST",
      eventBody,
      scopes
    );

    logger.info("Created Calendar event", {
      roNumber: data.roNumber,
      title: data.title,
      startDate: this.formatDateForGraph(startDate),
      timeZone: localTimeZone
    });
  }

  /**
   * Create To Do task and/or Calendar event based on options
   */
  async createReminders(
    data: {
      roNumber: string;
      shopName: string;
      title: string;
      dueDate: Date;
      notes?: string;
    },
    options: { todo: boolean; calendar: boolean } = { todo: true, calendar: true }
  ): Promise<{ todo: boolean; calendar: boolean }> {
    const results = { todo: false, calendar: false };

    // Create To Do task if requested
    if (options.todo) {
      try {
        await this.createToDoTask(data, ["Tasks.ReadWrite"]);
        results.todo = true;
      } catch (error) {
        logger.error("Failed to create To Do task", error, {
          roNumber: data.roNumber
        });
      }
    }

    // Create Calendar event if requested
    if (options.calendar) {
      try {
        await this.createCalendarEvent(data, ["Calendars.ReadWrite"]);
        results.calendar = true;
      } catch (error) {
        logger.error("Failed to create Calendar event", error, {
          roNumber: data.roNumber
        });
      }
    }

    return results;
  }

  /**
   * Get all To Do tasks
   */
  async getToDoTasks(): Promise<ToDoTask[]> {
    try {
      // Get default task list if not cached
      if (!this.defaultListId) {
        this.defaultListId = await this.getDefaultToDoList(["Tasks.ReadWrite"]);
      }

      // Get all tasks from default list
      const tasksData = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${this.defaultListId}/tasks`,
        "GET",
        undefined,
        ["Tasks.ReadWrite"]
      );

      return tasksData.value;

    } catch (error: any) {
      logger.error('Error getting To Do tasks', error);
      throw error;
    }
  }

  /**
   * Get Calendar events within a date range
   */
  async getCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      // Format dates for Microsoft Graph (ISO 8601)
      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();

      // Get calendar events in date range
      const eventsData = await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/calendar/calendarView?startDateTime=${startISO}&endDateTime=${endISO}`,
        "GET",
        undefined,
        ["Calendars.ReadWrite"]
      );

      return eventsData.value;

    } catch (error: any) {
      logger.error('Error getting Calendar events', error, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });
      throw error;
    }
  }

  /**
   * Search for RO-related reminders (both To Do and Calendar)
   */
  async searchROReminders(roNumber?: string): Promise<ROReminder[]> {
    return await measureAsync(logger, 'searchROReminders', async () => {
      logger.info("Searching for RO reminders", {
        filterRONumber: roNumber || 'all'
      });

      // Get all To Do tasks
      const tasks = await this.getToDoTasks();
      logger.debug("Retrieved To Do tasks", {
        count: tasks.length
      });

      // Get Calendar events for next 6 months
      const now = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      const events = await this.getCalendarEvents(now, sixMonthsLater);
      logger.debug("Retrieved Calendar events", {
        count: events.length,
        startDate: now.toISOString(),
        endDate: sixMonthsLater.toISOString()
      });

      // Filter for RO-related items
      const roPattern = /RO\s*#?\s*(\w*\d+)/i;
      const reminders: Map<string, ROReminder> = new Map();

      logger.debug("Using RO pattern", {
        pattern: roPattern.toString()
      });

      // Process To Do tasks
      for (const task of tasks) {
        const match = task.title.match(roPattern);
        if (match) {
          const extractedRO = match[1];

          // If searching for specific RO, filter
          if (roNumber && !extractedRO.includes(roNumber) && !roNumber.includes(extractedRO)) {
            continue;
          }

          const dueDate = task.dueDateTime
            ? new Date(task.dueDateTime.dateTime)
            : new Date(task.createdDateTime);

          if (reminders.has(extractedRO)) {
            const existing = reminders.get(extractedRO)!;
            existing.todoTask = task;
            existing.type = existing.calendarEvent ? 'both' : 'todo';
          } else {
            reminders.set(extractedRO, {
              roNumber: extractedRO,
              type: 'todo',
              todoTask: task,
              dueDate
            });
          }
        }
      }

      // Process Calendar events
      for (const event of events) {
        const match = event.subject.match(roPattern);
        if (match) {
          const extractedRO = match[1];

          // If searching for specific RO, filter
          if (roNumber && !extractedRO.includes(roNumber) && !roNumber.includes(extractedRO)) {
            continue;
          }

          const startDate = new Date(event.start.dateTime);

          if (reminders.has(extractedRO)) {
            const existing = reminders.get(extractedRO)!;
            existing.calendarEvent = event;
            existing.type = existing.todoTask ? 'both' : 'calendar';
          } else {
            reminders.set(extractedRO, {
              roNumber: extractedRO,
              type: 'calendar',
              calendarEvent: event,
              dueDate: startDate
            });
          }
        }
      }

      const result = Array.from(reminders.values());
      logger.info("RO reminders search completed", {
        matchCount: result.length,
        roNumbers: result.map(r => r.roNumber)
      });

      return result;
    });
  }

  /**
   * Delete a To Do task
   */
  async deleteToDoTask(taskId: string): Promise<boolean> {
    try {
      if (!this.defaultListId) {
        // Get default list first
        this.defaultListId = await this.getDefaultToDoList(["Tasks.ReadWrite"]);
      }

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${this.defaultListId}/tasks/${taskId}`,
        "DELETE",
        undefined,
        ["Tasks.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      logger.error('Error deleting To Do task', error, {
        taskId
      });
      return false;
    }
  }

  /**
   * Delete a Calendar event
   */
  async deleteCalendarEvent(eventId: string): Promise<boolean> {
    try {
      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
        "DELETE",
        undefined,
        ["Calendars.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      logger.error('Error deleting Calendar event', error, {
        eventId
      });
      return false;
    }
  }

  /**
   * Delete all reminders for a specific RO
   */
  async deleteROReminder(roNumber: string): Promise<{ todo: boolean; calendar: boolean }> {
    return await measureAsync(logger, 'deleteROReminder', async () => {
      logger.info("Deleting RO reminder", { roNumber });

      const reminders = await this.searchROReminders(roNumber);

      if (reminders.length === 0) {
        logger.warn("No reminders found for RO", { roNumber });
        return { todo: false, calendar: false };
      }

      const reminder = reminders[0];
      const results = { todo: false, calendar: false };

      logger.debug("Reminder details", {
        roNumber: reminder.roNumber,
        type: reminder.type,
        hasTodoTask: !!reminder.todoTask,
        hasCalendarEvent: !!reminder.calendarEvent
      });

      if (reminder.todoTask) {
        logger.info("Deleting To Do task", {
          title: reminder.todoTask.title,
          taskId: reminder.todoTask.id
        });
        results.todo = await this.deleteToDoTask(reminder.todoTask.id);
        logger.info("To Do deletion completed", {
          success: results.todo
        });
      } else {
        logger.debug("No To Do task found", { roNumber });
      }

      if (reminder.calendarEvent) {
        logger.info("Deleting Calendar event", {
          subject: reminder.calendarEvent.subject,
          eventId: reminder.calendarEvent.id
        });
        results.calendar = await this.deleteCalendarEvent(reminder.calendarEvent.id);
        logger.info("Calendar deletion completed", {
          success: results.calendar
        });
      } else {
        logger.debug("No Calendar event found", { roNumber });
      }

      logger.info("RO reminder deletion completed", {
        roNumber,
        results
      });
      return results;
    });
  }

  /**
   * Update To Do task due date
   */
  async updateToDoTaskDate(taskId: string, newDueDate: Date): Promise<boolean> {
    try {
      if (!this.defaultListId) {
        this.defaultListId = await this.getDefaultToDoList(["Tasks.ReadWrite"]);
      }

      const localTimeZone = this.getLocalTimeZone();

      // Set to 9 AM local time on the new due date
      const dueDateTime = new Date(newDueDate);
      dueDateTime.setHours(9, 0, 0, 0);

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${this.defaultListId}/tasks/${taskId}`,
        "PATCH",
        {
          dueDateTime: {
            dateTime: this.formatDateForGraph(dueDateTime),
            timeZone: localTimeZone
          }
        },
        ["Tasks.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      logger.error('Error updating To Do task', error, {
        taskId,
        newDueDate: this.formatDateForGraph(newDueDate)
      });
      return false;
    }
  }

  /**
   * Update Calendar event time
   */
  async updateCalendarEventTime(eventId: string, newDate: Date): Promise<boolean> {
    try {
      const localTimeZone = this.getLocalTimeZone();

      // Set to 9 AM local time on the new date
      const startDate = new Date(newDate);
      startDate.setHours(9, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(30); // 30-minute event

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
        "PATCH",
        {
          start: {
            dateTime: this.formatDateForGraph(startDate),
            timeZone: localTimeZone
          },
          end: {
            dateTime: this.formatDateForGraph(endDate),
            timeZone: localTimeZone
          }
        },
        ["Calendars.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      logger.error('Error updating Calendar event', error, {
        eventId,
        newDate: this.formatDateForGraph(newDate)
      });
      return false;
    }
  }

  /**
   * Update RO reminder date (both To Do and Calendar)
   */
  async updateROReminderDate(roNumber: string, newDate: Date): Promise<{ todo: boolean; calendar: boolean }> {
    try {
      const reminders = await this.searchROReminders(roNumber);

      if (reminders.length === 0) {
        return { todo: false, calendar: false };
      }

      const reminder = reminders[0];
      const results = { todo: false, calendar: false };

      if (reminder.todoTask) {
        results.todo = await this.updateToDoTaskDate(reminder.todoTask.id, newDate);
      }

      if (reminder.calendarEvent) {
        results.calendar = await this.updateCalendarEventTime(reminder.calendarEvent.id, newDate);
      }

      return results;

    } catch (error: any) {
      logger.error('Error updating RO reminder', error, {
        roNumber,
        newDate: newDate.toISOString()
      });
      return { todo: false, calendar: false };
    }
  }

  /**
   * Create a payment due date calendar event for NET payment terms
   */
  async createPaymentDueCalendarEvent(
    data: {
      roNumber: string;
      shopName: string;
      invoiceDate: Date;
      amount: number;
      netDays: number;
    }
  ): Promise<boolean> {
    try {
      if (!this.msalInstance) {
        throw new Error("Service not initialized. Please refresh the page and try again.");
      }

      const localTimeZone = this.getLocalTimeZone();

      // Calculate payment due date using business days (skip weekends)
      const dueDate = this.addBusinessDays(new Date(data.invoiceDate), data.netDays);

      // Set to 9 AM local time on due date
      const startDate = new Date(dueDate);
      startDate.setHours(9, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(9, 30, 0, 0); // 30-minute event

      const eventBody = {
        subject: `PAYMENT DUE: RO ${data.roNumber} - ${data.shopName}`,
        body: {
          contentType: "text",
          content: `Payment due for repair order ${data.roNumber}\n\nShop: ${data.shopName}\nAmount: $${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\nTerms: NET ${data.netDays} (business days)\nInvoice Date: ${data.invoiceDate.toLocaleDateString()}\nDue Date: ${dueDate.toLocaleDateString()}`,
        },
        start: {
          dateTime: this.formatDateForGraph(startDate),
          timeZone: localTimeZone,
        },
        end: {
          dateTime: this.formatDateForGraph(endDate),
          timeZone: localTimeZone,
        },
        showAs: "busy",  // Block calendar time
        isReminderOn: true,
        reminderMinutesBeforeStart: 1440, // Remind 1 day before
        categories: ["Payment Due", "Repair Orders"],
        importance: "high",
      };

      await this.callGraphAPI(
        "https://graph.microsoft.com/v1.0/me/calendar/events",
        "POST",
        eventBody,
        ["Calendars.ReadWrite"]
      );

      logger.info("Created payment due calendar event", {
        roNumber: data.roNumber,
        shopName: data.shopName,
        amount: data.amount,
        netDays: data.netDays,
        dueDate: this.formatDateForGraph(dueDate),
        timeZone: localTimeZone
      });
      return true;

    } catch (error: any) {
      logger.error('Error creating payment due calendar event', error, {
        roNumber: data.roNumber
      });
      return false;
    }
  }

  /**
   * Extract NET days from payment terms string
   * Examples: "NET 30" → 30, "NET30" → 30, "Net 45" → 45, "net-60" → 60
   */
  static extractNetDays(terms: string): number | null {
    if (!terms) return null;

    // Match "NET" followed by optional space/dash and then digits
    const match = terms.match(/net[\s-]*(\d+)/i);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }

    return null;
  }
}

export const reminderService = new ReminderService();
