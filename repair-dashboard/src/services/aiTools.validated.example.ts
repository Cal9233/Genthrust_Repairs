/**
 * EXAMPLE: How to Add Validation to AI Tool Executors
 *
 * This file shows the pattern for wrapping tool executors with Zod validation.
 * Apply this pattern to all executors in aiTools.ts
 */

import type { Tool, ToolExecutor } from '@/types/aiAgent';
import { excelService } from '@/lib/excelService';
import { reminderService } from '@/lib/reminderService';
import { inventoryService } from '@/services/inventoryService';
import {
  createValidatedExecutor,
  updateRepairOrderSchema,
  searchInventorySchema,
  createROFromInventorySchema,
  checkLowStockSchema,
  bulkUpdateRepairOrdersSchema,
  archiveRepairOrderSchema,
  type UpdateRepairOrderInput,
  type SearchInventoryInput,
  type CreateROFromInventoryInput,
  type CheckLowStockInput,
  type BulkUpdateRepairOrdersInput,
  type ArchiveRepairOrderInput,
} from './aiToolSchemas';

// ============================================================================
// EXAMPLE 1: update_repair_order (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const updateRepairOrderOLD: ToolExecutor = async (input, context) => {
  const { ro_number, updates } = input; // Unvalidated input!

  const ro = context.allROs.find(r =>
    r.roNumber.toString().includes(ro_number) ||
    ro_number.includes(r.roNumber.toString())
  );

  if (!ro) {
    return { success: false, error: `RO ${ro_number} not found` };
  }

  try {
    await excelService.updateROStatus(
      ro.roNumber.toString(),
      updates.status || ro.currentStatus,
      updates
    );

    return {
      success: true,
      ro_number: ro.roNumber,
      updated_fields: Object.keys(updates),
      message: `Successfully updated RO ${ro.roNumber}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to update RO'
    };
  }
};

// AFTER (With Validation):
const updateRepairOrderNEW = createValidatedExecutor(
  updateRepairOrderSchema,
  async (input: UpdateRepairOrderInput, context) => {
    // Input is now validated and typed!
    const { ro_number, updates } = input;

    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return { success: false, error: `RO ${ro_number} not found` };
    }

    try {
      await excelService.updateROStatus(
        ro.roNumber.toString(),
        updates.status || ro.currentStatus,
        updates
      );

      return {
        success: true,
        ro_number: ro.roNumber,
        updated_fields: Object.keys(updates),
        message: `Successfully updated RO ${ro.roNumber}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update RO'
      };
    }
  }
);

// ============================================================================
// EXAMPLE 2: search_inventory (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const searchInventoryOLD: ToolExecutor = async (input, _context) => {
  const { part_number } = input; // Unvalidated!

  try {
    const results = await inventoryService.searchInventory(part_number);

    if (results.length === 0) {
      return {
        success: true,
        found: false,
        part_number,
        message: `Part ${part_number} not found in inventory`
      };
    }

    const totalQty = results.reduce((sum, item) => sum + item.qty, 0);

    return {
      success: true,
      found: true,
      part_number,
      total_quantity: totalQty,
      inventory_items: results
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to search inventory'
    };
  }
};

// AFTER (With Validation):
const searchInventoryNEW = createValidatedExecutor(
  searchInventorySchema,
  async (input: SearchInventoryInput, _context) => {
    // Input validated: part_number is guaranteed to be a valid format
    const { part_number } = input;

    try {
      const results = await inventoryService.searchInventory(part_number);

      if (results.length === 0) {
        return {
          success: true,
          found: false,
          part_number,
          message: `Part ${part_number} not found in inventory`
        };
      }

      const totalQty = results.reduce((sum, item) => sum + item.qty, 0);
      const locations = results.length;
      const lowStock = results.filter(item => item.qty < 2).length;

      return {
        success: true,
        found: true,
        part_number,
        total_quantity: totalQty,
        locations_count: locations,
        low_stock_locations: lowStock,
        inventory_items: results.map(item => ({
          quantity: item.qty,
          condition: item.condition || 'Unknown',
          location: item.location || 'Unknown',
          source_table: item.tableName,
          serial_number: item.serialNumber || 'N/A',
          description: item.description || 'N/A',
          is_low_stock: item.qty < 2
        }))
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to search inventory'
      };
    }
  }
);

