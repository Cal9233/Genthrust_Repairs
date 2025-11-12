import type { RepairOrder } from '../types';
import type {
  ParsedCommand,
  CommandResult,
  CommandValidation,
  AIParserResponse,
} from '../types/aiCommand';
import { excelService } from '../lib/excelService';
import { reminderService } from '../lib/reminderService';

/**
 * Command Processor Service
 *
 * Executes parsed AI commands by interfacing with existing services
 */
class CommandProcessorService {
  /**
   * Validate a parsed command before execution
   */
  async validateCommand(command: ParsedCommand): Promise<CommandValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if RO number is provided
    if (!command.roNumber) {
      errors.push('RO number is required');
      return { isValid: false, errors, warnings };
    }

    // Check if RO exists
    try {
      const ros = await excelService.getRepairOrders();
      const ro = ros.find((r) => r.roNumber === command.roNumber);

      if (!ro) {
        errors.push(`RO ${command.roNumber} not found`);
        return { isValid: false, errors, warnings };
      }
    } catch (error) {
      errors.push('Failed to validate RO existence');
      return { isValid: false, errors, warnings };
    }

    // Validate action-specific parameters
    switch (command.action) {
      case 'update_status':
      case 'update_multiple_fields':
        if (!command.params.status && !command.params.cost && !command.params.notes) {
          errors.push('At least one field must be specified for update');
        }
        break;

      case 'set_scheduled_date':
        if (!command.params.scheduledCompletionDate) {
          errors.push('Scheduled completion date is required');
        } else {
          // Validate date format
          const date = new Date(command.params.scheduledCompletionDate);
          if (isNaN(date.getTime())) {
            errors.push('Invalid date format');
          }
        }
        break;

      case 'set_reminder':
        if (!command.params.reminderDate) {
          errors.push('Reminder date is required');
        }
        break;

      case 'add_note':
        if (!command.params.notes) {
          errors.push('Note text is required');
        }
        break;

      case 'set_cost':
        if (command.params.cost === undefined || command.params.cost === null) {
          errors.push('Cost value is required');
        } else if (command.params.cost < 0) {
          errors.push('Cost cannot be negative');
        }
        break;

      case 'unknown':
        errors.push('Unable to understand the command');
        break;
    }

    // Check confidence level
    if (command.confidence < 0.6) {
      warnings.push('Low confidence in command interpretation - please verify');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Execute a validated command
   */
  async executeCommand(command: ParsedCommand): Promise<CommandResult> {
    try {
      // Validate first
      const validation = await this.validateCommand(command);
      if (!validation.isValid) {
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          command,
          error: validation.errors[0],
        };
      }

      // Get the RO and its row index
      const ros = await excelService.getRepairOrders();
      const ro = ros.find((r) => r.roNumber === command.roNumber);

      if (!ro) {
        return {
          success: false,
          message: `RO ${command.roNumber} not found`,
          command,
          error: 'RO not found',
        };
      }

      const rowIndex = parseInt(ro.id.replace('row-', ''));

      // Execute based on action type
      switch (command.action) {
        case 'update_status':
          return await this.executeStatusUpdate(rowIndex, command, ro);

        case 'set_scheduled_date':
          return await this.executeScheduledDateUpdate(rowIndex, command, ro);

        case 'add_note':
          return await this.executeNoteAdd(rowIndex, command, ro);

        case 'set_cost':
          return await this.executeCostUpdate(rowIndex, command, ro);

        case 'set_reminder':
          return await this.executeReminderSet(command, ro);

        case 'update_multiple_fields':
          return await this.executeMultipleFieldsUpdate(rowIndex, command, ro);

        default:
          return {
            success: false,
            message: 'Unknown action type',
            command,
            error: 'Unknown action',
          };
      }
    } catch (error: any) {
      console.error('[CommandProcessor] Execution error:', error);
      return {
        success: false,
        message: `Failed to execute command: ${error.message}`,
        command,
        error: error.message,
      };
    }
  }

  /**
   * Execute status update
   */
  private async executeStatusUpdate(
    rowIndex: number,
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const status = command.params.status || ro.currentStatus;
    const notes = command.params.notes || `Status updated via AI command`;

    await excelService.updateROStatus(rowIndex, status, notes);

    return {
      success: true,
      message: `Updated RO ${command.roNumber} status to ${status}`,
      command,
    };
  }

  /**
   * Execute scheduled date update
   */
  private async executeScheduledDateUpdate(
    rowIndex: number,
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const scheduledDate = command.params.scheduledCompletionDate;
    if (!scheduledDate) {
      return {
        success: false,
        message: 'Scheduled date is required',
        command,
        error: 'Missing scheduled date',
      };
    }

    const date = new Date(scheduledDate);
    const notes = `Scheduled completion date set to ${date.toLocaleDateString()} via AI command`;

    // Update the estimated delivery date
    await excelService.updateROStatus(rowIndex, ro.currentStatus, notes, undefined, date);

    return {
      success: true,
      message: `Set scheduled completion date for RO ${command.roNumber} to ${date.toLocaleDateString()}`,
      command,
    };
  }

