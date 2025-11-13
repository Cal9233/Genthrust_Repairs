/**
 * Logging Service
 *
 * Logs AI agent interactions to SharePoint/OneDrive text files organized by date
 */

import type { IPublicClientApplication } from '@azure/msal-browser';
import { loginRequest } from './msalConfig';

export interface LogEntry {
  timestamp: Date;
  user: string;
  userMessage: string;
  aiResponse: string;
  success: boolean;
  error?: string;
}

class LoggingService {
  private msalInstance: IPublicClientApplication | null = null;
  private logsBasePath = '/AI_Logs'; // Folder in OneDrive/SharePoint

  setMsalInstance(instance: IPublicClientApplication) {
    this.msalInstance = instance;
  }

  private async getAccessToken(): Promise<string> {
    if (!this.msalInstance) {
      throw new Error('MSAL instance not set');
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error('No active account');
    }

    const scopes = loginRequest.scopes;

    try {
      const response = await this.msalInstance.acquireTokenSilent({
        scopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      const response = await this.msalInstance.acquireTokenPopup({
        scopes,
        account,
      });
      return response.accessToken;
    }
  }

  /**
   * Get the log file name for today
   */
  private getLogFileName(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `logs_${year}-${month}-${day}.txt`;
  }

  /**
   * Get the full path to today's log file
   */
  private getLogFilePath(): string {
    return `${this.logsBasePath}/${this.getLogFileName()}`;
  }

  /**
   * Format a log entry as text
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const separator = '='.repeat(80);
    const result = entry.success ? '✓ SUCCESS' : '✗ FAILED';

    let logText = `\n${separator}\n`;
    logText += `[${timestamp}] - ${result}\n`;
    logText += `User: ${entry.user}\n`;
    logText += `${separator}\n\n`;
    logText += `USER REQUEST:\n${entry.userMessage}\n\n`;
    logText += `AI RESPONSE:\n${entry.aiResponse}\n`;

    if (entry.error) {
      logText += `\nERROR:\n${entry.error}\n`;
    }

    logText += `\n${separator}\n\n`;

    return logText;
  }

  /**
   * Call Microsoft Graph API
   */
  private async callGraphAPI(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 204 || method === 'DELETE') {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Ensure the logs folder exists
   */
  private async ensureLogsFolderExists(): Promise<void> {
    try {
      // Try to get the folder
      await this.callGraphAPI(`/me/drive/root:${this.logsBasePath}`);
    } catch (error) {
      // Folder doesn't exist, create it
      console.log('[LoggingService] Creating AI_Logs folder');
      await this.callGraphAPI('/me/drive/root/children', 'POST', {
        name: 'AI_Logs',
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename'
      });
    }
  }

  /**
   * Get existing log file content, or empty string if file doesn't exist
   */
  private async getExistingLogContent(): Promise<string> {
    try {
      const filePath = this.getLogFilePath();
      const response = await this.callGraphAPI(`/me/drive/root:${filePath}:/content`);

      // The response is the file content as text
      if (typeof response === 'string') {
        return response;
      }

      // If it's a blob or arrayBuffer, convert to text
      return '';
    } catch (error: any) {
      // File doesn't exist yet
      if (error.message?.includes('404')) {
        return '';
      }
      console.error('[LoggingService] Error reading log file:', error);
      return '';
    }
  }

  /**
   * Write content to log file (creates new file or overwrites existing)
   */
  private async writeLogFile(content: string): Promise<void> {
    const filePath = this.getLogFilePath();

    // Upload using PUT (simple upload for small files < 4MB)
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:${filePath}:/content`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'text/plain',
        },
        body: content,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to write log file: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Log an AI agent interaction
   */
  async logInteraction(entry: LogEntry): Promise<void> {
    try {
      console.log('[LoggingService] Logging AI interaction');

      // Ensure folder exists
      await this.ensureLogsFolderExists();

      // Get existing content
      const existingContent = await this.getExistingLogContent();

      // Format new entry
      const newEntry = this.formatLogEntry(entry);

      // Append to existing content
      const updatedContent = existingContent + newEntry;

      // Write back to file
      await this.writeLogFile(updatedContent);

      console.log('[LoggingService] Successfully logged interaction');
    } catch (error) {
      console.error('[LoggingService] Failed to log interaction:', error);
      // Don't throw - logging failures shouldn't break the app
    }
  }

  /**
   * Get list of all log files
   */
  async getLogFiles(): Promise<Array<{ name: string; date: Date; id: string }>> {
    try {
      await this.ensureLogsFolderExists();

      const response = await this.callGraphAPI(`/me/drive/root:${this.logsBasePath}:/children`);

      const files = response.value
        .filter((file: any) => file.name.startsWith('logs_') && file.name.endsWith('.txt'))
        .map((file: any) => {
          // Extract date from filename: logs_2025-01-12.txt
          const match = file.name.match(/logs_(\d{4}-\d{2}-\d{2})\.txt/);
          const dateStr = match ? match[1] : '';

          return {
            name: file.name,
            date: dateStr ? new Date(dateStr) : new Date(file.createdDateTime),
            id: file.id,
          };
        })
        .sort((a: any, b: any) => b.date.getTime() - a.date.getTime()); // Newest first

      return files;
    } catch (error) {
      console.error('[LoggingService] Failed to get log files:', error);
      return [];
    }
  }

  /**
   * Get content of a specific log file
   */
  async getLogFileContent(fileName: string): Promise<string> {
    try {
      const filePath = `${this.logsBasePath}/${fileName}`;
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:${filePath}:/content`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to read log file: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error('[LoggingService] Failed to read log file:', error);
      throw error;
    }
  }

  /**
   * Delete a log file
   */
  async deleteLogFile(fileName: string): Promise<void> {
    try {
      const filePath = `${this.logsBasePath}/${fileName}`;
      await this.callGraphAPI(`/me/drive/root:${filePath}`, 'DELETE');
      console.log('[LoggingService] Deleted log file:', fileName);
    } catch (error) {
      console.error('[LoggingService] Failed to delete log file:', error);
      throw error;
    }
  }
}

export const loggingService = new LoggingService();