// ============================================================================
// EXAMPLE 3: create_ro_from_inventory (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const createROFromInventoryOLD: ToolExecutor = async (input, context) => {
  const {
    part_number,
    shop_name,
    ro_number,
    serial_number,
    required_work,
    estimated_cost,
    terms
  } = input; // No validation on any of these!

  try {
    // Search for part
    const inventoryResults = await inventoryService.searchInventory(part_number);

    if (inventoryResults.length === 0) {
      return {
        success: false,
        error: `Part ${part_number} not found in inventory`
      };
    }

    // Create RO
    await excelService.addRepairOrder({
      roNumber: ro_number,
      customerName: shop_name,
      partNumber: part_number,
      serialNumber: serial_number,
      requiredWork: required_work,
      estimatedCost: estimated_cost || 0,
      terms: terms || 'Standard',
      currentStatus: 'TO SEND',
      dateMade: new Date().toISOString().split('T')[0]
    });

    // Decrement inventory
    // ... decrement logic ...

    return {
      success: true,
      ro_number,
      part_number,
      message: `Created RO ${ro_number} for part ${part_number}`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create RO from inventory'
    };
  }
};

// AFTER (With Validation):
const createROFromInventoryNEW = createValidatedExecutor(
  createROFromInventorySchema,
  async (input: CreateROFromInventoryInput, context) => {
    // All fields validated: part_number format, shop_name non-empty,
    // ro_number format, serial_number present, required_work min 5 chars, etc.
    const {
      part_number,
      shop_name,
      ro_number,
      serial_number,
      required_work,
      estimated_cost,
      terms
    } = input;

    try {
      // Search for part
      const inventoryResults = await inventoryService.searchInventory(part_number);

      if (inventoryResults.length === 0) {
        return {
          success: false,
          error: `Part ${part_number} not found in inventory`
        };
      }

      const firstMatch = inventoryResults[0];

      // Create RO with validated data
      await excelService.addRepairOrder({
        roNumber: ro_number,
        customerName: shop_name,
        partNumber: part_number,
        serialNumber: serial_number,
        requiredWork: required_work,
        estimatedCost: estimated_cost || 0,
        terms: terms || 'Standard',
        currentStatus: 'TO SEND',
        dateMade: new Date().toISOString().split('T')[0],
        partDescription: firstMatch.description || 'From Inventory'
      });

      // Decrement inventory
      // ... decrement logic ...

      return {
        success: true,
        ro_number,
        part_number,
        shop_name,
        inventory_location: firstMatch.location,
        previous_quantity: firstMatch.qty,
        new_quantity: firstMatch.qty - 1,
        is_low_stock: (firstMatch.qty - 1) < 2,
        message: `Created RO ${ro_number} for part ${part_number}. Inventory decremented from ${firstMatch.qty} to ${firstMatch.qty - 1}.`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create RO from inventory'
      };
    }
  }
);

