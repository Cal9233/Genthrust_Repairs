import { z } from 'zod';

/**
 * Zod validation schemas for AI tool inputs
 *
 * Security: All AI tool inputs must be validated before execution to prevent:
 * - Malformed data causing system errors
 * - Invalid enum values
 * - SQL injection attempts
 * - Type coercion issues
 * - Missing required fields
 */

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * RO number validation - supports multiple formats:
 * - Plain number: "38462"
 * - G-prefixed: "G38462"
 * - RO-prefixed: "RO38462"
 * - RO with dash: "RO-38462"
 */
export const roNumberSchema = z.string()
  .trim()
  .min(1, 'RO number cannot be empty')
  .max(20, 'RO number too long (max 20 characters)')
  .regex(/^(RO-?|G)?[0-9]+$/i, 'Invalid RO number format. Expected: 38462, G38462, RO38462, or RO-38462')
  .describe('Repair Order number in any valid format');

/**
 * Status enum - all valid repair order statuses
 */
export const statusSchema = z.enum([
  'TO SEND',
  'WAITING QUOTE',
  'APPROVED',
  'BEING REPAIRED',
  'SHIPPING',
  'PAID',
  'PAYMENT SENT',
  'RAI',      // Return As Is
  'BER',      // Beyond Economical Repair
], {
  errorMap: () => ({
    message: 'Invalid status. Must be one of: TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED, SHIPPING, PAID, PAYMENT SENT, RAI, BER'
  })
});

/**
 * Part number validation
 * Allows alphanumeric with dashes (e.g., MS20470AD4-6, AN470AD4-6)
 */
export const partNumberSchema = z.string()
  .trim()
  .min(1, 'Part number cannot be empty')
  .max(50, 'Part number too long (max 50 characters)')
  .regex(/^[A-Z0-9-]+$/i, 'Part number must contain only letters, numbers, and dashes')
  .describe('Part number (e.g., MS20470AD4-6)');

/**
 * ISO date string validation (YYYY-MM-DD)
 */
export const isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format (YYYY-MM-DD)')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date')
  .describe('ISO formatted date (YYYY-MM-DD)');

/**
 * Cost/price validation - must be positive
 */
export const costSchema = z.number()
  .positive('Cost must be a positive number')
  .max(1000000, 'Cost exceeds maximum allowed value ($1,000,000)')
  .describe('Cost in dollars');

/**
 * Shop name validation
 */
export const shopNameSchema = z.string()
  .trim()
  .min(1, 'Shop name cannot be empty')
  .max(200, 'Shop name too long (max 200 characters)')
  .describe('Repair shop name');

// ============================================================================
// Tool Input Schemas
// ============================================================================

/**
 * 1. update_repair_order
 * Updates a single repair order with new information
 */
