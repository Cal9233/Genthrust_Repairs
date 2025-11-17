# AI Tool Input Validation with Zod

## Overview

**Security Issue**: AI tool inputs in `src/services/aiTools.ts` were not validated before execution, creating security risks:
- Malformed data could cause system errors
- Invalid enum values could break database operations
- Type coercion issues
- Missing required fields
- Potential SQL injection attempts

**Solution**: Comprehensive Zod validation schemas with descriptive error messages for the AI to understand and correct.

---

## What Was Implemented

### 1. **`src/services/aiToolSchemas.ts`** (650+ lines)

Complete validation schemas for all 15 AI tools:

#### Critical Tools (Mentioned by User):
1. ✅ **`updateRepairOrderSchema`** - Validates RO number format, status enum, costs, dates
2. ✅ **`createROFromInventorySchema`** - Validates customer data, part numbers, serial numbers
3. ✅ **`checkLowStockSchema`** - Validates threshold values (1-100)
4. ✅ **`searchInventorySchema`** - Validates search parameters, part number format

#### Additional Tools:
5. ✅ **`queryRepairOrdersSchema`** - Complex filters with date ranges, cost ranges
6. ✅ **`bulkUpdateRepairOrdersSchema`** - Bulk operations with limits
7. ✅ **`createRemindersSchema`** - Reminder creation with constraints
8. ✅ **`getStatisticsSchema`** - Statistical query validation
9. ✅ **`generateEmailTemplateSchema`** - Email template parameters
10. ✅ **`sendReminderEmailSchema`** - Email content validation
11. ✅ **`queryExistingRemindersSchema`** - Reminder queries
12. ✅ **`deleteROReminderSchema`** - Deletion validation
13. ✅ **`updateReminderDateSchema`** - Date update validation
14. ✅ **`archiveRepairOrderSchema`** - Archive operation validation
15. ✅ **`checkInventoryQuantitySchema`** - Quantity check validation

### 2. **Validation Utilities**

- **`validateInput()`** - Generic validation with detailed error messages
- **`createValidatedExecutor()`** - Factory for creating validated executors
- **`toolSchemas`** - Schema registry for dynamic lookup
- **`getToolSchema()`** - Schema retrieval by tool name
- **`hasValidationSchema()`** - Check if tool has validation

### 3. **TypeScript Types**

All schemas automatically generate TypeScript types:
```typescript
export type UpdateRepairOrderInput = z.infer<typeof updateRepairOrderSchema>;
export type CreateROFromInventoryInput = z.infer<typeof createROFromInventorySchema>;
// ... 15 total types
```

---

## Implementation Guide

### Method 1: Add Validation to `aiTools.ts` (Recommended)

Update the tool executors to wrap with validation:

```typescript
// At the top of aiTools.ts
import {
  createValidatedExecutor,
  updateRepairOrderSchema,
  searchInventorySchema,
  createROFromInventorySchema,
  checkLowStockSchema,
  // ... import other schemas as needed
} from './aiToolSchemas';

// Original executor (BEFORE):
export const toolExecutors: Record<string, ToolExecutor> = {
  update_repair_order: async (input, context) => {
    const { ro_number, updates } = input;  // No validation!

    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return { success: false, error: `RO ${ro_number} not found` };
    }

    // ... rest of logic
  },

  // Wrapped executor (AFTER):
  update_repair_order: createValidatedExecutor(
    updateRepairOrderSchema,
    async (input, context) => {
      // Input is now validated and typed!
      const { ro_number, updates } = input;

      const ro = context.allROs.find(r =>
        r.roNumber.toString().includes(ro_number) ||
        ro_number.includes(r.roNumber.toString())
      );

      if (!ro) {
        return { success: false, error: `RO ${ro_number} not found` };
      }

      // ... rest of logic (unchanged)
    }
  ),
};
```

### Method 2: Global Validation Wrapper (Alternative)

Add validation layer in `anthropicAgent.ts`:

