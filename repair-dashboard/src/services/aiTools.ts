import type { Tool, ToolExecutor } from '@/types/aiAgent';
import { excelService } from '@/lib/excelService';
import { reminderService } from '@/lib/reminderService';
import { generateEmailForAI } from '@/lib/emailTemplates';
import { getFinalSheetForStatus } from '@/config/excelSheets';
import { inventoryService } from '@/services/inventoryService';

// Tool definitions
export const tools: Tool[] = [
  {
    name: "update_repair_order",
    description: "Update a single repair order with new information. Can update status, cost, dates, notes, or any other field.",
    input_schema: {
      type: "object",
      properties: {
        ro_number: {
          type: "string",
          description: "The RO number to update (e.g., '38462', 'G38462', 'RO38462')"
        },
        updates: {
          type: "object",
          description: "Fields to update on the repair order",
          properties: {
            status: {
              type: "string",
              enum: ["TO SEND", "WAITING QUOTE", "APPROVED", "BEING REPAIRED", "SHIPPING", "PAID", "PAYMENT SENT", "RAI", "BER"],
              description: "New status for the repair order. RAI = Return As Is, BER = Beyond Economical Repair"
            },
            cost: {
              type: "number",
              description: "Cost in dollars. Will update Estimated Cost for non-final statuses, or Final Cost for PAID/SHIPPING statuses."
            },
            estimated_delivery_date: {
              type: "string",
              description: "Expected delivery date in ISO format (YYYY-MM-DD)"
            },
            notes: {
              type: "string",
              description: "Additional notes to append to the RO"
            },
            tracking_number: {
              type: "string",
              description: "Shipping tracking number"
            }
          }
        }
      },
      required: ["ro_number", "updates"]
    }
  },
  {
    name: "query_repair_orders",
    description: "Query and filter repair orders from Active sheet and optionally archive sheets (Paid, NET, Returns). Automatically searches all sheets when filtering by payment terms containing 'NET'.",
    input_schema: {
      type: "object",
      properties: {
        filters: {
          type: "object",
          description: "Filter criteria for repair orders",
          properties: {
            status: {
              type: "string",
              description: "Filter by status"
            },
            shop_name: {
              type: "string",
              description: "Filter by shop name (partial match supported)"
            },
            is_overdue: {
              type: "boolean",
              description: "Filter for overdue ROs"
            },
            date_range: {
              type: "object",
              properties: {
                start: { type: "string", description: "Start date (ISO format)" },
                end: { type: "string", description: "End date (ISO format)" }
              },
              description: "Filter by date range (uses dateMade field)"
            },
            min_cost: {
              type: "number",
              description: "Minimum cost (uses estimatedCost or finalCost)"
            },
            max_cost: {
              type: "number",
              description: "Maximum cost"
            },
            ro_numbers: {
              type: "array",
              items: { type: "string" },
              description: "Specific RO numbers to query"
            },
            payment_terms: {
              type: "string",
              description: "Filter by payment terms (e.g., 'NET 30', 'NET30', 'COD'). When filtering by NET terms, automatically searches all archive sheets."
            }
          }
        },
        include_archives: {
          type: "boolean",
          description: "Whether to search archive sheets (Paid, NET, Returns) in addition to Active sheet. Default: false, except when payment_terms contains 'NET'."
        },
        sort_by: {
          type: "string",
          enum: ["date", "cost", "status", "overdue"],
          description: "How to sort results"
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: all)"
        }
      },
      required: ["filters"]
    }
  },
  {
    name: "bulk_update_repair_orders",
    description: "Update multiple repair orders at once with the same changes",
    input_schema: {
      type: "object",
      properties: {
        ro_numbers: {
          type: "array",
          items: { type: "string" },
          description: "List of RO numbers to update"
        },
        updates: {
          type: "object",
          description: "Updates to apply to all specified ROs (same structure as update_repair_order)"
        }
      },
      required: ["ro_numbers", "updates"]
    }
  },
  {
    name: "create_reminders",
    description: "Create Microsoft To Do tasks and Calendar events for one or more ROs",
    input_schema: {
      type: "object",
      properties: {
        ro_numbers: {
          type: "array",
          items: { type: "string" },
          description: "RO numbers to create reminders for"
        },
        reminder_date: {
          type: "string",
          description: "Date for reminders (ISO format). If not provided, uses the RO's nextDateToUpdate"
        }
      },
      required: ["ro_numbers"]
    }
  },
  {
    name: "get_statistics",
    description: "Get aggregated statistics about repair orders",
    input_schema: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: ["total_value", "average_cost", "count_by_status", "count_by_shop", "overdue_count", "average_tat"],
          description: "The statistic to calculate"
        },
        filters: {
          type: "object",
          description: "Optional filters to apply before calculating (same as query_repair_orders)"
        }
      },
      required: ["metric"]
    }
  },
  {
    name: "generate_email_template",
    description: "Generate a professional email template for communicating with a repair shop",
    input_schema: {
      type: "object",
      properties: {
        ro_number: {
          type: "string",
          description: "RO number for the email"
        },
        template_type: {
          type: "string",
          enum: ["quote_request", "status_update", "approval", "expedite", "confirm_receipt"],
          description: "Type of email to generate"
        }
      },
      required: ["ro_number", "template_type"]
    }
  },
  {
    name: "query_reminders",
    description: "Query and retrieve information about existing RO reminders in Microsoft To Do and Calendar. Can search all reminders or filter by specific RO number.",
    input_schema: {
      type: "object",
      properties: {
        ro_number: {
          type: "string",
          description: "Optional: Specific RO number to search for. If not provided, returns all RO reminders."
        },
        date_filter: {
          type: "string",
          enum: ["all", "today", "this_week", "overdue"],
          description: "Optional: Filter reminders by date. Default is 'all'."
        }
      },
      required: []
    }
  },
  {
    name: "delete_reminders",
    description: "Delete reminders for one or more RO numbers. Removes both To Do tasks and Calendar events.",
    input_schema: {
      type: "object",
      properties: {
        ro_numbers: {
          type: "array",
          items: { type: "string" },
          description: "List of RO numbers to delete reminders for"
        }
      },
      required: ["ro_numbers"]
    }
  },
  {
    name: "update_reminder_date",
    description: "Update the due date for an RO reminder. Updates both To Do task and Calendar event if they exist.",
    input_schema: {
      type: "object",
      properties: {
        ro_number: {
          type: "string",
          description: "RO number to update reminder for"
        },
        new_date: {
          type: "string",
          description: "New due date in ISO format (YYYY-MM-DD)"
        }
      },
      required: ["ro_number", "new_date"]
    }
  },
  {
    name: "archive_repair_order",
    description: "Archive a repair order by moving it from the active sheet to the appropriate final archive sheet (Paid, NET, or Returns). Use this ONLY after confirming with the user that they have received the part. This removes the RO from the active dashboard.",
    input_schema: {
      type: "object",
      properties: {
        ro_number: {
          type: "string",
          description: "The RO number to archive"
        },
        status: {
          type: "string",
          enum: ["PAID", "NET", "BER", "RAI", "CANCEL"],
          description: "The status that determines which archive sheet to use. PAID → Paid sheet, NET → NET sheet, BER/RAI/CANCEL → Returns sheet"
        }
      },
      required: ["ro_number", "status"]
    }
  },
  {
    name: "search_inventory",
    description: "Search inventory for a specific part number across all warehouse locations. Returns quantity, condition, location, and availability for all matching inventory items.",
    input_schema: {
      type: "object",
      properties: {
        part_number: {
          type: "string",
          description: "The part number to search for (e.g., 'MS20470AD4-6', 'AN470AD4-6'). Can include dashes, which are preserved in search."
        }
      },
      required: ["part_number"]
    }
  },
  {
    name: "check_inventory_quantity",
    description: "Quick check of current total quantity for a part number across all locations. Faster than full search when only the total quantity is needed.",
    input_schema: {
      type: "object",
      properties: {
        part_number: {
          type: "string",
          description: "The part number to check quantity for"
        }
      },
      required: ["part_number"]
    }
  },
  {
    name: "create_ro_from_inventory",
    description: "Create a new repair order using a part from inventory. This will automatically decrement the inventory quantity by 1 and create an RO with pre-filled part information. Only use this if the user explicitly wants to create an RO from inventory.",
    input_schema: {
      type: "object",
      properties: {
        part_number: {
          type: "string",
          description: "Part number from inventory to use for the RO"
        },
        shop_name: {
          type: "string",
          description: "Name of the repair shop"
        },
        ro_number: {
          type: "string",
          description: "Repair order number"
        },
        serial_number: {
          type: "string",
          description: "Serial number for the part"
        },
        required_work: {
          type: "string",
          description: "Description of repair work needed"
        },
        estimated_cost: {
          type: "number",
          description: "Estimated or quoted cost for the repair (optional)"
        },
        terms: {
          type: "string",
          description: "Payment terms (optional)"
        }
      },
      required: ["part_number", "shop_name", "ro_number", "serial_number", "required_work"]
    }
  },
  {
    name: "check_low_stock",
    description: "Get a list of all parts in inventory that are below the low stock threshold. Returns detailed information including current quantity, 90-day usage patterns, recommended reorder quantities, and urgency levels. Useful for reordering checks and inventory management.",
    input_schema: {
      type: "object",
      properties: {
        threshold: {
          type: "number",
          description: "Maximum quantity threshold for low stock alert (default: 5). Parts with quantity <= this value will be returned.",
          default: 5
        }
      },
      required: []
    }
  }
];