export const updateRepairOrderSchema = z.object({
  ro_number: roNumberSchema,
  updates: z.object({
    status: statusSchema.optional(),
    cost: costSchema.optional(),
    estimated_delivery_date: isoDateSchema.optional(),
    notes: z.string().max(5000, 'Notes too long (max 5000 characters)').optional(),
    tracking_number: z.string().max(100, 'Tracking number too long').optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    'Updates object must contain at least one field to update'
  ),
}).describe('Input for updating a repair order');

export type UpdateRepairOrderInput = z.infer<typeof updateRepairOrderSchema>;

/**
 * 2. query_repair_orders
 * Query and filter repair orders
 */
export const queryRepairOrdersSchema = z.object({
  filters: z.object({
    status: statusSchema.optional(),
    shop_name: z.string().max(200).optional(),
    is_overdue: z.boolean().optional(),
    date_range: z.object({
      start: isoDateSchema,
      end: isoDateSchema,
    }).refine(
      (data) => new Date(data.start) <= new Date(data.end),
      'Start date must be before or equal to end date'
    ).optional(),
    min_cost: z.number().nonnegative('Minimum cost cannot be negative').optional(),
    max_cost: z.number().positive('Maximum cost must be positive').optional(),
    ro_numbers: z.array(roNumberSchema).max(100, 'Cannot query more than 100 ROs at once').optional(),
  }).refine(
    (data) => {
      // Validate min_cost < max_cost if both provided
      if (data.min_cost !== undefined && data.max_cost !== undefined) {
        return data.min_cost <= data.max_cost;
      }
      return true;
    },
    'Minimum cost must be less than or equal to maximum cost'
  ),
  sort_by: z.enum(['date', 'cost', 'status', 'overdue']).optional(),
  limit: z.number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(1000, 'Cannot return more than 1000 results')
    .optional(),
}).describe('Input for querying repair orders');

export type QueryRepairOrdersInput = z.infer<typeof queryRepairOrdersSchema>;

/**
 * 3. bulk_update_repair_orders
 * Update multiple repair orders at once
 */
export const bulkUpdateRepairOrdersSchema = z.object({
  ro_numbers: z.array(roNumberSchema)
    .min(1, 'Must provide at least one RO number')
    .max(50, 'Cannot update more than 50 ROs at once'),
  updates: z.object({
    status: statusSchema.optional(),
    cost: costSchema.optional(),
    estimated_delivery_date: isoDateSchema.optional(),
    notes: z.string().max(5000).optional(),
    tracking_number: z.string().max(100).optional(),
  }).refine(
    (data) => Object.keys(data).length > 0,
    'Updates object must contain at least one field to update'
  ),
}).describe('Input for bulk updating repair orders');

export type BulkUpdateRepairOrdersInput = z.infer<typeof bulkUpdateRepairOrdersSchema>;

/**
 * 4. create_reminders
 * Create Microsoft To Do tasks and Calendar events
 */
export const createRemindersSchema = z.object({
  ro_numbers: z.array(roNumberSchema)
    .min(1, 'Must provide at least one RO number')
    .max(20, 'Cannot create reminders for more than 20 ROs at once'),
  reminder_date: isoDateSchema.optional(),
}).describe('Input for creating reminders');

export type CreateRemindersInput = z.infer<typeof createRemindersSchema>;

/**
 * 5. get_statistics
 * Get aggregated statistics about repair orders
 */
export const getStatisticsSchema = z.object({
  group_by: z.enum(['status', 'shop', 'month']).optional(),
  date_range: z.object({
    start: isoDateSchema,
    end: isoDateSchema,
  }).refine(
    (data) => new Date(data.start) <= new Date(data.end),
    'Start date must be before or equal to end date'
  ).optional(),
}).describe('Input for getting statistics');

export type GetStatisticsInput = z.infer<typeof getStatisticsSchema>;

/**
 * 6. generate_email_template
 * Generate professional email templates
 */
export const generateEmailTemplateSchema = z.object({
  ro_number: roNumberSchema,
  email_type: z.enum(['status_update', 'quote_request', 'payment_reminder', 'delivery_confirmation']),
}).describe('Input for generating email template');

export type GenerateEmailTemplateInput = z.infer<typeof generateEmailTemplateSchema>;

/**
 * 7. send_reminder_email
 * Send reminder email to shop
 */
export const sendReminderEmailSchema = z.object({
  ro_number: roNumberSchema,
  message: z.string()
    .min(10, 'Message too short (minimum 10 characters)')
    .max(2000, 'Message too long (max 2000 characters)'),
}).describe('Input for sending reminder email');

export type SendReminderEmailInput = z.infer<typeof sendReminderEmailSchema>;

/**
 * 8. query_existing_reminders
 * Query existing reminders in To Do and Calendar
 */
export const queryExistingRemindersSchema = z.object({
  ro_number: roNumberSchema.optional(),
  filter: z.enum(['all', 'today', 'this_week', 'overdue']).optional(),
}).describe('Input for querying existing reminders');

export type QueryExistingRemindersInput = z.infer<typeof queryExistingRemindersSchema>;

/**
 * 9. delete_ro_reminder
 * Delete reminder for a specific RO
 */
export const deleteROReminderSchema = z.object({
  ro_number: roNumberSchema,
}).describe('Input for deleting RO reminder');

export type DeleteROReminderInput = z.infer<typeof deleteROReminderSchema>;

/**
 * 10. update_reminder_date
 * Update reminder date for an RO
 */
export const updateReminderDateSchema = z.object({
  ro_number: roNumberSchema,
  new_date: isoDateSchema,
}).describe('Input for updating reminder date');

export type UpdateReminderDateInput = z.infer<typeof updateReminderDateSchema>;

/**
 * 11. archive_repair_order
 * Archive a repair order to appropriate sheet
 */
export const archiveRepairOrderSchema = z.object({
  ro_number: roNumberSchema,
  status: z.enum(['PAID', 'NET', 'BER', 'RAI', 'CANCEL'], {
    errorMap: () => ({
      message: 'Archive status must be one of: PAID, NET, BER, RAI, CANCEL'
    })
  }),
}).describe('Input for archiving repair order');

export type ArchiveRepairOrderInput = z.infer<typeof archiveRepairOrderSchema>;

/**
 * 12. search_inventory
 * Search inventory for a specific part number
 */
export const searchInventorySchema = z.object({
  part_number: partNumberSchema,
}).describe('Input for searching inventory');

export type SearchInventoryInput = z.infer<typeof searchInventorySchema>;

/**
 * 13. check_inventory_quantity
 * Quick check of total quantity for a part
 */
export const checkInventoryQuantitySchema = z.object({
  part_number: partNumberSchema,
}).describe('Input for checking inventory quantity');

export type CheckInventoryQuantityInput = z.infer<typeof checkInventoryQuantitySchema>;

/**
 * 14. create_ro_from_inventory
 * Create a new repair order using a part from inventory
 */
export const createROFromInventorySchema = z.object({
  part_number: partNumberSchema,
  shop_name: shopNameSchema,
  ro_number: roNumberSchema,
  serial_number: z.string()
    .trim()
    .min(1, 'Serial number cannot be empty')
    .max(100, 'Serial number too long'),
  required_work: z.string()
    .trim()
    .min(5, 'Required work description too short (minimum 5 characters)')
    .max(1000, 'Required work description too long (max 1000 characters)'),
  estimated_cost: costSchema.optional(),
  terms: z.string().max(100, 'Payment terms too long').optional(),
}).describe('Input for creating RO from inventory');

export type CreateROFromInventoryInput = z.infer<typeof createROFromInventorySchema>;

/**
 * 15. check_low_stock
 * Get list of parts below low stock threshold
 */
export const checkLowStockSchema = z.object({
  threshold: z.number()
    .int('Threshold must be an integer')
    .positive('Threshold must be positive')
    .max(100, 'Threshold too high (max 100)')
    .optional()
    .default(2),
}).describe('Input for checking low stock');

export type CheckLowStockInput = z.infer<typeof checkLowStockSchema>;

// ============================================================================
// Validation Middleware
// ============================================================================

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    issues?: Array<{
      path: string[];
      message: string;
    }>;
  };
}

