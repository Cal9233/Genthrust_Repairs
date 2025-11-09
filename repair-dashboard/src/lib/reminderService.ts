import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

class ReminderService {
  private msalInstance: IPublicClientApplication | null = null;

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
      subject: `[RO ${data.roNumber}] ${data.title}`,
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
   * Create both To Do task and Calendar event
   */
  async createReminders(data: {
    roNumber: string;
    shopName: string;
    title: string;
    dueDate: Date;
    notes?: string;
  }): Promise<{ todo: boolean; calendar: boolean }> {
    const results = { todo: false, calendar: false };

    // Scopes are already granted at login, so we can directly create reminders
    try {
      await this.createToDoTask(data, ["Tasks.ReadWrite"]);
      results.todo = true;
    } catch (error) {
      console.error("[Reminder Service] Failed to create To Do task:", error);
    }

    try {
      await this.createCalendarEvent(data, ["Calendars.ReadWrite"]);
      results.calendar = true;
    } catch (error) {
      console.error("[Reminder Service] Failed to create Calendar event:", error);
    }

    return results;
  }
}

export const reminderService = new ReminderService();