// ============================================================================
// EXAMPLE 4: check_low_stock (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const checkLowStockOLD: ToolExecutor = async (input, _context) => {
  // input.threshold could be anything!

  try {
    // TODO: Implement direct index query
    return {
      success: false,
      message: "Low stock query not yet implemented",
      todo: 'Implement inventoryService.getLowStockParts() method'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
};

// AFTER (With Validation):
const checkLowStockNEW = createValidatedExecutor(
  checkLowStockSchema,
  async (input: CheckLowStockInput, _context) => {
    // threshold is validated: integer, positive, max 100, defaults to 2
    const threshold = input.threshold ?? 2;

    try {
      const lowStockParts = await inventoryService.getLowStockParts(threshold);

      return {
        success: true,
        threshold,
        low_stock_count: lowStockParts.length,
        parts: lowStockParts.map(part => ({
          part_number: part.partNumber,
          quantity: part.qty,
          location: part.location,
          condition: part.condition,
          below_threshold: part.qty < threshold
        })),
        message: `Found ${lowStockParts.length} parts below threshold of ${threshold} units`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check low stock'
      };
    }
  }
);

// ============================================================================
// EXAMPLE 5: bulk_update_repair_orders (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const bulkUpdateRepairOrdersOLD: ToolExecutor = async (input, context) => {
  const { ro_numbers, updates } = input; // Could be 1000 ROs!

  const results = [];

  for (const ro_number of ro_numbers) {
    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      results.push({
        ro_number,
        success: false,
        error: 'RO not found'
      });
      continue;
    }

    try {
      await excelService.updateROStatus(
        ro.roNumber.toString(),
        updates.status || ro.currentStatus,
        updates
      );

      results.push({
        ro_number: ro.roNumber,
        success: true
      });
    } catch (error: any) {
      results.push({
        ro_number,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: true,
    results,
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  };
};

// AFTER (With Validation):
const bulkUpdateRepairOrdersNEW = createValidatedExecutor(
  bulkUpdateRepairOrdersSchema,
  async (input: BulkUpdateRepairOrdersInput, context) => {
    // Validated: ro_numbers array has 1-50 items, updates has at least one field
    const { ro_numbers, updates } = input;

    const results = [];

    for (const ro_number of ro_numbers) {
      const ro = context.allROs.find(r =>
        r.roNumber.toString().includes(ro_number) ||
        ro_number.includes(r.roNumber.toString())
      );

      if (!ro) {
        results.push({
          ro_number,
          success: false,
          error: 'RO not found'
        });
        continue;
      }

      try {
        await excelService.updateROStatus(
          ro.roNumber.toString(),
          updates.status || ro.currentStatus,
          updates
        );

        results.push({
          ro_number: ro.roNumber,
          success: true
        });
      } catch (error: any) {
        results.push({
          ro_number,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: true,
      results,
      total: results.length,
      successful,
      failed,
      message: `Bulk update completed: ${successful} successful, ${failed} failed out of ${results.length} total`
    };
  }
);

// ============================================================================
// EXAMPLE 6: archive_repair_order (BEFORE → AFTER)
// ============================================================================

// BEFORE (No Validation):
const archiveRepairOrderOLD: ToolExecutor = async (input, context) => {
  const { ro_number, status } = input; // status could be anything!

  const ro = context.allROs.find(r =>
    r.roNumber.toString().includes(ro_number) ||
    ro_number.includes(r.roNumber.toString())
  );

  if (!ro) {
    return { success: false, error: `RO ${ro_number} not found` };
  }

  try {
    await excelService.moveROToArchive(ro.roNumber.toString(), status);

    return {
      success: true,
      ro_number: ro.roNumber,
      message: `RO ${ro.roNumber} archived`
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to archive RO'
    };
  }
};

// AFTER (With Validation):
const archiveRepairOrderNEW = createValidatedExecutor(
  archiveRepairOrderSchema,
  async (input: ArchiveRepairOrderInput, context) => {
    // Validated: status is one of PAID, NET, BER, RAI, CANCEL only
    const { ro_number, status } = input;

    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return { success: false, error: `RO ${ro_number} not found` };
    }

    try {
      const targetSheet = getFinalSheetForStatus(status);

      await excelService.moveROToArchive(ro.roNumber.toString(), status);

      return {
        success: true,
        ro_number: ro.roNumber,
        archived_to: targetSheet.sheetName,
        message: `RO ${ro.roNumber} archived to ${targetSheet.description}`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to archive RO'
      };
    }
  }
);

// ============================================================================
// HOW TO APPLY TO aiTools.ts
// ============================================================================

/**
 * STEP-BY-STEP MIGRATION:
 *
 * 1. Import validation utilities at top of aiTools.ts:
 *    ```typescript
 *    import {
 *      createValidatedExecutor,
 *      updateRepairOrderSchema,
 *      searchInventorySchema,
 *      // ... import all schemas you need
 *    } from './aiToolSchemas';
 *    ```
 *
 * 2. For each executor in toolExecutors object:
 *    - Find: `tool_name: async (input, context) => {`
 *    - Replace with: `tool_name: createValidatedExecutor(toolNameSchema, async (input, context) => {`
 *    - Add closing parenthesis at the end: `}),`
 *
 * 3. Test each tool:
 *    - Try with valid input
 *    - Try with invalid input (should get validation error)
 *
 * Example diff:
 * ```diff
 * - update_repair_order: async (input, context) => {
 * + update_repair_order: createValidatedExecutor(
 * +   updateRepairOrderSchema,
 * +   async (input, context) => {
 *     const { ro_number, updates } = input;
 *     // ... rest of code unchanged ...
 * - },
 * +   }
 * + ),
 * ```
 */

export {
  updateRepairOrderNEW,
  searchInventoryNEW,
  createROFromInventoryNEW,
  checkLowStockNEW,
  bulkUpdateRepairOrdersNEW,
  archiveRepairOrderNEW,
};