/**
 * Generic validation function with detailed error messages
 *
 * @param schema - Zod schema to validate against
 * @param input - Input data to validate
 * @returns Validation result with data or detailed error
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): ValidationResult<T> {
  const result = schema.safeParse(input);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Format Zod errors for AI to understand
  const issues = result.error.issues.map(issue => ({
    path: issue.path.map(String),
    message: issue.message,
  }));

  // Create a human-readable error message for the AI
  const errorMessage = issues.length === 1
    ? issues[0].message
    : `Multiple validation errors:\n${issues.map(i =>
        `- ${i.path.join('.')}: ${i.message}`
      ).join('\n')}`;

  return {
    success: false,
    error: {
      message: errorMessage,
      issues,
    },
  };
}

/**
 * Tool validator factory
 * Creates a validated version of a tool executor
 *
 * @param schema - Zod schema for the tool input
 * @param executor - Original tool executor function
 * @returns Validated executor that checks input before execution
 */
export function createValidatedExecutor<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  executor: (input: TInput, context: any) => Promise<TOutput>
) {
  return async (input: unknown, context: any): Promise<TOutput | { success: false; error: string }> => {
    // Validate input
    const validation = validateInput(schema, input);

    if (!validation.success) {
      return {
        success: false,
        error: `Input validation failed: ${validation.error?.message}`,
      };
    }

    // Execute with validated input
    try {
      return await executor(validation.data, context);
    } catch (error: any) {
      return {
        success: false,
        error: `Execution error: ${error.message}`,
      };
    }
  };
}

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Map of tool names to their validation schemas
 * Used for dynamic validation in the tool execution pipeline
 */
export const toolSchemas: Record<string, z.ZodSchema<any>> = {
  update_repair_order: updateRepairOrderSchema,
  query_repair_orders: queryRepairOrdersSchema,
  bulk_update_repair_orders: bulkUpdateRepairOrdersSchema,
  create_reminders: createRemindersSchema,
  get_statistics: getStatisticsSchema,
  generate_email_template: generateEmailTemplateSchema,
  query_reminders: queryExistingRemindersSchema,
  delete_reminders: deleteROReminderSchema,
  update_reminder_date: updateReminderDateSchema,
  archive_repair_order: archiveRepairOrderSchema,
  search_inventory: searchInventorySchema,
  check_inventory_quantity: checkInventoryQuantitySchema,
  create_ro_from_inventory: createROFromInventorySchema,
  check_low_stock: checkLowStockSchema,
};

/**
 * Get schema for a specific tool
 * @param toolName - Name of the tool
 * @returns Zod schema or undefined if not found
 */
export function getToolSchema(toolName: string): z.ZodSchema<any> | undefined {
  return toolSchemas[toolName];
}

/**
 * Check if a tool has validation schema defined
 * @param toolName - Name of the tool
 * @returns True if schema exists
 */
export function hasValidationSchema(toolName: string): boolean {
  return toolName in toolSchemas;
}