```typescript
// In anthropicAgent.ts
import { getToolSchema, validateInput } from '@/services/aiToolSchemas';

// Inside the tool execution loop:
for (const block of content) {
  if (block.type === 'tool_use') {
    const toolName = block.name || '';
    const toolInput = block.input;
    const toolUseId = block.id || '';

    // ADD VALIDATION HERE
    const schema = getToolSchema(toolName);
    if (schema) {
      const validation = validateInput(schema, toolInput);

      if (!validation.success) {
        logger.error(`Tool input validation failed for ${toolName}`, null, {
          toolName,
          error: validation.error
        });

        toolResults.push({
          tool_use_id: toolUseId,
          content: `Input validation failed: ${validation.error?.message}`,
          is_error: true
        });

        continue; // Skip execution
      }
    }

    // Execute with validated input
    const executor = toolExecutors[toolName];
    // ... rest of execution
  }
}
```

---

## Validation Examples

### Example 1: RO Number Validation

**Invalid Input**:
```json
{
  "ro_number": "INVALID@#$",
  "updates": { "status": "PAID" }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Invalid RO number format. Expected: 38462, G38462, RO38462, or RO-38462"
}
```

**Valid Input**:
```json
{
  "ro_number": "RO-38462",
  "updates": { "status": "PAID" }
}
```

### Example 2: Status Enum Validation

**Invalid Input**:
```json
{
  "ro_number": "38462",
  "updates": { "status": "INVALID_STATUS" }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Invalid status. Must be one of: TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED, SHIPPING, PAID, PAYMENT SENT, RAI, BER"
}
```

**Valid Input**:
```json
{
  "ro_number": "38462",
  "updates": { "status": "BEING REPAIRED" }
}
```

### Example 3: Create RO from Inventory

**Invalid Input** (missing required fields):
```json
{
  "part_number": "MS20470AD4-6",
  "shop_name": "Duncan Aviation"
  // Missing: ro_number, serial_number, required_work
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Multiple validation errors:\n- ro_number: Required\n- serial_number: Required\n- required_work: Required"
}
```

**Valid Input**:
```json
{
  "part_number": "MS20470AD4-6",
  "shop_name": "Duncan Aviation",
  "ro_number": "RO-12345",
  "serial_number": "SN123456",
  "required_work": "Overhaul required"
}
```

### Example 4: Part Number Validation

**Invalid Input**:
```json
{
  "part_number": "MS20470AD4-6 WITH SPACES!"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Part number must contain only letters, numbers, and dashes"
}
```

**Valid Input**:
```json
{
  "part_number": "MS20470AD4-6"
}
```

### Example 5: Date Range Validation

**Invalid Input** (start date after end date):
```json
{
  "filters": {
    "date_range": {
      "start": "2025-12-31",
      "end": "2025-01-01"
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Start date must be before or equal to end date"
}
```

**Valid Input**:
```json
{
  "filters": {
    "date_range": {
      "start": "2025-01-01",
      "end": "2025-12-31"
    }
  }
}
```

### Example 6: Cost Range Validation

**Invalid Input** (min > max):
```json
{
  "filters": {
    "min_cost": 10000,
    "max_cost": 1000
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Minimum cost must be less than or equal to maximum cost"
}
```

**Valid Input**:
```json
{
  "filters": {
    "min_cost": 1000,
    "max_cost": 10000
  }
}
```

### Example 7: Bulk Operation Limits

**Invalid Input** (too many ROs):
```json
{
  "ro_numbers": ["RO1", "RO2", ... /* 100 items */],
  "updates": { "status": "PAID" }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Input validation failed: Cannot update more than 50 ROs at once"
}
```

**Valid Input**:
```json
{
  "ro_numbers": ["RO-38462", "RO-38463", "RO-38464"],
  "updates": { "status": "PAID" }
}
```

---

## Common Validation Schemas

### RO Number Pattern
```typescript
roNumberSchema = z.string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^(RO-?|G)?[0-9]+$/i)
```

**Accepts**:
- `38462`
- `G38462`
- `RO38462`
- `RO-38462`
- `ro-38462` (case insensitive)

**Rejects**:
- Empty strings
- Special characters (`@#$%`)
- Strings > 20 chars
- Non-numeric suffixes

