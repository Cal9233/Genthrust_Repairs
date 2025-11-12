import type { Tool, ToolExecutor } from '@/types/aiAgent';
import { excelService } from '@/lib/excelService';
import { reminderService } from '@/lib/reminderService';
import { generateEmailForAI } from '@/lib/emailTemplates';

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
              enum: ["TO SEND", "WAITING QUOTE", "APPROVED", "BEING REPAIRED", "SHIPPING", "PAID"],
              description: "New status for the repair order"
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
    description: "Query and filter repair orders. Returns a list of ROs matching the criteria.",
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
            }
          }
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

    try {
      const rowIndex = parseInt(ro.id.replace("row-", ""));

      // Prepare the update data
      const statusToUpdate = updates.status || ro.currentStatus;
      const costToUpdate = updates.cost;
      const deliveryDate = updates.estimated_delivery_date ? new Date(updates.estimated_delivery_date) : undefined;
      const notes = updates.notes;

      // Execute update via excelService
      await excelService.updateROStatus(
        rowIndex,
        statusToUpdate,
        notes,
        costToUpdate,
        deliveryDate
      );

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
    const { filters, sort_by, limit } = input;

    let results = [...context.allROs];

    // Apply filters
    if (filters.status) {
      results = results.filter(ro =>
        ro.currentStatus.toLowerCase().includes(filters.status.toLowerCase())
      );
    }

    if (filters.shop_name) {
      results = results.filter(ro =>
        ro.shopName.toLowerCase().includes(filters.shop_name.toLowerCase())
      );
    }

    if (filters.is_overdue !== undefined) {
      results = results.filter(ro => ro.isOverdue === filters.is_overdue);
    }

    if (filters.date_range) {
      const start = new Date(filters.date_range.start);
      const end = new Date(filters.date_range.end);
      results = results.filter(ro => {
        if (!ro.dateMade) return false;
        const roDate = new Date(ro.dateMade);
        return roDate >= start && roDate <= end;
      });
    }

    if (filters.min_cost !== undefined) {
      results = results.filter(ro => {
        const cost = ro.finalCost || ro.estimatedCost || 0;
        return cost >= filters.min_cost;
      });
    }

    if (filters.max_cost !== undefined) {
      results = results.filter(ro => {
        const cost = ro.finalCost || ro.estimatedCost || 0;
        return cost <= filters.max_cost;
      });
    }

    if (filters.ro_numbers && filters.ro_numbers.length > 0) {
      results = results.filter(ro =>
        filters.ro_numbers.some((num: string) =>
          ro.roNumber.toString().includes(num) || num.includes(ro.roNumber.toString())
        )
      );
    }

    // Sort
    if (sort_by) {
      switch (sort_by) {
        case 'date':
          results.sort((a, b) => {
            if (!a.dateMade) return 1;
            if (!b.dateMade) return -1;
            return new Date(b.dateMade).getTime() - new Date(a.dateMade).getTime();
          });
          break;
        case 'cost':
          results.sort((a, b) => (b.finalCost || b.estimatedCost || 0) - (a.finalCost || a.estimatedCost || 0));
          break;
        case 'overdue':
          results.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
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
      repair_orders: results.map(ro => ({
        ro_number: ro.roNumber,
        shop: ro.shopName,
        part: ro.partDescription,
        status: ro.currentStatus,
        cost: ro.finalCost || ro.estimatedCost,
        is_overdue: ro.isOverdue,
        days_overdue: ro.daysOverdue,
        date_made: ro.dateMade,
        next_update: ro.nextDateToUpdate
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

    const results = {
      successful: [] as string[],
      failed: [] as { ro_number: string; error: string }[]
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

        await reminderService.createReminders({
          roNumber: ro.roNumber,
          shopName: ro.shopName,
          title: `Follow up: RO ${ro.roNumber} - ${ro.shopName}`,
          dueDate: new Date(dueDate),
          notes: `Part: ${ro.partDescription}\nStatus: ${ro.currentStatus}`
        });

        results.successful.push(ro_number);
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
  }
};
