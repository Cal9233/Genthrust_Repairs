import { ANTHROPIC_CONFIG } from '@/config/anthropic';
import { tools, toolExecutors } from './aiTools';
import { getToolSchema, validateInput } from './aiToolSchemas';
import type {
  AIMessage,
  ToolResult,
  CommandContext
} from '@/types/aiAgent';

// Type definitions for Anthropic API responses
interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: ContentBlock[];
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface BackendAPIResponse {
  success: boolean;
  response: AnthropicResponse;
  meta?: {
    duration: number;
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export class AnthropicAgent {
  private backendUrl: string;
  private userId: string | null = null;

  constructor() {
    if (!ANTHROPIC_CONFIG.backendUrl) {
      throw new Error('Backend URL not configured');
    }

    this.backendUrl = ANTHROPIC_CONFIG.backendUrl;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  async processCommand(
    userMessage: string,
    context: CommandContext,
    onStream?: (text: string) => void,
    conversationHistory: AIMessage[] = []
  ): Promise<AIMessage> {

    // Build messages array with conversation history for context
    // Only include last 10 messages to avoid token limits
    const recentHistory = conversationHistory.slice(-10);
    const messages: any[] = [
      ...recentHistory.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    let continueLoop = true;
    let assistantResponse = '';

    while (continueLoop) {
      try {
        // Call backend proxy instead of Anthropic directly
        const response = await this.callBackendAPI({
          messages,
          model: ANTHROPIC_CONFIG.model,
          maxTokens: ANTHROPIC_CONFIG.maxTokens,
          temperature: ANTHROPIC_CONFIG.temperature,
          tools: tools,
          systemPrompt: this.getSystemPrompt(context),
          userId: this.userId || context.currentUser
        });

        // Process response
        const content = response.response.content;
        let hasToolUse = false;
        const toolResults: ToolResult[] = [];

        for (const block of content) {
          if (block.type === 'text') {
            assistantResponse += block.text;
            if (onStream) {
              onStream(block.text || '');
            }
          } else if (block.type === 'tool_use') {
            hasToolUse = true;

            // Execute the tool
            const toolName = block.name || '';
            const toolInput = block.input;
            const toolUseId = block.id || '';

            if (onStream) {
              onStream(`\n[Executing: ${toolName}...]\n`);
            }

            try {
              const executor = toolExecutors[toolName];
              if (!executor) {
                throw new Error(`Unknown tool: ${toolName}`);
              }

              // Validate input before execution
              const schema = getToolSchema(toolName);
              if (schema) {
                const validation = validateInput(schema, toolInput);
                if (!validation.success) {
                  toolResults.push({
                    tool_use_id: toolUseId,
                    content: `Input validation failed: ${validation.error?.message}`,
                    is_error: true
                  });
                  continue;
                }
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
        if (response.response.stop_reason === 'end_turn' || response.response.stop_reason === 'max_tokens') {
          continueLoop = false;
        }

      } catch (error: any) {
        // Handle rate limiting
        if (error.status === 429) {
          throw new Error(`Rate limit exceeded. ${error.message}`);
        }

        // Error calling backend API
        throw new Error(`AI Agent Error: ${error.message}`);
      }
    }

    return {
      role: 'assistant',
      content: assistantResponse,
      timestamp: new Date()
    };
  }

  private async callBackendAPI(payload: any): Promise<BackendAPIResponse> {
    const endpoint = `${this.backendUrl}/api/ai/chat`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': payload.userId || 'anonymous'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = errorData.retryAfter || 60;
          throw {
            status: 429,
            message: errorData.message || `Rate limit exceeded. Try again in ${retryAfter} seconds.`
          };
        }

        // Handle other errors
        throw new Error(
          errorData.message || `Backend API error: ${response.status} ${response.statusText}`
        );
      }

      const data: BackendAPIResponse = await response.json();

      if (!data.success) {
        throw new Error('Backend API returned unsuccessful response');
      }

      return data;

    } catch (error: any) {
      // Network or parsing errors
      if (error.status === 429) {
        throw error; // Re-throw rate limit errors
      }

      throw new Error(`Failed to connect to AI backend: ${error.message}`);
    }
  }

  private getSystemPrompt(context: CommandContext): string {
    return `You are a professional AI assistant for the GenThrust Repair Order Tracker system. Your role is to help users manage aircraft component repair orders efficiently through natural language commands.

## CRITICAL: Professional Communication Standards

- Use ONLY professional business language
- NO emojis, emoticons, or casual symbols (✓, ✨, #, etc.)
- Use simple bullet points with "-" or numbered lists "1."
- Keep responses clear, concise, and professional
- Use proper grammar and punctuation
- Avoid exclamation marks unless truly exceptional

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
10. Search inventory for parts across all warehouse locations
11. Check inventory quantities quickly
12. Create ROs directly from inventory (with automatic inventory decrement)
13. Check for low stock items

## Current Context

- Total Repair Orders: ${context.allROs.length}
- Active ROs: ${context.allROs.filter(ro => ro.currentStatus !== 'PAID').length}
- Overdue ROs: ${context.allROs.filter(ro => ro.isOverdue).length}
- Current User: ${context.currentUser}

## Status Values

Valid statuses are: TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED, SHIPPING, PAID, PAYMENT SENT, RAI, BER

**Important Abbreviations:**
- **RAI** = Return As Is (part is being returned without repair)
- **BER** = Beyond Economical Repair (part cannot be repaired cost-effectively)

When a user mentions "RAI" or "Return As Is", use the status "RAI".
When a user mentions "BER" or "Beyond Economical Repair", use the status "BER".

## Response Guidelines

1. **Be Professional**: Respond in clear, professional business language
2. **Confirm Actions**: After executing updates, confirm what was done
3. **Provide Context**: When returning query results, add helpful summary info
4. **Handle Ambiguity**: If a command is unclear, ask for clarification before acting
5. **Format Results**: Present data in a clear, scannable format using simple formatting
6. **Suggest Follow-ups**: Offer related actions that might be helpful
7. **No Repetition**: Never repeat or echo the user's message back to them

## Example Interactions

User: "update RO39643 as delivered and mark RO40321 as paid"
You: [Execute updates using tools, then respond]
"Done. I have updated:
- RO39643: Status changed to SHIPPING (delivered)
- RO40321: Status changed to PAID

Both ROs have been updated in the system."

User: "show me overdue ROs from World Innovations"
You: [Query using tools, then respond]
"I found 5 overdue ROs from World Innovations Support:

1. RO38109 - ACM - 42 days overdue
2. RO38135 - VALVE - 42 days overdue
...

Would you like me to set reminders for these?"

User: "show me details for RO38451"
You: [Query using tools, then respond]
"RO 38451 Details:
- Shop: Delta Tech Ops
- Part: ECU
- Status: APPROVED
- Cost: $8,829.40
- Estimated Delivery: November 23, 2025
- Next Update Due: November 19, 2025
- Payment Terms: NET 30

Status: On track (6 days ahead)"

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

## Inventory Management

You have access to a comprehensive inventory system with 6,571+ parts across 11 warehouse locations.

**Inventory Capabilities:**

1. **Search Inventory** - Find parts by part number
   - Returns all locations where part is stored
   - Shows quantity, condition, location for each entry
   - Identifies low stock items (qty < 2)
   - Example: "Do we have MS20470AD4-6?" or "Check if we have part AN470AD4-6"

2. **Quick Quantity Check** - Get total quantity across all locations
   - Faster than full search when only qty is needed
   - Example: "What's the quantity for MS20470AD4-6?"

3. **Create RO from Inventory** - Create repair order using inventory part
   - Automatically decrements inventory by 1
   - Pre-fills part description from inventory
   - Logs transaction with RO number
   - Shows low stock warning if qty drops below 2
   - Example: "Create RO for part MS20470AD4-6 with Duncan Aviation, RO number RO-12345"

4. **Check Low Stock** - Find all parts below threshold (currently limited)
   - Note: This feature requires manual implementation
   - For now, direct users to use the Inventory Search tab

**Important Inventory Notes:**

- Part numbers preserve dashes (MS20470AD4-6 ≠ MS20470AD46)
- Inventory decrements happen automatically when creating RO from inventory
- Low stock threshold is 2 units
- All inventory changes are logged with user, timestamp, and RO number
- Inventory data is indexed from 11 Excel tables (Bins, Stock Room, MD82, 727, TERRA, etc.)

**Example Inventory Interactions:**

User: "Check if we have part MS20470AD4-6"
You: [Use search_inventory] → "Found 3 units in Bins Inventory, condition NEW, location 1N3-2A"

User: "What's the quantity for AN470AD4-6?"
You: [Use check_inventory_quantity] → "Total quantity: 5 units across 2 locations"

User: "Create RO for part MS20470AD4-6 with Duncan Aviation, RO number RO-12345, serial 12345, needs overhaul"
You: [Use create_ro_from_inventory] → "Created RO-12345 successfully! Inventory decremented from 3 to 2 units. Part located in Bins Inventory."

User: "Do we have enough MS20470AD4-6 to send 2 units for repair?"
You: [Use search_inventory] → "Yes, 3 units available across 1 location. Would you like me to create ROs for them?"

## Cost Updates

When updating costs:
- For non-final statuses (TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED): Updates Estimated Cost
- For final statuses (SHIPPING, PAID): Updates Final Cost
- The dashboard Total Value automatically includes both estimated and final costs
- Always confirm which cost field was updated in your response

## Archiving ROs - IMPORTANT

When updating an RO to a final status (PAID, NET, BER, RAI, or CANCEL), you MUST ask the user if they have received the part:

**Final Statuses that require confirmation:**
- PAID → Archives to "Paid" sheet
- NET → Archives to "NET" sheet
- BER/RAI/CANCEL → Archives to "Returns" sheet

**Workflow:**
1. When user requests updating to a final status, FIRST update the status using update_repair_order
2. Then ASK: "Have you received this part?"
3. If YES: Use the archive_repair_order tool to move it to the appropriate archive sheet
4. If NO: Leave it in the active sheet (do NOT archive)

**Example:**
User: "Update RO 38549 to PAID with cost 1000"
You: [Use update_repair_order with status=PAID, cost=1000]
"✓ RO 38549 updated to PAID with final cost $1000. Have you received this part? If yes, I'll archive it to the Paid sheet."

User: "Yes"
You: [Use archive_repair_order with ro_number=38549, status=PAID]
"✓ RO 38549 has been archived to the Paid sheet and removed from the active dashboard."

## Important Notes

- Always use the provided tools to access and modify data
- RO numbers may be provided with or without prefix (38462, G38462, RO38462 all valid)
- Dates can be in various formats - be flexible in interpretation
- When unsure about a shop name, use partial matching in queries
- For cost calculations, use finalCost if available, otherwise estimatedCost
- When displaying RO details, ALWAYS include the estimated delivery date if it exists
- When you update an RO with an estimated delivery date, confirm the date was set
- Be proactive about suggesting helpful follow-up actions
- If a user mentions "delivered", map it to "SHIPPING" status
- If a user says "paid", use "PAID" status`;
  }
}

export const anthropicAgent = new AnthropicAgent();
