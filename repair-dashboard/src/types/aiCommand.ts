/**
 * AI Command Types
 *
 * Type definitions for AI-powered natural language commands
 */

export interface ParsedCommand {
  // Unique identifier for this command
  id: string;

  // Original text input by user
  originalText: string;

  // Action to perform
  action: CommandAction;

  // Target RO number
  roNumber: string;

  // Optional parameters depending on action
  params: CommandParams;

  // AI confidence score (0-1)
  confidence: number;

  // Timestamp when parsed
  parsedAt: Date;
}

export type CommandAction =
  | 'update_status'
  | 'set_scheduled_date'
  | 'add_note'
  | 'set_cost'
  | 'set_reminder'
  | 'update_multiple_fields'
  | 'unknown';

export interface CommandParams {
  // Status update
  status?: string;

  // Date fields
  scheduledCompletionDate?: string; // ISO date string
  estimatedDeliveryDate?: string;
  nextUpdateDate?: string;

  // Cost
  cost?: number;

  // Notes
  notes?: string;

  // Reminder
  reminderDate?: string;
  reminderNote?: string;

  // Multiple field updates
  fields?: {
    [key: string]: any;
  };
}

export interface CommandValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CommandResult {
  success: boolean;
  message: string;
  command: ParsedCommand;
  error?: string;
}

export interface AIParserResponse {
  action: CommandAction;
  roNumber: string | null;
  params: CommandParams;
  confidence: number;
  reasoning?: string; // Optional explanation of parsing
}

export interface CommandHistoryEntry {
  command: ParsedCommand;
  result: CommandResult;
  executedAt: Date;
  executedBy: string;
}
