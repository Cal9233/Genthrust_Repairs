# AI Command Assistant

The AI Command Assistant allows you to update repair orders using natural language commands instead of manually clicking through forms.

## Features

- **Natural Language Processing**: Type commands in plain English
- **Intelligent Parsing**: AI understands context and extracts relevant information
- **Confirmation Required**: Review actions before they execute
- **Confidence Scores**: See how confident the AI is in understanding your command
- **Multiple Actions**: Update status, dates, costs, notes, and set reminders

## Setup

### 1. Get an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign up or log in to your account
3. Click "Create new secret key"
4. Copy the API key (you won't be able to see it again!)

### 2. Configure Your Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your OpenAI API key:
   ```
   VITE_OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

### 3. Verify Configuration

- The AI Assistant button should appear in the header (purple Sparkles icon)
- Click it or press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
- If configured correctly, you'll see the command input dialog
- If not configured, you'll see a warning message with instructions

## Usage

### Opening the Assistant

**Three ways to open:**
1. Click the purple "AI Assistant" button in the header
2. Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac)
3. Click the Sparkles icon

### Command Examples

Here are some examples of commands you can use:

#### Update Scheduled Completion Date
```
RO G38462 Scheduled Completion Date: 11/18/25
```
```
Set completion date for RO 12345 to November 20, 2025
```

#### Update Status
```
Update RO G38462 status to being repaired
```
```
RO 54321 is now shipping
```
```
Mark RO 98765 as approved
```

#### Update Multiple Fields
```
Update RO 12345 status to being repaired, cost $2500
```
```
RO G38462 is approved, scheduled for 11/18/25, cost is $3200
```

#### Set Cost
```
RO 12345 cost is $2,500
```
```
Update cost for RO G38462 to $1800
```

#### Add Notes
```
Add note to RO 54321: Customer called for update
```
```
RO 98765 note: Parts arrived, starting work tomorrow
```

#### Set Reminders
```
Set reminder for RO G38462 on 11/20/25
```
```
Remind me to check RO 12345 in 3 days
```

### How It Works

1. **Type your command** in natural language
2. **AI parses** the command to extract:
   - RO number
   - Action to perform
   - Parameters (dates, status, cost, etc.)
   - Confidence score
3. **Review the parsed action** in a confirmation dialog
4. **Execute** if everything looks correct
5. **Dashboard updates** automatically

### Supported Actions

| Action | Description | Example |
|--------|-------------|---------|
| Update Status | Change the current status | "RO 12345 status to approved" |
| Set Scheduled Date | Set completion/delivery date | "RO 12345 scheduled for 11/18/25" |
| Set Cost | Update cost information | "RO 12345 cost $2,500" |
| Add Note | Add notes to status history | "Add note to RO 12345: Customer called" |
| Set Reminder | Create a reminder | "Remind me about RO 12345 on 11/20" |
| Update Multiple | Update several fields at once | "RO 12345 approved, cost $2500, date 11/18/25" |

### Supported Status Values

- `WAITING QUOTE`
- `QUOTE RECEIVED`
- `APPROVED`
- `BEING REPAIRED`
- `SHIPPING`
- `RECEIVED`
- `PAYMENT SENT`
- `PAID`
- `BER` (Beyond Economic Repair)
- `TO SEND`

### Date Formats

The AI understands multiple date formats:
- `11/18/25` or `11/18/2025`
- `November 18, 2025`
- `Nov 18, 2025`
- Relative: "tomorrow", "next week", "in 3 days"

### RO Number Formats

- Alphanumeric: `G38462`, `RO12345`
- Numeric only: `12345`, `98765`
- With spaces: `RO 12345` (spaces are stripped)

## Cost

The AI Assistant uses OpenAI's API, which has a small cost per request:

- **GPT-4o-mini**: ~$0.002 per command (default)
- **GPT-4o**: ~$0.01 per command

**Estimated monthly cost:**
- 50 commands/day = ~$3/month
- 100 commands/day = ~$6/month
- 200 commands/day = ~$12/month

These costs are approximate and may vary based on command complexity.

## Confidence Scores

The AI provides a confidence score (0-100%) indicating how certain it is about understanding your command:

- **80-100%** (Green): High confidence - command clearly understood
- **60-79%** (Yellow): Medium confidence - may want to verify
- **0-59%** (Red): Low confidence - double-check before executing

You'll see warnings if the confidence is below 60%.

## Tips for Best Results

1. **Be specific**: Include the RO number clearly
2. **Use common formats**: Stick to standard date formats
3. **One RO at a time**: Currently supports single RO updates
4. **Review before executing**: Always check the confirmation dialog
5. **Check confidence**: Pay attention to low confidence warnings

## Troubleshooting

### "OpenAI API key not configured"
- Make sure `VITE_OPENAI_API_KEY` is set in your `.env` file
- Restart the dev server after adding the key
- Verify the key is valid (starts with `sk-`)

### "Failed to parse command"
- Check your internet connection
- Verify your OpenAI API key is valid
- Check OpenAI API status: https://status.openai.com/

### Low confidence scores
- Try rephrasing your command
- Be more explicit with RO numbers
- Use standard date formats
- Include clear action words (update, set, change)

### Command not executing
- Verify the RO number exists in your system
- Check that you have permission to update ROs
- Review any error messages in the confirmation dialog

## Security

- API keys are stored in `.env` and never committed to git
- All commands require confirmation before execution
- Commands are logged with user information
- Full audit trail maintained in status history

## Future Enhancements

Planned features:
- Batch operations (update multiple ROs at once)
- Voice input support
- Command history and quick replay
- Smart suggestions based on context
- Integration with email updates

## Support

If you encounter issues:
1. Check this documentation
2. Verify your OpenAI API key is configured
3. Check the browser console for errors
4. Contact your system administrator

## Privacy

- Commands are sent to OpenAI's API for parsing
- Only command text is sent (no sensitive business data)
- OpenAI's data usage policy applies
- See: https://openai.com/policies/api-data-usage-policies
