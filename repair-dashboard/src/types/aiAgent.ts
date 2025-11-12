import type { RepairOrder, Shop } from './index';

// Tool definitions
export interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
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
  input?: any;
  content?: any;
  is_error?: boolean;
}

// Command execution context
export interface CommandContext {
  allROs: RepairOrder[];
  allShops: Shop[];
  currentUser: string;
}

// Query filters
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

// Tool execution functions
export type ToolExecutor = (
  input: any,
  context: CommandContext
) => Promise<any>;

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
