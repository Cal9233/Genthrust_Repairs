/**
 * Excel Module - Entry Point
 *
 * This module provides Excel integration with Microsoft Graph API.
 * It is organized into separate concerns:
 *
 * - GraphClient: HTTP client for Graph API calls
 * - SessionManager: Excel workbook session management
 * - RepairOrderRepository: Repair order CRUD operations and data mapping
 */

export { GraphClient, graphClient } from './GraphClient';
export { SessionManager, SessionOptions, GraphAPIError } from './SessionManager';
export { RepairOrderRepository } from './RepairOrderRepository';
