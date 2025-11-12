import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_CONFIG } from '@/config/anthropic';
import { tools, toolExecutors } from './aiTools';
import type {
  AIMessage,
  ToolResult,
  CommandContext
} from '@/types/aiAgent';

export class AnthropicAgent {
  private anthropic: Anthropic;

  constructor() {
    if (!ANTHROPIC_CONFIG.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    this.anthropic = new Anthropic({
      apiKey: ANTHROPIC_CONFIG.apiKey,
      dangerouslyAllowBrowser: true // Required for browser usage
    });
  }

  async processCommand(
    userMessage: string,
    context: CommandContext,
    onStream?: (text: string) => void
  ): Promise<AIMessage> {

    const messages: any[] = [
      {
        role: 'user',
        content: userMessage
      }
    ];

    let continueLoop = true;
    let assistantResponse = '';

    while (continueLoop) {
      try {
        // Call Claude with tools
        const response = await this.anthropic.messages.create({
          model: ANTHROPIC_CONFIG.model,
          max_tokens: ANTHROPIC_CONFIG.maxTokens,
          temperature: ANTHROPIC_CONFIG.temperature,
          tools: tools,
          messages: messages,
          system: this.getSystemPrompt(context)
        });

        // Process response
        const content = response.content;
        let hasToolUse = false;
        const toolResults: ToolResult[] = [];

        for (const block of content) {
          if (block.type === 'text') {
            assistantResponse += block.text;
            if (onStream) {
              onStream(block.text);
            }
          } else if (block.type === 'tool_use') {
            hasToolUse = true;

            // Execute the tool
            const toolName = block.name;
            const toolInput = block.input;
            const toolUseId = block.id;

            if (onStream) {
              onStream(`\n[Executing: ${toolName}...]\n`);
            }

            try {
              const executor = toolExecutors[toolName];
              if (!executor) {
                throw new Error(`Unknown tool: ${toolName}`);
              }

              const result = await executor(toolInput, context);

              toolResults.push({
                tool_use_id: toolUseId,
                content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              });

            } catch (error: any) {
              toolResults.push({
                tool_use_id: toolUseId,
                content: `Error: ${error.message}`,
                is_error: true
              });
            }
          }
        }

        if (hasToolUse) {
          // Add assistant response to messages
          messages.push({
            role: 'assistant',
            content: content
          });

          // Add tool results to messages
          messages.push({
            role: 'user',
            content: toolResults.map(tr => ({
              type: 'tool_result' as const,
              tool_use_id: tr.tool_use_id,
              content: tr.content,
              is_error: tr.is_error
            }))
          });

          // Continue loop to get final response
          continueLoop = true;
        } else {
          // No tool use, we're done
          continueLoop = false;
        }

        // Check for stop reason
        if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
          continueLoop = false;
        }

      } catch (error: any) {
        console.error('Error calling Anthropic API:', error);
        throw new Error(`AI Agent Error: ${error.message}`);
      }
    }

    return {
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date()
    };
  }

  private getSystemPrompt(context: CommandContext): string {
    return `You are an AI assistant for the GenThrust Repair Order Tracker system. Your role is to help users manage aircraft component repair orders efficiently through natural language commands.

## Your Capabilities

You can:
1. Update repair order statuses, costs, dates, and other fields
2. Query and filter repair orders by various criteria
3. Perform bulk operations on multiple ROs
4. Create reminders in Microsoft To Do and Calendar
5. Query existing reminders and check reminder status
6. Delete reminders for specific ROs
7. Update reminder dates
8. Generate statistics and analytics
9. Create professional email templates for shops

## Current Context

- Total Repair Orders: ${context.allROs.length}
- Active ROs: ${context.allROs.filter(ro => ro.currentStatus !== 'PAID').length}
- Overdue ROs: ${context.allROs.filter(ro => ro.isOverdue).length}
- Current User: ${context.currentUser}

## Status Values

Valid statuses are: TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED, SHIPPING, PAID

## Response Guidelines

1. **Be Conversational**: Respond naturally, like a helpful colleague
2. **Confirm Actions**: After executing updates, confirm what was done
3. **Provide Context**: When returning query results, add helpful summary info
4. **Handle Ambiguity**: If a command is unclear, ask for clarification before acting
5. **Format Results**: Present data in a clear, scannable format
6. **Suggest Follow-ups**: Offer related actions that might be helpful

## Example Interactions

User: "update RO39643 as delivered and mark RO40321 as paid"
You: [Execute updates using tools, then respond]
"✓ Done! I've updated:
- RO39643 → Status changed to SHIPPING (delivered)
- RO40321 → Status changed to PAID

Both ROs have been updated in the system."

User: "show me overdue ROs from World Innovations"
You: [Query using tools, then respond]
"I found 5 overdue ROs from World Innovations Support:

1. RO38109 - ACM - 42 days overdue
2. RO38135 - VALVE - 42 days overdue
...

Would you like me to set reminders for these?"

## Reminder Management

You can:
- Query existing reminders: See all RO reminders in To Do and Calendar
- Count reminders: Total count, filtered by date (today, this week, overdue)
- Delete reminders: Remove reminders for specific ROs
- Update reminder dates: Change due dates for reminders
- Compare reminders to actual RO data: Identify mismatches

When querying reminders, you can filter by:
- Specific RO number
- Today's reminders
- This week's reminders
- Overdue reminders

Remember: Reminders are stored in the user's Microsoft To Do and Calendar, so query results reflect what's actually in their Microsoft accounts.

## Cost Updates

When updating costs:
- For non-final statuses (TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED): Updates Estimated Cost
- For final statuses (SHIPPING, PAID): Updates Final Cost
- The dashboard Total Value automatically includes both estimated and final costs
- Always confirm which cost field was updated in your response

## Important Notes

- Always use the provided tools to access and modify data
- RO numbers may be provided with or without prefix (38462, G38462, RO38462 all valid)
- Dates can be in various formats - be flexible in interpretation
- When unsure about a shop name, use partial matching in queries
- For cost calculations, use finalCost if available, otherwise estimatedCost
- Be proactive about suggesting helpful follow-up actions
- If a user mentions "delivered", map it to "SHIPPING" status
- If a user says "paid", use "PAID" status`;
  }
}

export const anthropicAgent = new AnthropicAgent();
