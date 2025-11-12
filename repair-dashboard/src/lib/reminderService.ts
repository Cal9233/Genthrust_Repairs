import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

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
      console.log("[Reminder Service] Silent token acquisition failed, using popup");
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
      console.error(`[Reminder Service] ${method} ${endpoint} failed:`, errorText);
      throw new Error(`Graph API error: ${response.status} ${response.statusText}`);
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

    const taskBody = {
      title: `[RO ${data.roNumber}] ${data.title}`,
      body: {
        content: data.notes || `Follow up on repair order ${data.roNumber} for ${data.shopName}`,
        contentType: "text",
      },
      dueDateTime: {
        dateTime: data.dueDate.toISOString(),
        timeZone: "UTC",
      },
      importance: "high",
      reminderDateTime: {
        dateTime: data.dueDate.toISOString(),
        timeZone: "UTC",
      },
    };

    await this.callGraphAPI(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`,
      "POST",
      taskBody,
      scopes
    );

    console.log(`[Reminder Service] Created To Do task for RO ${data.roNumber}`);
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

    const startDate = new Date(data.dueDate);
    startDate.setHours(9, 0, 0, 0); // 9 AM

    const endDate = new Date(data.dueDate);
    endDate.setHours(9, 30, 0, 0); // 9:30 AM

    const eventBody = {
      subject: `[REMINDER] RO ${data.roNumber} - ${data.title}`,
      body: {
        contentType: "text",
        content: data.notes || `Follow up on repair order ${data.roNumber} for ${data.shopName}`,
      },
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "UTC",
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

    console.log(`[Reminder Service] Created Calendar event for RO ${data.roNumber}`);
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
        console.error("[Reminder Service] Failed to create To Do task:", error);
      }
    }

    // Create Calendar event if requested
    if (options.calendar) {
      try {
        await this.createCalendarEvent(data, ["Calendars.ReadWrite"]);
        results.calendar = true;
      } catch (error) {
        console.error("[Reminder Service] Failed to create Calendar event:", error);
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
      console.error('[Reminder Service] Error getting To Do tasks:', error);
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
      console.error('[Reminder Service] Error getting Calendar events:', error);
      throw error;
    }
  }

  /**
   * Search for RO-related reminders (both To Do and Calendar)
   */
  async searchROReminders(roNumber?: string): Promise<ROReminder[]> {
    try {
      // Get all To Do tasks
      const tasks = await this.getToDoTasks();

      // Get Calendar events for next 6 months
      const now = new Date();
      const sixMonthsLater = new Date();
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
      const events = await this.getCalendarEvents(now, sixMonthsLater);

      // Filter for RO-related items
      const roPattern = /RO\s*#?\s*(\w*\d+)/i;
      const reminders: Map<string, ROReminder> = new Map();

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

      return Array.from(reminders.values());

    } catch (error: any) {
      console.error('[Reminder Service] Error searching RO reminders:', error);
      throw error;
    }
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
      console.error('[Reminder Service] Error deleting To Do task:', error);
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
      console.error('[Reminder Service] Error deleting Calendar event:', error);
      return false;
    }
  }

  /**
   * Delete all reminders for a specific RO
   */
  async deleteROReminder(roNumber: string): Promise<{ todo: boolean; calendar: boolean }> {
    try {
      const reminders = await this.searchROReminders(roNumber);

      if (reminders.length === 0) {
        console.log(`[Reminder Service] No reminders found for RO ${roNumber}`);
        return { todo: false, calendar: false };
      }

      const reminder = reminders[0];
      const results = { todo: false, calendar: false };

      if (reminder.todoTask) {
        console.log(`[Reminder Service] Deleting To Do task for RO ${roNumber}...`);
        results.todo = await this.deleteToDoTask(reminder.todoTask.id);
        console.log(`[Reminder Service] To Do deletion result: ${results.todo ? 'Success' : 'Failed'}`);
      } else {
        console.log(`[Reminder Service] No To Do task found for RO ${roNumber}`);
      }

      if (reminder.calendarEvent) {
        console.log(`[Reminder Service] Deleting Calendar event for RO ${roNumber}...`);
        results.calendar = await this.deleteCalendarEvent(reminder.calendarEvent.id);
        console.log(`[Reminder Service] Calendar deletion result: ${results.calendar ? 'Success' : 'Failed'}`);
      } else {
        console.log(`[Reminder Service] No Calendar event found for RO ${roNumber}`);
      }

      return results;

    } catch (error: any) {
      console.error('[Reminder Service] Error deleting RO reminder:', error);
      return { todo: false, calendar: false };
    }
  }

  /**
   * Update To Do task due date
   */
  async updateToDoTaskDate(taskId: string, newDueDate: Date): Promise<boolean> {
    try {
      if (!this.defaultListId) {
        this.defaultListId = await this.getDefaultToDoList(["Tasks.ReadWrite"]);
      }

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${this.defaultListId}/tasks/${taskId}`,
        "PATCH",
        {
          dueDateTime: {
            dateTime: newDueDate.toISOString(),
            timeZone: "UTC"
          }
        },
        ["Tasks.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      console.error('[Reminder Service] Error updating To Do task:', error);
      return false;
    }
  }

  /**
   * Update Calendar event time
   */
  async updateCalendarEventTime(eventId: string, newDate: Date): Promise<boolean> {
    try {
      // Set to 9 AM on the new date
      const startDate = new Date(newDate);
      startDate.setHours(9, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(30); // 30-minute event

      await this.callGraphAPI(
        `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
        "PATCH",
        {
          start: {
            dateTime: startDate.toISOString(),
            timeZone: "UTC"
          },
          end: {
            dateTime: endDate.toISOString(),
            timeZone: "UTC"
          }
        },
        ["Calendars.ReadWrite"]
      );

      return true;

    } catch (error: any) {
      console.error('[Reminder Service] Error updating Calendar event:', error);
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
      console.error('[Reminder Service] Error updating RO reminder:', error);
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

      // Calculate payment due date
      const dueDate = new Date(data.invoiceDate);
      dueDate.setDate(dueDate.getDate() + data.netDays);

      // Set to 9 AM on due date
      const startDate = new Date(dueDate);
      startDate.setHours(9, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setHours(9, 30, 0, 0); // 30-minute event

      const eventBody = {
        subject: `💰 PAYMENT DUE: RO ${data.roNumber} - ${data.shopName}`,
        body: {
          contentType: "text",
          content: `Payment due for repair order ${data.roNumber}\n\nShop: ${data.shopName}\nAmount: $${data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\nTerms: NET ${data.netDays}\nInvoice Date: ${data.invoiceDate.toLocaleDateString()}\nDue Date: ${dueDate.toLocaleDateString()}`,
        },
        start: {
          dateTime: startDate.toISOString(),
          timeZone: "UTC",
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: "UTC",
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

      console.log(`[Reminder Service] Created payment due calendar event for RO ${data.roNumber}, due ${dueDate.toLocaleDateString()}`);
      return true;

    } catch (error: any) {
      console.error('[Reminder Service] Error creating payment due calendar event:', error);
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