  /**
   * Execute note addition
   */
  private async executeNoteAdd(
    rowIndex: number,
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const notes = command.params.notes || '';

    await excelService.updateROStatus(rowIndex, ro.currentStatus, notes);

    return {
      success: true,
      message: `Added note to RO ${command.roNumber}`,
      command,
    };
  }

  /**
   * Execute cost update
   */
  private async executeCostUpdate(
    rowIndex: number,
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const cost = command.params.cost;
    if (cost === undefined || cost === null) {
      return {
        success: false,
        message: 'Cost value is required',
        command,
        error: 'Missing cost',
      };
    }

    const notes = `Cost updated to $${cost.toLocaleString()} via AI command`;

    await excelService.updateROStatus(rowIndex, ro.currentStatus, notes, cost);

    return {
      success: true,
      message: `Updated cost for RO ${command.roNumber} to $${cost.toLocaleString()}`,
      command,
    };
  }

  /**
   * Execute reminder setting
   */
  private async executeReminderSet(
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const reminderDate = command.params.reminderDate;
    if (!reminderDate) {
      return {
        success: false,
        message: 'Reminder date is required',
        command,
        error: 'Missing reminder date',
      };
    }

    const date = new Date(reminderDate);
    const note = command.params.reminderNote || `Follow up on RO ${command.roNumber}`;

    await reminderService.createReminders(
      {
        roNumber: command.roNumber,
        shopName: ro.shopName,
        title: 'Status Update',
        dueDate: date,
        notes: note,
      },
      { todo: true, calendar: true }
    );

    return {
      success: true,
      message: `Set reminder for RO ${command.roNumber} on ${date.toLocaleDateString()}`,
      command,
    };
  }

  /**
   * Execute multiple fields update
   */
  private async executeMultipleFieldsUpdate(
    rowIndex: number,
    command: ParsedCommand,
    ro: RepairOrder
  ): Promise<CommandResult> {
    const { status, cost, notes, scheduledCompletionDate } = command.params;

    // Build update note
    const updates: string[] = [];
    if (status) updates.push(`status to ${status}`);
    if (cost !== undefined) updates.push(`cost to $${cost.toLocaleString()}`);
    if (scheduledCompletionDate) {
      const date = new Date(scheduledCompletionDate);
      updates.push(`scheduled date to ${date.toLocaleDateString()}`);
    }

    const updateNote = notes || `Updated ${updates.join(', ')} via AI command`;

    const deliveryDate = scheduledCompletionDate ? new Date(scheduledCompletionDate) : undefined;

    await excelService.updateROStatus(
      rowIndex,
      status || ro.currentStatus,
      updateNote,
      cost,
      deliveryDate
    );

    return {
      success: true,
      message: `Updated RO ${command.roNumber}: ${updates.join(', ')}`,
      command,
    };
  }

  /**
   * Create a ParsedCommand from an AI response
   */
  createParsedCommand(text: string, aiResponse: AIParserResponse): ParsedCommand {
    return {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      originalText: text,
      action: aiResponse.action,
      roNumber: aiResponse.roNumber || '',
      params: aiResponse.params,
      confidence: aiResponse.confidence,
      parsedAt: new Date(),
    };
  }

  /**
   * Get a human-readable summary of what a command will do
   */
  getCommandSummary(command: ParsedCommand): string {
    const parts: string[] = [`RO ${command.roNumber}`];

    switch (command.action) {
      case 'update_status':
        if (command.params.status) {
          parts.push(`→ Status: ${command.params.status}`);
        }
        break;

      case 'set_scheduled_date':
        if (command.params.scheduledCompletionDate) {
          const date = new Date(command.params.scheduledCompletionDate);
          parts.push(`→ Scheduled: ${date.toLocaleDateString()}`);
        }
        break;

      case 'add_note':
        parts.push(`→ Add note: "${command.params.notes}"`);
        break;

      case 'set_cost':
        if (command.params.cost !== undefined) {
          parts.push(`→ Cost: $${command.params.cost.toLocaleString()}`);
        }
        break;

      case 'set_reminder':
        if (command.params.reminderDate) {
          const date = new Date(command.params.reminderDate);
          parts.push(`→ Reminder: ${date.toLocaleDateString()}`);
        }
        break;

      case 'update_multiple_fields':
        const updates: string[] = [];
        if (command.params.status) updates.push(`Status: ${command.params.status}`);
        if (command.params.cost !== undefined)
          updates.push(`Cost: $${command.params.cost.toLocaleString()}`);
        if (command.params.scheduledCompletionDate) {
          const date = new Date(command.params.scheduledCompletionDate);
          updates.push(`Scheduled: ${date.toLocaleDateString()}`);
        }
        parts.push(`→ ${updates.join(', ')}`);
        break;

      default:
        parts.push('→ Unknown action');
    }

    return parts.join(' ');
  }
}

export const commandProcessorService = new CommandProcessorService();