### Status Enum
```typescript
statusSchema = z.enum([
  'TO SEND',
  'WAITING QUOTE',
  'APPROVED',
  'BEING REPAIRED',
  'SHIPPING',
  'PAID',
  'PAYMENT SENT',
  'RAI',
  'BER',
])
```

### Part Number Pattern
```typescript
partNumberSchema = z.string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Z0-9-]+$/i)
```

**Accepts**:
- `MS20470AD4-6`
- `AN470AD4-6`
- `ABC-123-XYZ`

**Rejects**:
- Special characters except dash
- Spaces
- Empty strings
- Strings > 50 chars

### ISO Date Pattern
```typescript
isoDateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => !isNaN(new Date(date).getTime()))
```

**Accepts**:
- `2025-11-17`
- `2024-01-01`

**Rejects**:
- `11/17/2025` (US format)
- `2025-13-45` (invalid month/day)
- `not-a-date`

### Cost Validation
```typescript
costSchema = z.number()
  .positive()
  .max(1000000)
```

**Accepts**:
- `1234.56`
- `0.01`
- `999999.99`

**Rejects**:
- Negative numbers
- Zero
- > $1,000,000
- Strings (type coercion prevented)

---

## Security Benefits

### Before (No Validation):
```typescript
// AI provides malicious input
{
  "ro_number": "'; DROP TABLE Repairs; --",
  "updates": { "status": "PAID" }
}

// Code directly uses input - VULNERABLE!
const query = `UPDATE Repairs SET status = '${updates.status}'
               WHERE roNumber = '${ro_number}'`;
```

### After (With Validation):
```typescript
// AI provides malicious input
{
  "ro_number": "'; DROP TABLE Repairs; --",
  "updates": { "status": "PAID" }
}

// Zod validation rejects it immediately
// Error: "Invalid RO number format. Expected: 38462, G38462, RO38462, or RO-38462"
// Execution never reaches vulnerable code
```

---

## Implementation Checklist

### Phase 1: Core Tools (Priority 1)
- [ ] `update_repair_order` - ✅ Schema created, wrap executor
- [ ] `create_ro_from_inventory` - ✅ Schema created, wrap executor
- [ ] `search_inventory` - ✅ Schema created, wrap executor
- [ ] `check_low_stock` - ✅ Schema created, wrap executor

### Phase 2: Data Modification Tools (Priority 2)
- [ ] `bulk_update_repair_orders` - ✅ Schema created, wrap executor
- [ ] `archive_repair_order` - ✅ Schema created, wrap executor
- [ ] `create_reminders` - ✅ Schema created, wrap executor
- [ ] `send_reminder_email` - ✅ Schema created, wrap executor

### Phase 3: Query Tools (Priority 3)
- [ ] `query_repair_orders` - ✅ Schema created, wrap executor
- [ ] `query_existing_reminders` - ✅ Schema created, wrap executor
- [ ] `get_statistics` - ✅ Schema created, wrap executor

### Phase 4: Administrative Tools (Priority 4)
- [ ] `delete_ro_reminder` - ✅ Schema created, wrap executor
- [ ] `update_reminder_date` - ✅ Schema created, wrap executor
- [ ] `check_inventory_quantity` - ✅ Schema created, wrap executor
- [ ] `generate_email_template` - ✅ Schema created, wrap executor

---

## Testing Validation

### Unit Tests (Recommended)

