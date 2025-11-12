# AI Assistant - Conversational Repair Order Agent

## Overview

The AI Assistant is a conversational agent powered by **Claude Sonnet 4** that allows you to manage repair orders using natural language commands. It can execute multiple actions in one command, query data, perform bulk operations, and provide analytics.

## Features

✨ **Natural Language Commands**: No need to learn specific syntax - just type what you want to do

🚀 **Multi-Action Execution**: Execute multiple operations in a single command
- "update RO39643 as delivered and mark RO40321 as paid"

🔍 **Conversational Queries**: Ask questions naturally
- "show me overdue ROs from World Innovations Support"
- "what's the total value of approved repairs?"

⚡ **Bulk Operations**: Update multiple ROs at once
- "mark all ROs from Florida Aero Systems as shipped"

📊 **Analytics & Insights**: Get statistics and reports
- "compare our TAT vs typical for each shop"
- "show me the most expensive repairs this month"

📧 **Email Generation**: Create professional emails for shops
- "generate an expedite email for RO38500"

## Getting Started

### 1. Get Your Anthropic API Key

1. Visit [https://console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Sign up or log in to your Anthropic account
3. Create a new API key
4. Copy the key (it starts with `sk-ant-`)

### 2. Configure the Application

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Anthropic API key to `.env`:
   ```env
   VITE_ANTHROPIC_API_KEY=sk-ant-your-actual-api-key-here
   ```

3. Restart the development server if it's running:
   ```bash
   npm run dev
   ```

### 3. Open the AI Assistant

- Click the **AI Agent** button in the header (purple sparkle icon)
- Or press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac)

## Usage Examples

### Simple Updates

```
"update RO38462 status to approved"
"set cost for RO38500 to $2500"
"mark RO39000 as shipped"
```

### Multi-Action Commands

```
"update RO39643 as delivered and mark RO40321 as paid"
"approve RO38500 with cost $2500 and set delivery for 11/18/25"
```

### Query Commands

```
"show me all overdue ROs"
"tell me all ROs from october"
"what ROs are from World Innovations Support?"
"find ROs with cost over $5000"
```

### Statistics

```
"what's the total value of approved repairs?"
"how many ROs are overdue?"
"show me average cost by shop"
"what's our average turnaround time?"
```

### Complex Mixed Operations

```
"show me overdue ROs from World Innovations and set reminders for all of them"
"mark all ROs from Florida Aero as shipped and tell me the total count"
```

### Email Templates

```
"generate a quote request email for RO38462"
"create an expedite email for RO39000"
"make an approval email for RO40123"
```

## Available Actions

### 1. Update Repair Orders
- Change status (TO SEND, WAITING QUOTE, APPROVED, BEING REPAIRED, SHIPPING, PAID)
- Update costs (estimated or final)
- Set delivery dates
- Add notes
- Update tracking numbers

### 2. Query & Filter
- Filter by status, shop, date range, cost
- Find overdue ROs
- Search by RO number
- Sort by various criteria

### 3. Bulk Operations
- Update multiple ROs with same changes
- Useful for batch status updates

### 4. Reminders
- Create Microsoft To Do tasks
- Create Outlook Calendar events
- Automatic or custom reminder dates

### 5. Statistics & Analytics
- Total value calculations
- Average costs
- Count by status or shop
- Overdue metrics
- Average turnaround time

### 6. Email Templates
- Quote requests
- Status updates
- Repair approvals
- Expedite requests
- Receipt confirmations

## Tips for Best Results

### Be Natural
The AI understands natural language, so you can phrase commands conversationally:
- ✅ "update RO39643 as delivered"
- ✅ "mark RO39643 as shipped"
- ✅ "set RO39643 to SHIPPING status"

All of these work the same way!

### RO Number Flexibility
You can refer to RO numbers in different formats:
- `38462`
- `RO38462`
- `G38462`

The AI will find the right repair order.

### Status Aliases
The AI understands common phrases:
- "delivered" → SHIPPING status
- "paid" → PAID status
- "being fixed" → BEING REPAIRED status
- "waiting for quote" → WAITING QUOTE status

### Multiple Actions
Chain multiple actions in one command:
- "update RO1 as paid, RO2 as shipped, and show me all overdue ROs"

### Ask for Clarification
If the AI is unsure, it will ask you to clarify:
- "Which RO did you mean?"
- "What status would you like to set?"

### Follow-up Suggestions
The AI will often suggest helpful follow-up actions:
- After showing overdue ROs: "Would you like me to set reminders for these?"
- After querying: "Would you like to export these to CSV?"

## Cost Estimates

The AI Agent uses Claude Sonnet 4, which costs approximately:
- **$0.015-0.030 per command** (depending on complexity)
- For typical usage (10-20 commands/day): **$5-10/month**

Simple queries are cheaper than complex multi-action commands with bulk updates.

## Keyboard Shortcuts

- **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac): Open AI Agent
- **Enter**: Send message
- **Shift+Enter**: New line in message

## Troubleshooting

### "API key not configured" Error
- Make sure you've added `VITE_ANTHROPIC_API_KEY` to your `.env` file
- Restart the dev server after adding the key
- Check that the key starts with `sk-ant-`

### "RO not found" Error
- Double-check the RO number
- Try using just the numeric part (e.g., `38462` instead of `RO38462`)
- The RO might not exist in the system

### Slow Response
- Complex queries with many ROs may take a few seconds
- Network latency can affect response time
- The AI processes tool calls sequentially for safety

### Unexpected Results
- Be more specific in your commands
- Break complex operations into smaller steps
- Check the status history of the RO to see what changed

## Security & Privacy

- ✅ API key is stored locally in `.env` (never committed to git)
- ✅ All data stays within your Azure/SharePoint environment
- ✅ AI only sees RO data you already have access to
- ✅ Actions are attributable to your logged-in user
- ⚠️ Don't share your Anthropic API key with others
- ⚠️ Using `dangerouslyAllowBrowser: true` is OK for internal/demo use

## Technical Details

### Architecture
- **Model**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- **Max Tokens**: 4096
- **Temperature**: 0.2 (for more consistent results)
- **Tool Use**: Function calling pattern for safe, structured operations

### Available Tools
1. `update_repair_order` - Update a single RO
2. `query_repair_orders` - Search and filter ROs
3. `bulk_update_repair_orders` - Update multiple ROs
4. `create_reminders` - Create To Do tasks and Calendar events
5. `get_statistics` - Calculate metrics and analytics
6. `generate_email_template` - Create professional emails

### Data Flow
1. User types command → 2. AI analyzes intent → 3. AI calls appropriate tools → 4. Tools execute via existing services (excelService, reminderService) → 5. AI summarizes results

## Support & Feedback

If you encounter issues or have suggestions:
1. Check this README for common solutions
2. Review the console for error messages
3. Contact the development team

## Future Enhancements

Planned features (not yet implemented):
- 🎤 Voice input support
- 💬 Multi-turn conversations with context retention
- 📋 Command history with one-click replay
- 🔄 Scheduled commands (run report every Monday)
- 📥 Export conversations to PDF

---

**Powered by Claude Sonnet 4** • Built with ❤️ for GenThrust Aviation