// Tool executors
export const toolExecutors: Record<string, ToolExecutor> = {

  update_repair_order: async (input, context) => {
    const { ro_number, updates } = input;

    // Find the RO
    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return { success: false, error: `RO ${ro_number} not found` };
    }

    const statusToUpdate = updates.status || ro.currentStatus;

    // RULE: BER status requires expected return date
    if (updates.status === 'BER') {
      if (!updates.estimated_delivery_date) {
        return {
          success: false,
          needs_user_input: true,
          ro_number: ro.roNumber,
          current_status: ro.currentStatus,
          requested_status: 'BER',
          question: `RO ${ro.roNumber} is being marked as BER (Beyond Economical Repair). When do you expect the part to be returned to GenThrust?`,
          expected_input: 'A date (e.g., "this Friday", "December 20, 2025", "in 2 weeks", "next Monday")',
          current_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' }),
          action_on_input: 'I will:\n1. Update the status to BER\n2. Create a reminder for the expected return date\n3. Remove this RO from overdue tracking (BER parts don\'t need status follow-ups)',
          example_command: `Update RO ${ro.roNumber} to BER with return date "December 20, 2025"`
        };
      }

      // User provided return date - validate it
      try {
        const returnDate = new Date(updates.estimated_delivery_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(returnDate.getTime())) {
          return {
            success: false,
            error: 'Invalid date format provided for BER return date',
            provided_date: updates.estimated_delivery_date,
            example: 'Try: "this Friday", "December 20, 2025", "in 2 weeks", or "2025-12-20"'
          };
        }

        if (returnDate < today) {
          return {
            success: false,
            error: 'BER return date cannot be in the past',
            provided_date: returnDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            current_date: today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            suggestion: 'Provide a future date when you expect the part to be returned'
          };
        }

        // Create reminder for BER part return FIRST (before updating status)
        try {
          await reminderService.createReminders({
            roNumber: ro.roNumber,
            shopName: ro.shopName,
            title: `BER Part Expected Back: ${ro.partDescription}`,
            dueDate: returnDate,
            notes: `Part: ${ro.partDescription}\nMarked as BER (Beyond Economical Repair)\nExpected to be returned on ${returnDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
          });
        } catch (reminderError: any) {
          // Reminder creation failed - warn but continue with status update
          return {
            success: false,
            error: 'Failed to create BER return reminder',
            why: reminderError.message,
            suggestion: 'Create the reminder manually using create_reminders tool, then update the status to BER'
          };
        }
      } catch (dateError: any) {
        return {
          success: false,
          error: 'Error processing BER return date',
          why: dateError.message,
          example: 'Use a clear date format like "December 20, 2025" or "2025-12-20"'
        };
      }
    }

    try {
      const rowIndex = parseInt(ro.id.replace("row-", ""));

      // Prepare the update data
      const costToUpdate = updates.cost;
      const deliveryDate = updates.estimated_delivery_date ? new Date(updates.estimated_delivery_date) : undefined;
      const notes = updates.notes;
      const trackingNumber = updates.tracking_number;

      // Execute update via excelService
      await excelService.updateROStatus(
        rowIndex,
        statusToUpdate,
        notes,
        costToUpdate,
        deliveryDate,
        trackingNumber
      );

      // Invalidate React Query cache to refresh UI
      context.queryClient.invalidateQueries({ queryKey: ['repairOrders'] });

      const updatedFields = [];
      if (updates.status) updatedFields.push('status');
      if (updates.cost !== undefined) {
        // Determine which cost field was updated based on status
        const isFinalStatus = statusToUpdate.includes("PAID") || statusToUpdate.includes("SHIPPING");
        updatedFields.push(isFinalStatus ? 'final_cost' : 'estimated_cost');
      }
      if (updates.estimated_delivery_date) updatedFields.push('estimated_delivery_date');
      if (updates.notes) updatedFields.push('notes');
      if (updates.tracking_number) updatedFields.push('tracking_number');

      // RULE: BER status clears overdue tracking
      if (updates.status === 'BER') {
        return {
          success: true,
          ro_number: ro.roNumber,
          updated_fields: [...updatedFields, 'removed_from_overdue'],
          removed_from_overdue: true,
          reminder_created: true,
          expected_return_date: deliveryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          message: `✓ RO ${ro.roNumber} marked as BER (Beyond Economical Repair)\n✓ Removed from overdue tracking\n✓ Reminder created for expected return on ${deliveryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        };
      }

      // RULE: PAID status clears overdue and prompts for archival
      if (statusToUpdate.toUpperCase().includes('PAID')) {
        return {
          success: true,
          ro_number: ro.roNumber,
          updated_fields: [...updatedFields, 'removed_from_overdue'],
          removed_from_overdue: true,
          message: `✓ RO ${ro.roNumber} marked as PAID\n✓ Removed from overdue tracking`,
          archive_ready: true,
          archive_prompt: `🗄️ This RO is now marked as PAID. Have you received the part?\n\nIf YES: This RO should be archived to keep the Active sheet clean.\n\nNext steps:\n1. Confirm you have physically received the part\n2. Use the archive_repair_order tool to move this RO to the Paid archive sheet`,
          suggested_action: {
            tool: 'archive_repair_order',
            params: {
              ro_number: ro.roNumber,
              status: 'PAID'
            },
            command_example: `Archive RO ${ro.roNumber} as PAID`
          },
          reminder: 'IMPORTANT: Only archive if you have received the part. If the part is still in transit, wait until it arrives before archiving.'
        };
      }

      return {
        success: true,
        ro_number: ro.roNumber,
        updated_fields: updatedFields,
        message: `Successfully updated RO ${ro.roNumber}`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update RO'
      };
    }
  },

  query_repair_orders: async (input, context) => {
    const { filters, sort_by, limit, include_archives } = input;

    // RULE: Automatically include archives when searching by NET payment terms
    const shouldIncludeArchives = include_archives ||
      (filters.payment_terms && filters.payment_terms.toUpperCase().includes('NET'));

    let results = [...context.allROs];
    const searchedSheets = ['Active'];

    // Mark source sheet for Active ROs
    results.forEach((ro: any) => { ro._sourceSheet = 'Active'; });

    // RULE: Search archive sheets if requested or if filtering by NET payment terms
    if (shouldIncludeArchives) {
      try {
        const [paidROs, netROs, returnsROs] = await Promise.all([
          excelService.getRepairOrdersFromSheet('Paid', 'Approved_Paid'),
          excelService.getRepairOrdersFromSheet('NET', 'Approved_Net'),
          excelService.getRepairOrdersFromSheet('Returns', 'Approved_Cancel')
        ]);

        // Mark source sheet for each archived RO
        paidROs.forEach((ro: any) => { ro._sourceSheet = 'Paid'; });
        netROs.forEach((ro: any) => { ro._sourceSheet = 'NET'; });
        returnsROs.forEach((ro: any) => { ro._sourceSheet = 'Returns'; });

        // RULE: Combine all results from all sheets
        results = [...results, ...paidROs, ...netROs, ...returnsROs];
        searchedSheets.push('Paid', 'NET', 'Returns');

      } catch (error: any) {
        // RULE: If archive access fails, inform user and request permissions
        return {
          success: false,
          error: 'Cannot access archive sheets',
          permission_needed: 'Read access to archive sheets (Paid, NET, Returns)',
          why: error.message || 'Unknown error accessing archive sheets',
          available_results: results.length,
          searched_sheets: ['Active only'],
          message: `⚠️ Only searched Active sheet. Unable to access archive sheets. ${filters.payment_terms ? 'NET payment term searches require archive access.' : 'Grant read permission to Paid, NET, and Returns sheets for complete search.'}`,
          partial_results: results.map((ro: any) => ({
            ro_number: ro.roNumber,
            shop: ro.shopName,
            part: ro.partDescription,
            status: ro.currentStatus,
            cost: ro.finalCost || ro.estimatedCost,
            source_sheet: 'Active'
          }))
        };
      }
    }

    // Apply filters
    if (filters.status) {
      results = results.filter((ro: any) =>
        ro.currentStatus.toLowerCase().includes(filters.status.toLowerCase())
      );
    }

    if (filters.shop_name) {
      results = results.filter((ro: any) =>
        ro.shopName.toLowerCase().includes(filters.shop_name.toLowerCase())
      );
    }

    if (filters.is_overdue !== undefined) {
      results = results.filter((ro: any) => ro.isOverdue === filters.is_overdue);
    }

    if (filters.date_range) {
      const start = new Date(filters.date_range.start);
      const end = new Date(filters.date_range.end);
      results = results.filter((ro: any) => {
        if (!ro.dateMade) return false;
        const roDate = new Date(ro.dateMade);
        return roDate >= start && roDate <= end;
      });
    }

    if (filters.min_cost !== undefined) {
      results = results.filter((ro: any) => {
        const cost = ro.finalCost || ro.estimatedCost || 0;
        return cost >= filters.min_cost;
      });
    }

    if (filters.max_cost !== undefined) {
      results = results.filter((ro: any) => {
        const cost = ro.finalCost || ro.estimatedCost || 0;
        return cost <= filters.max_cost;
      });
    }

    if (filters.ro_numbers && filters.ro_numbers.length > 0) {
      results = results.filter((ro: any) =>
        filters.ro_numbers.some((num: string) =>
          ro.roNumber.toString().includes(num) || num.includes(ro.roNumber.toString())
        )
      );
    }

    // RULE: New filter for payment terms
    if (filters.payment_terms) {
      results = results.filter((ro: any) =>
        ro.terms && ro.terms.toUpperCase().includes(filters.payment_terms.toUpperCase())
      );
    }

    // Sort
    if (sort_by) {
      switch (sort_by) {
        case 'date':
          results.sort((a: any, b: any) => {
            if (!a.dateMade) return 1;
            if (!b.dateMade) return -1;
            return new Date(b.dateMade).getTime() - new Date(a.dateMade).getTime();
          });
          break;
        case 'cost':
          results.sort((a: any, b: any) => (b.finalCost || b.estimatedCost || 0) - (a.finalCost || a.estimatedCost || 0));
          break;
        case 'overdue':
          results.sort((a: any, b: any) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
          break;
      }
    }

    // Limit
    if (limit && limit > 0) {
      results = results.slice(0, limit);
    }

    // Format results
    return {
      count: results.length,
      searched_sheets: searchedSheets,
      auto_searched_archives: shouldIncludeArchives && !include_archives ? 'Yes (payment_terms contains NET)' : 'No',
      repair_orders: results.map((ro: any) => ({
        ro_number: ro.roNumber,
        shop: ro.shopName,
        part: ro.partDescription,
        status: ro.currentStatus,
        cost: ro.finalCost || ro.estimatedCost,
        estimated_cost: ro.estimatedCost,
        final_cost: ro.finalCost,
        estimated_delivery_date: ro.estimatedDeliveryDate,
        is_overdue: ro.isOverdue,
        days_overdue: ro.daysOverdue,
        date_made: ro.dateMade,
        next_update: ro.nextDateToUpdate,
        terms: ro.terms,
        source_sheet: ro._sourceSheet // RULE: Include source sheet for each result
      }))
    };
  },

  bulk_update_repair_orders: async (input, context) => {
    const { ro_numbers, updates } = input;

    const results = {
      successful: [] as string[],
      failed: [] as { ro_number: string; error: string }[]
    };

    for (const ro_number of ro_numbers) {
      try {
        const result = await toolExecutors.update_repair_order(
          { ro_number, updates },
          context
        );

        if (result.success) {
          results.successful.push(ro_number);
        } else {
          results.failed.push({ ro_number, error: result.error });
        }
      } catch (error: any) {
        results.failed.push({ ro_number, error: error.message });
      }
    }

    return {
      total: ro_numbers.length,
      successful_count: results.successful.length,
      failed_count: results.failed.length,
      successful: results.successful,
      failed: results.failed
    };
  },

  create_reminders: async (input, context) => {
    const { ro_numbers, reminder_date } = input;

    // RULE: Always reference today's real-world date for validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = {
      successful: [] as string[],
      failed: [] as { ro_number: string; error: string }[],
      requires_confirmation: [] as { ro_number: string; calculated_date: string; reason: string }[]
    };

    for (const ro_number of ro_numbers) {
      const ro = context.allROs.find(r =>
        r.roNumber.toString().includes(ro_number) ||
        ro_number.includes(r.roNumber.toString())
      );

      if (!ro) {
        results.failed.push({ ro_number, error: 'RO not found' });
        continue;
      }

      try {
        const dueDate = reminder_date ? new Date(reminder_date) : ro.nextDateToUpdate;

        if (!dueDate) {
          results.failed.push({ ro_number, error: 'No due date available' });
          continue;
        }

        const dueDateObj = new Date(dueDate);
        dueDateObj.setHours(0, 0, 0, 0);

        // RULE: Validate date is reasonable (catch month/year errors)
        const daysDifference = Math.abs((dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // RULE: Check for dates > 90 days away (likely accidental month/year error)
        if (daysDifference > 90) {
          results.requires_confirmation.push({
            ro_number,
            calculated_date: dueDateObj.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              weekday: 'long'
            }),
            reason: `Reminder is ${Math.round(daysDifference)} days away (${Math.round(daysDifference / 30)} months). Please confirm this date is correct and not a month/year error.`
          });
          continue;
        }

        // RULE: Check for past dates (likely an error)
        if (dueDateObj < today) {
          const daysAgo = Math.round((today.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
          results.requires_confirmation.push({
            ro_number,
            calculated_date: dueDateObj.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              weekday: 'long'
            }),
            reason: `This date is ${daysAgo} day${daysAgo !== 1 ? 's' : ''} in the PAST. Did you mean a future date? Today is ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
          });
          continue;
        }

        // RULE: Ensure Remind Me = Due Date (both must match exactly)
        // reminderService.createReminders sets both dueDateTime and reminderDateTime to the same value
        await reminderService.createReminders({
          roNumber: ro.roNumber,
          shopName: ro.shopName,
          title: `Follow up: RO ${ro.roNumber} - ${ro.shopName}`,
          dueDate: new Date(dueDate), // This sets both Due Date AND Remind Me date
          notes: `Part: ${ro.partDescription}\nStatus: ${ro.currentStatus}`
        });

        results.successful.push(ro_number);
      } catch (error: any) {
        results.failed.push({ ro_number, error: error.message });
      }
    }

    // RULE: If any dates need confirmation, return them for user approval
    if (results.requires_confirmation.length > 0) {
      return {
        total: ro_numbers.length,
        successful_count: results.successful.length,
        failed_count: results.failed.length,
        requires_confirmation_count: results.requires_confirmation.length,
        successful: results.successful,
        failed: results.failed,
        requires_confirmation: results.requires_confirmation,
        message: `⚠️ ${results.requires_confirmation.length} reminder${results.requires_confirmation.length !== 1 ? 's' : ''} need${results.requires_confirmation.length === 1 ? 's' : ''} date confirmation before creating. Please verify the dates above are correct.`,
        user_action_required: 'Review the dates listed in requires_confirmation and confirm they are correct. If correct, provide explicit confirmation to proceed.'
      };
    }

    return {
      total: ro_numbers.length,
      successful_count: results.successful.length,
      failed_count: results.failed.length,
      successful: results.successful,
      failed: results.failed,
      message: results.successful.length > 0
        ? `Successfully created ${results.successful.length} reminder${results.successful.length !== 1 ? 's' : ''}`
        : 'No reminders created'
    };
  },

  get_statistics: async (input, context) => {
    const { metric, filters } = input;

    // First filter ROs if filters provided
    let ros = context.allROs;
    if (filters) {
      const queryResult = await toolExecutors.query_repair_orders(
        { filters },
        context
      );
      const roNumbers = queryResult.repair_orders.map((ro: any) => ro.ro_number.toString());
      ros = context.allROs.filter(ro => roNumbers.includes(ro.roNumber.toString()));
    }

    switch (metric) {
      case 'total_value':
        const totalValue = ros.reduce((sum, ro) => {
          return sum + (ro.finalCost || ro.estimatedCost || 0);
        }, 0);
        return {
          metric: 'total_value',
          value: totalValue,
          count: ros.length,
          formatted: `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        };

      case 'average_cost':
        const rosWithCost = ros.filter(ro => ro.finalCost || ro.estimatedCost);
        const avgCost = rosWithCost.length > 0
          ? rosWithCost.reduce((sum, ro) => sum + (ro.finalCost || ro.estimatedCost || 0), 0) / rosWithCost.length
          : 0;
        return {
          metric: 'average_cost',
          value: avgCost,
          count: rosWithCost.length,
          formatted: `$${avgCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        };

      case 'count_by_status':
        const statusCounts: Record<string, number> = {};
        ros.forEach(ro => {
          statusCounts[ro.currentStatus] = (statusCounts[ro.currentStatus] || 0) + 1;
        });
        return {
          metric: 'count_by_status',
          breakdown: statusCounts,
          total: ros.length
        };

      case 'count_by_shop':
        const shopCounts: Record<string, number> = {};
        ros.forEach(ro => {
          shopCounts[ro.shopName] = (shopCounts[ro.shopName] || 0) + 1;
        });
        return {
          metric: 'count_by_shop',
          breakdown: shopCounts,
          total: ros.length
        };

      case 'overdue_count':
        const overdueCount = ros.filter(ro => ro.isOverdue).length;
        return {
          metric: 'overdue_count',
          value: overdueCount,
          percentage: ros.length > 0 ? (overdueCount / ros.length * 100).toFixed(1) + '%' : '0%',
          total: ros.length
        };

      case 'average_tat':
        // Calculate average days from dateMade to currentStatusDate for completed ROs
        const completedROs = ros.filter(ro =>
          ro.currentStatus === 'PAID' || ro.currentStatus === 'SHIPPING'
        );
        const avgTAT = completedROs.length > 0
          ? completedROs.reduce((sum, ro) => {
              if (!ro.dateMade || !ro.currentStatusDate) return sum;
              const made = new Date(ro.dateMade).getTime();
              const completed = new Date(ro.currentStatusDate).getTime();
              const days = (completed - made) / (1000 * 60 * 60 * 24);
              return sum + days;
            }, 0) / completedROs.length
          : 0;
        return {
          metric: 'average_tat',
          value: Math.round(avgTAT),
          unit: 'days',
          count: completedROs.length
        };

      default:
        return { error: `Unknown metric: ${metric}` };
    }
  },

  generate_email_template: async (input, context) => {
    const { ro_number, template_type } = input;

    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return { success: false, error: `RO ${ro_number} not found` };
    }

    const shop = context.allShops.find(s => s.shopName === ro.shopName);

    try {
      const email = generateEmailForAI(template_type, ro, shop || null);
      return {
        success: true,
        ro_number: ro.roNumber,
        template_type,
        email: {
          to: email.to,
          subject: email.subject,
          body: email.body
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  query_reminders: async (input, context) => {
    const { ro_number, date_filter = 'all' } = input;

    try {
      // Get reminders from Microsoft services
      let reminders = await reminderService.searchROReminders(ro_number);

      // Apply date filter
      const now = new Date();
      if (date_filter === 'today') {
        const today = now.toDateString();
        reminders = reminders.filter(r => r.dueDate.toDateString() === today);
      } else if (date_filter === 'this_week') {
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        reminders = reminders.filter(r => r.dueDate >= now && r.dueDate <= weekFromNow);
      } else if (date_filter === 'overdue') {
        reminders = reminders.filter(r => r.dueDate < now);
      }

      // Match with actual ROs to get additional info
      const enrichedReminders = reminders.map(reminder => {
        const ro = context.allROs.find(r =>
          r.roNumber.toString().includes(reminder.roNumber) ||
          reminder.roNumber.includes(r.roNumber.toString())
        );

        return {
          ro_number: reminder.roNumber,
          reminder_type: reminder.type,
          due_date: reminder.dueDate.toISOString(),
          has_todo: !!reminder.todoTask,
          has_calendar: !!reminder.calendarEvent,
          todo_status: reminder.todoTask?.status,
          // Include RO info if found
          ro_exists: !!ro,
          ro_status: ro?.currentStatus,
          ro_shop: ro?.shopName,
          ro_actual_due_date: ro?.nextDateToUpdate,
          is_overdue: reminder.dueDate < now
        };
      });

      return {
        total_count: enrichedReminders.length,
        filter_applied: date_filter,
        reminders: enrichedReminders
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to query reminders'
      };
    }
  },

  delete_reminders: async (input, _context) => {
    const { ro_numbers } = input;

    const results = {
      successful: [] as string[],
      partial: [] as { ro_number: string; details: string }[],
      failed: [] as { ro_number: string; error: string }[]
    };

    for (const ro_number of ro_numbers) {
      try {
        const result = await reminderService.deleteROReminder(ro_number);

        if (result.todo && result.calendar) {
          // Both deleted successfully
          results.successful.push(ro_number);
        } else if (result.todo || result.calendar) {
          // Only one deleted (partial success)
          const deletedFrom = result.todo ? 'To Do' : 'Calendar';
          const missingFrom = result.todo ? 'Calendar' : 'To Do';
          results.partial.push({
            ro_number,
            details: `Deleted from ${deletedFrom} (no ${missingFrom} event found)`
          });
        } else {
          // Neither found
          results.failed.push({
            ro_number,
            error: 'No reminders found for this RO'
          });
        }
      } catch (error: any) {
        results.failed.push({
          ro_number,
          error: error.message
        });
      }
    }

    return {
      total: ro_numbers.length,
      successful_count: results.successful.length,
      partial_count: results.partial.length,
      failed_count: results.failed.length,
      successful: results.successful,
      partial: results.partial,
      failed: results.failed
    };
  },

  update_reminder_date: async (input, _context) => {
    const { ro_number, new_date } = input;

    try {
      const newDateObj = new Date(new_date);

      // Validate date
      if (isNaN(newDateObj.getTime())) {
        return {
          success: false,
          error: 'Invalid date format'
        };
      }

      const result = await reminderService.updateROReminderDate(ro_number, newDateObj);

      if (!result.todo && !result.calendar) {
        return {
          success: false,
          error: 'No reminders found for this RO'
        };
      }

      return {
        success: true,
        ro_number,
        new_date: newDateObj.toISOString(),
        updated_todo: result.todo,
        updated_calendar: result.calendar,
        message: `Reminder updated to ${newDateObj.toLocaleDateString()}`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update reminder'
      };
    }
  },

  archive_repair_order: async (input, context) => {
    const { ro_number, status } = input;

    // RULE: Find the RO
    const ro = context.allROs.find(r =>
      r.roNumber.toString().includes(ro_number) ||
      ro_number.includes(r.roNumber.toString())
    );

    if (!ro) {
      return {
        success: false,
        error: `RO ${ro_number} not found in Active sheet`,
        manual_fix: `Check if the RO exists in the Excel file. It may already be archived.`
      };
    }

    // RULE: Verify the status is a final status (can be archived)
    const finalStatuses = ['PAID', 'NET', 'BER', 'RAI', 'CANCEL'];
    const upperStatus = status.toUpperCase();

    if (!finalStatuses.some(s => upperStatus.includes(s))) {
      return {
        success: false,
        error: `Cannot archive: "${status}" is not a final status`,
        allowed_statuses: finalStatuses,
        current_ro_status: ro.currentStatus,
        manual_fix: `Update the RO status to one of the final statuses (${finalStatuses.join(', ')}) before archiving.`,
        suggested_action: 'Use update_repair_order to change the status first, then archive.'
      };
    }

    // RULE: Verify RO current status matches the provided status
    const currentStatusUpper = ro.currentStatus.toUpperCase();
    if (!currentStatusUpper.includes(upperStatus) && !upperStatus.includes(currentStatusUpper)) {
      return {
        success: false,
        error: `Status mismatch: RO current status is "${ro.currentStatus}" but you requested archiving as "${status}"`,
        current_ro_status: ro.currentStatus,
        requested_status: status,
        manual_fix: `Either:
1. Update the RO status to "${status}" first using update_repair_order, then archive
2. Or archive using the current status: "${ro.currentStatus}"`,
        suggested_action: {
          option1: {
            tool: 'update_repair_order',
            params: { ro_number, updates: { status } }
          },
          option2: {
            tool: 'archive_repair_order',
            params: { ro_number, status: ro.currentStatus }
          }
        }
      };
    }

    // Determine target sheet based on status and payment terms
    const targetSheet = getFinalSheetForStatus(status, ro.terms);

    if (!targetSheet) {
      return {
        success: false,
        error: `Status "${status}" does not have an archive sheet configured`,
        current_ro_status: ro.currentStatus,
        manual_fix: 'Contact system administrator to configure archive sheet for this status.'
      };
    }

    if (targetSheet === 'prompt') {
      return {
        success: false,
        error: `RO ${ro_number} has unclear payment terms ("${ro.terms || 'none'}"). Cannot determine if it should go to PAID or NET sheet.`,
        payment_terms: ro.terms || 'Not specified',
        manual_fix: `Archive manually through the UI to choose destination (PAID or NET), or update payment terms to be more specific (e.g., "NET 30", "COD", "Prepaid").`,
        suggested_action: 'Update payment terms first, or use UI for manual archive.'
      };
    }

    // RULE: Retry logic - attempt archiving twice
    let lastError: any = null;
    let lastStep = '';

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const rowIndex = parseInt(ro.id.replace("row-", ""));

        // Step 1: Move RO to archive
        lastStep = 'Moving RO from Active sheet to archive sheet';
        await excelService.moveROToArchive(
          rowIndex,
          targetSheet.sheetName,
          targetSheet.tableName
        );

        // Step 2: Invalidate cache to refresh UI
        lastStep = 'Refreshing UI data';
        context.queryClient.invalidateQueries({ queryKey: ['repairOrders'] });

        // RULE: Success - return immediately
        return {
          success: true,
          ro_number: ro.roNumber,
          archived_to: targetSheet.sheetName,
          archived_to_description: targetSheet.description,
          attempt,
          verified_removed_from_active: true,
          message: `✓ RO ${ro.roNumber} archived to ${targetSheet.description}${attempt > 1 ? ` (succeeded on attempt ${attempt})` : ''}`
        };

      } catch (error: any) {
        lastError = error;

        if (attempt === 1) {
          // RULE: First attempt failed, wait 1 second before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // RULE: Both attempts failed - provide detailed error and manual instructions
    return {
      success: false,
      error: 'Archive failed after 2 attempts',
      what_failed: lastStep,
      why: lastError?.message || 'Unknown error',
      current_ro_status: ro.currentStatus,
      target_sheet: targetSheet.sheetName,
      target_table: targetSheet.tableName,
      ro_number: ro.roNumber,
      manual_fix: `Manually move RO ${ro.roNumber} from Active sheet to ${targetSheet.sheetName} sheet:

STEP-BY-STEP INSTRUCTIONS:
1. Open the Excel file in SharePoint: "${import.meta.env.VITE_EXCEL_FILE_NAME}"
2. Go to the "Active" sheet
3. Find RO number "${ro.roNumber}" (search with Ctrl+F)
4. Select the entire row (click the row number on the left)
5. Right-click and choose "Copy" (or press Ctrl+C)
6. Go to the "${targetSheet.sheetName}" sheet
7. Click on the first empty row in the "${targetSheet.tableName}" table
8. Right-click and choose "Insert Copied Cells" (or press Ctrl+V)
9. Go back to the "Active" sheet
10. Right-click the row with RO "${ro.roNumber}" and choose "Delete Row"
11. Save the file (Ctrl+S or click Save)

IMPORTANT: Do not close the file until it shows "Saved" in the title bar.`,
      retry_suggestion: 'Wait a few minutes and try the archive command again. The Excel file may be locked by another user or process.',
      troubleshooting: [
        'Check if someone else has the Excel file open',
        'Try refreshing your browser and signing in again',
        'Check your SharePoint permissions (you need edit access)',
        'Contact IT support if the issue persists'
      ]
    };
  },

  search_inventory: async (input, _context) => {
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

      // Calculate totals
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
  },

  check_inventory_quantity: async (input, _context) => {
    const { part_number } = input;

    try {
      const results = await inventoryService.searchInventory(part_number);

      const totalQty = results.reduce((sum, item) => sum + item.qty, 0);
      const locations = results.length;

      if (results.length === 0) {
        return {
          success: true,
          found: false,
          part_number,
          total_quantity: 0,
          locations: 0,
          message: `Part ${part_number} not found in inventory`
        };
      }

      return {
        success: true,
        found: true,
        part_number,
        total_quantity: totalQty,
        locations,
        is_low_stock: totalQty < 2,
        message: `Found ${totalQty} unit${totalQty !== 1 ? 's' : ''} across ${locations} location${locations !== 1 ? 's' : ''}`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to check inventory quantity'
      };
    }
  },

  create_ro_from_inventory: async (input, context) => {
    const { part_number, shop_name, ro_number, serial_number, required_work, estimated_cost, terms } = input;

    try {
      // First, search inventory to get part details
      const inventoryResults = await inventoryService.searchInventory(part_number);

      if (inventoryResults.length === 0) {
        return {
          success: false,
          error: `Part ${part_number} not found in inventory`
        };
      }

      // Find first available item with qty > 0
      const availableItem = inventoryResults.find(item => item.qty > 0);

      if (!availableItem) {
        return {
          success: false,
          error: `Part ${part_number} found but no inventory available (all locations have 0 qty)`
        };
      }

      // Create the RO
      const roData = {
        roNumber: ro_number,
        shopName: shop_name,
        partNumber: part_number,
        serialNumber: serial_number,
        partDescription: availableItem.description || 'No description',
        requiredWork: required_work,
        estimatedCost: estimated_cost,
        terms: terms
      };

      await excelService.addRepairOrder(roData);

      // Invalidate React Query cache to refresh UI
      context.queryClient.invalidateQueries({ queryKey: ['repairOrders'] });

      // Decrement inventory
      const decrementResult = await inventoryService.decrementInventory(
        availableItem.indexId,
        part_number,
        availableItem.tableName,
        availableItem.rowId,
        ro_number,
        `Created RO ${ro_number} for ${shop_name}`
      );

      if (!decrementResult.success) {
        return {
          success: false,
          error: `RO created but inventory decrement failed: ${decrementResult.message}`,
          ro_created: true,
          ro_number
        };
      }

      return {
        success: true,
        ro_number,
        part_number,
        shop_name,
        inventory_decremented: true,
        new_quantity: decrementResult.newQty,
        is_low_stock: decrementResult.isLowStock,
        location: availableItem.location,
        message: `RO ${ro_number} created successfully. Inventory decremented from ${decrementResult.newQty + 1} to ${decrementResult.newQty}${decrementResult.isLowStock ? ' (LOW STOCK WARNING)' : ''}`
      };

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create RO from inventory'
      };
    }
  },

  check_low_stock: async (input, context) => {
    try {
      const threshold = (input as { threshold?: number }).threshold || 5;

      // Query low stock parts from inventory service
      const lowStockResponse = await inventoryService.getLowStockParts(threshold);

      // Enrich with supplier data from repair order history
      const enrichedItems = await Promise.all(
        lowStockResponse.items.map(async (item) => {
          // Try to find supplier info from most recent RO
          let supplierInfo = null;

          if (item.lastRONumber) {
            try {
              // Find the RO to get shop info
              const allROs = context?.repairOrders || [];
              const relatedRO = allROs.find(
                ro => ro.roNumber === item.lastRONumber
              );

              if (relatedRO && relatedRO.shopName) {
                // Find shop details
                const shops = context?.shops || [];
                const supplier = shops.find(
                  shop => shop.businessName === relatedRO.shopName ||
                          shop.shopName === relatedRO.shopName
                );

                if (supplier) {
                  supplierInfo = {
                    name: supplier.businessName || supplier.shopName,
                    contact: supplier.contact,
                    phone: supplier.phone,
                    email: supplier.email,
                    paymentTerms: supplier.paymentTerms,
                    lastOrderDate: relatedRO.dateMade ?
                      new Date(relatedRO.dateMade).toISOString().split('T')[0] :
                      null
                  };
                }
              }
            } catch (err) {
              // Silently continue if we can't find supplier info
            }
          }

          return {
            ...item,
            supplierInfo
          };
        })
      );

      // Format for AI consumption
      const summary = {
        threshold,
        totalLowStockItems: lowStockResponse.totalLowStockItems,
        criticalItems: lowStockResponse.criticalItems,
        highUrgencyItems: lowStockResponse.highUrgencyItems,
        mediumUrgencyItems: enrichedItems.filter(i => i.urgency === 'medium').length,
        lowUrgencyItems: enrichedItems.filter(i => i.urgency === 'low').length
      };

      // Group by urgency for better AI presentation
      const itemsByUrgency = {
        critical: enrichedItems.filter(i => i.urgency === 'critical'),
        high: enrichedItems.filter(i => i.urgency === 'high'),
        medium: enrichedItems.filter(i => i.urgency === 'medium'),
        low: enrichedItems.filter(i => i.urgency === 'low')
      };

      return {
        success: true,
        summary,
        itemsByUrgency,
        allItems: enrichedItems,
        recommendations: enrichedItems
          .filter(item => item.recommendedReorder > 0)
          .map(item => ({
            partNumber: item.partNumber,
            description: item.description,
            currentQty: item.currentQty,
            recommendedReorder: item.recommendedReorder,
            urgency: item.urgency,
            daysUntilStockout: item.daysUntilStockout,
            monthlyUsageRate: item.monthlyUsageRate,
            supplier: item.supplierInfo?.name || 'Unknown',
            location: item.location
          })),
        message: lowStockResponse.totalLowStockItems === 0
          ? `No low stock items found (threshold: ${threshold} units)`
          : `Found ${lowStockResponse.totalLowStockItems} low stock items (${lowStockResponse.criticalItems} critical, ${lowStockResponse.highUrgencyItems} high urgency)`
      };

    } catch (error: any) {
      // Handle MySQL connection failures gracefully
      if (error.message?.includes('MySQL') || error.message?.includes('Inventory operation failed')) {
        return {
          success: false,
          error: 'Unable to check low stock: MySQL inventory database is currently unavailable. Please try again later or check the database connection.',
          retry_suggestion: 'The inventory service may be temporarily down. Wait a moment and retry your request.'
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to check low stock',
        details: error.toString()
      };
    }
  }
};