Create `src/services/aiToolSchemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  updateRepairOrderSchema,
  searchInventorySchema,
  createROFromInventorySchema,
  validateInput,
} from './aiToolSchemas';

describe('AI Tool Validation', () => {
  describe('updateRepairOrderSchema', () => {
    it('accepts valid RO number formats', () => {
      const inputs = ['38462', 'G38462', 'RO38462', 'RO-38462'];

      inputs.forEach(ro_number => {
        const result = validateInput(updateRepairOrderSchema, {
          ro_number,
          updates: { status: 'PAID' }
        });

        expect(result.success).toBe(true);
      });
    });

    it('rejects invalid RO number formats', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: 'INVALID@#$',
        updates: { status: 'PAID' }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid RO number format');
    });

    it('rejects invalid status values', () => {
      const result = validateInput(updateRepairOrderSchema, {
        ro_number: '38462',
        updates: { status: 'INVALID_STATUS' }
      });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid status');
    });
  });

  describe('searchInventorySchema', () => {
    it('accepts valid part numbers', () => {
      const result = validateInput(searchInventorySchema, {
        part_number: 'MS20470AD4-6'
      });

      expect(result.success).toBe(true);
    });

    it('rejects part numbers with special characters', () => {
      const result = validateInput(searchInventorySchema, {
        part_number: 'MS20470@#$%'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createROFromInventorySchema', () => {
    it('requires all mandatory fields', () => {
      const result = validateInput(createROFromInventorySchema, {
        part_number: 'MS20470AD4-6',
        shop_name: 'Duncan Aviation'
        // Missing: ro_number, serial_number, required_work
      });

      expect(result.success).toBe(false);
      expect(result.error?.issues?.length).toBeGreaterThan(0);
    });

    it('accepts complete valid input', () => {
      const result = validateInput(createROFromInventorySchema, {
        part_number: 'MS20470AD4-6',
        shop_name: 'Duncan Aviation',
        ro_number: 'RO-12345',
        serial_number: 'SN123456',
        required_work: 'Overhaul required'
      });

      expect(result.success).toBe(true);
    });
  });
});
```

### Integration Tests

Test with actual AI agent:

```typescript
// In aiTools.test.ts
it('should reject malformed AI tool input', async () => {
  const context = { allROs: [], currentUser: 'test@example.com' };

  // AI provides invalid input
  const result = await toolExecutors.update_repair_order(
    {
      ro_number: 'INVALID@#$',
      updates: { status: 'PAID' }
    },
    context
  );

  expect(result.success).toBe(false);
  expect(result.error).toContain('Input validation failed');
});
```

---

## Performance Impact

### Before:
- No validation overhead
- But potential crashes/errors from malformed data
- Security vulnerabilities

### After:
- Zod validation: ~0.1-1ms per tool call
- Prevents crashes and security issues
- Type safety guarantees

**Trade-off**: Minimal performance cost for significant security and reliability improvement.

---

## Error Messages for AI

All error messages are designed to be clear and actionable for the AI:

### ✅ Good Error Messages (AI can self-correct):
```
"Invalid RO number format. Expected: 38462, G38462, RO38462, or RO-38462"
"Invalid status. Must be one of: TO SEND, WAITING QUOTE, APPROVED, ..."
"Start date must be before or equal to end date"
"Part number must contain only letters, numbers, and dashes"
```

### ❌ Bad Error Messages (AI cannot self-correct):
```
"Invalid input"
"Error"
"Validation failed"
```

Our schemas use custom error messages and refinements to ensure the AI understands what went wrong and how to fix it.

---

## Next Steps

1. **Wrap Tool Executors** (2-3 hours):
   - Update `aiTools.ts` to use `createValidatedExecutor()` for all 15 tools
   - Test each tool individually

2. **Add Unit Tests** (3-4 hours):
   - Create `aiToolSchemas.test.ts`
   - Test all validation schemas
   - Achieve >90% coverage

3. **Monitor AI Errors** (Ongoing):
   - Add logging for validation failures
   - Track which tools fail most often
   - Refine error messages based on AI feedback

4. **Documentation** (1 hour):
   - Update tool descriptions in `aiTools.ts` with validation details
   - Add examples to tool documentation

---

## Summary

**What Was Created**:
- ✅ 15 comprehensive Zod validation schemas
- ✅ Type-safe TypeScript types for all inputs
- ✅ Validation middleware utilities
- ✅ Schema registry for dynamic lookup
- ✅ Descriptive error messages for AI
- ✅ Complete documentation with examples

**Security Improvements**:
- ✅ SQL injection prevention
- ✅ Type coercion protection
- ✅ Enum validation
- ✅ Range validation (costs, dates, limits)
- ✅ Required field enforcement
- ✅ Input sanitization (trim, lowercase, etc.)

**Next Action**: Wrap all tool executors in `aiTools.ts` with `createValidatedExecutor()` to activate validation.
