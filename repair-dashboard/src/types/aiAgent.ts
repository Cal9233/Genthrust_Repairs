import type { RepairOrder, Shop } from './index';
import type { QueryClient } from '@tanstack/react-query';

/**
 * AI Tool Input Types
 *
 * @description
 * Strongly-typed input schemas for all AI tools. These types ensure type safety
 * when tools are executed and provide IDE autocomplete support.
 */

/**
 * Status type matching the Anthropic tool enum
 */
export type ROStatus =
  | "TO SEND"
  | "WAITING QUOTE"
  | "APPROVED"
  | "BEING REPAIRED"
  | "SHIPPING"
  | "PAID"
  | "PAYMENT SENT"
  | "RAI"
  | "BER";

/**
 * Update repair order tool input
 */
export interface UpdateRepairOrderInput {
  ro_number: string;
  updates: {
    status?: ROStatus;
    cost?: number;
    estimated_delivery_date?: string;
    notes?: string;
    tracking_number?: string;
  };
}

/**
 * Query repair orders tool input
 */
export interface QueryRepairOrdersInput {
  filters?: {
    status?: string;
    shop_name?: string;
    is_overdue?: boolean;
    date_range?: {
      start: string;
      end: string;
    };
    min_cost?: number;
    max_cost?: number;
    ro_numbers?: string[];
  };
  sort_by?: 'date' | 'cost' | 'status' | 'overdue';
  limit?: number;
}

/**
 * Archive repair order tool input
 */
export interface ArchiveRepairOrderInput {
  ro_number: string;
  status: 'PAID' | 'NET' | 'BER' | 'RAI' | 'CANCEL';
}

/**
 * Create reminder tool input
 */
export interface CreateReminderInput {
  ro_number: string;
  reminder_type: 'todo' | 'calendar' | 'both';
  due_date?: string;
  notes?: string;
}

/**
 * Delete reminder tool input
 */
export interface DeleteReminderInput {
  ro_number: string;
  reminder_type?: 'todo' | 'calendar' | 'both';
}

/**
 * Query reminders tool input
 */
export interface QueryRemindersInput {
  ro_number?: string;
  filter_type?: 'today' | 'this_week' | 'overdue' | 'all';
}

/**
 * Generate email tool input
 */
export interface GenerateEmailInput {
  ro_number: string;
  email_type: 'quote_request' | 'status_update' | 'approval' | 'general';
  additional_message?: string;
}

/**
 * Search inventory tool input
 */
export interface SearchInventoryInput {
  part_number: string;
  include_low_stock?: boolean;
}

/**
 * Check inventory quantity tool input
 */
export interface CheckInventoryQuantityInput {
  part_number: string;
}

/**
 * Create RO from inventory tool input
 */
export interface CreateROFromInventoryInput {
  part_number: string;
  ro_number: string;
  shop_name: string;
  serial_number?: string;
  required_work?: string;
}

/**
 * Bulk update tool input
 */
export interface BulkUpdateROsInput {
  ro_numbers: string[];
  updates: {
    status?: ROStatus;
    notes?: string;
  };
}

/**
 * Union type of all possible tool inputs
 */
export type ToolInput =
  | UpdateRepairOrderInput
  | QueryRepairOrdersInput
  | ArchiveRepairOrderInput
  | CreateReminderInput
  | DeleteReminderInput
  | QueryRemindersInput
  | GenerateEmailInput
  | SearchInventoryInput
  | CheckInventoryQuantityInput
  | CreateROFromInventoryInput
  | BulkUpdateROsInput;

/**
 * Tool input map for type-safe tool execution
 */
export interface ToolInputMap {
  update_repair_order: UpdateRepairOrderInput;
  query_repair_orders: QueryRepairOrdersInput;
  archive_repair_order: ArchiveRepairOrderInput;
  create_reminder: CreateReminderInput;
  delete_reminder: DeleteReminderInput;
  query_reminders: QueryRemindersInput;
  generate_email: GenerateEmailInput;
  search_inventory: SearchInventoryInput;
  check_inventory_quantity: CheckInventoryQuantityInput;
  create_ro_from_inventory: CreateROFromInventoryInput;
  bulk_update_ros: BulkUpdateROsInput;
}

// Tool definitions
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

// Tool execution results
export interface ToolResult {
  tool_use_id: string;
  content: string | object;
  is_error?: boolean;
}

// AI Message types
export interface AIMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
  timestamp: Date;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: ToolInput;
  content?: string | ToolResult[];
  is_error?: boolean;
  tool_use_id?: string;
}

// Command execution context
export interface CommandContext {
  allROs: RepairOrder[];
  allShops: Shop[];
  currentUser: string;
  queryClient: QueryClient;
}

// Query filters (kept for backward compatibility)
export interface ROQueryFilters {
  status?: string;
  shop_name?: string;
  is_overdue?: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  min_cost?: number;
  max_cost?: number;
  ro_numbers?: string[];
}

/**
 * Tool execution functions with generic typing
 *
 * @template TInput - The specific tool input type
 * @template TOutput - The tool output type (defaults to unknown)
 */
export type ToolExecutor<TInput = ToolInput, TOutput = unknown> = (
  input: TInput,
  context: CommandContext
) => Promise<TOutput>;

export interface ConversationState {
  messages: AIMessage[];
  isProcessing: boolean;
  currentToolCalls: string[];
}

// RO Reminder query result
export interface ROReminder {
  roNumber: string;
  type: 'todo' | 'calendar' | 'both';
  dueDate: Date;
  hasToDo: boolean;
  hasCalendar: boolean;
  todoStatus?: string;
  roExists: boolean;
  roStatus?: string;
  roShop?: string;
  roActualDueDate?: Date;
  isOverdue: boolean;
}
