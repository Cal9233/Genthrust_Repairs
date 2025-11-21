import type { IPublicClientApplication } from "@azure/msal-browser";
import { loginRequest } from "../msalConfig";
import { GraphAPIException, isGraphAPIError } from "../../types/graphApi";
import { createLogger } from "../../utils/logger";

const logger = createLogger('GraphClient');

/**
 * Microsoft Graph API HTTP Client
 *
 * Handles authentication and HTTP communication with Microsoft Graph API.
 * Responsibilities:
 * - MSAL token acquisition (silent, popup, redirect flows)
 * - HTTP requests to Graph API endpoints
 * - Error handling and response parsing
 */
export class GraphClient {
  private msalInstance: IPublicClientApplication | null = null;

  /**
   * Set the MSAL instance for authentication
   */
  setMsalInstance(instance: IPublicClientApplication): void {
    this.msalInstance = instance;
    logger.debug('MSAL instance set');
  }

  /**
   * Get current user information from MSAL
   */
  getCurrentUser(): string {
    if (!this.msalInstance) {
      logger.warn('MSAL instance not available for getCurrentUser');
      return "Unknown User";
    }

    // Try active account first
    let account = this.msalInstance.getActiveAccount();

    // If no active account, try getting all accounts
    if (!account) {
      const accounts = this.msalInstance.getAllAccounts();
      account = accounts[0];
    }

    if (!account) {
      logger.warn('No account found in MSAL');
      return "Unknown User";
    }

    // Return the best available identifier
    const userName = account.name || account.username || account.idTokenClaims?.preferred_username || "Unknown User";
    return userName;
  }

  /**
   * Acquire access token using MSAL token acquisition flows
   *
   * Flow priority:
   * 1. Silent acquisition (uses cached/refreshed token)
   * 2. Popup flow (if silent fails)
   * 3. Redirect flow (if popup fails due to CORS/COOP)
   *
   * @returns Access token for Graph API calls
   * @throws {Error} If authentication fails
   */
  async getAccessToken(): Promise<string> {
    if (!this.msalInstance) {
      throw new Error("MSAL instance not set");
    }

    const account = this.msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error("No active account");
    }

    try {
      // Try silent acquisition first (uses cached/refreshed token)
      const response = await this.msalInstance.acquireTokenSilent({
        ...loginRequest,
        account,
      });
      logger.debug('Token acquired silently');
      return response.accessToken;
    } catch (silentError) {
      logger.warn('Silent token acquisition failed, trying popup', silentError);

      // Silent token acquisition failed, using popup
      try {
        const response = await this.msalInstance.acquireTokenPopup({
          ...loginRequest,
        });
        logger.debug('Token acquired via popup');
        return response.accessToken;
      } catch (popupError) {
        // Popup token acquisition failed
        // If popup fails due to CORS/COOP, try redirect
        const errorMessage = popupError instanceof Error ? popupError.message : String(popupError);
        if (errorMessage.includes("popup") || errorMessage.includes("CORS")) {
          logger.info('Popup failed, using redirect flow');
          // Using redirect flow
          await this.msalInstance.acquireTokenRedirect({
            ...loginRequest,
            account,
          });
          throw new Error("Redirecting for authentication...");
        }
        throw popupError;
      }
    }
  }

  /**
   * Call Microsoft Graph API with proper error handling and type safety
   *
   * @template T - The expected response type (defaults to unknown)
   * @param endpoint - The Graph API endpoint URL
   * @param method - HTTP method (GET, POST, PATCH, DELETE)
   * @param body - Request body for POST/PATCH requests
   * @param sessionId - Optional Excel workbook session ID
   * @returns The parsed JSON response, or null for empty responses
   * @throws {GraphAPIException} For HTTP errors from the Graph API
   */
  async callGraphAPI<T = unknown>(
    endpoint: string,
    method = "GET",
    body?: unknown,
    sessionId?: string
  ): Promise<T | null> {
    const token = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    // Add session header if sessionId provided
    if (sessionId) {
      headers["workbook-session-id"] = sessionId;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.debug('Calling Graph API', {
      endpoint,
      method,
      hasSessionId: !!sessionId,
    });

    const response = await fetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      logger.error('Graph API error', {
        status: response.status,
        statusText: response.statusText,
        endpoint,
        errorDetails,
      });

      // Create properly typed GraphAPIException
      throw new GraphAPIException(
        response.status,
        `Graph API error: ${response.status} ${response.statusText}\n${JSON.stringify(errorDetails, null, 2)}`,
        isGraphAPIError(errorDetails) ? errorDetails : errorText
      );
    }

    // Handle empty responses (like 204 No Content from closeSession)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return null;
    }

    // Check if response has content before parsing JSON
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    return JSON.parse(text) as T;
  }
}

/**
 * Singleton instance for use across the application
 */
export const graphClient = new GraphClient();
