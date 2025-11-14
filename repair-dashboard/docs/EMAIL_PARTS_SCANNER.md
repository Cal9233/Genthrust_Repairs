# Email Parts List Scanner - Power Automate Flow

This document provides step-by-step instructions for setting up a Power Automate flow that automatically processes emails containing parts lists and checks inventory availability.

## Overview

When you receive an email with a parts list from customers or vendors, this flow will:
1. Extract part numbers from the email body
2. Check each part against your inventory index
3. Send back an automated availability report

## Prerequisites

- Microsoft Power Automate access
- SharePoint site with inventory workbook
- Email account (Office 365/Outlook)
- InventoryIndexTable populated in SharePoint Excel

## Flow Setup

### 1. Create New Flow

1. Go to https://make.powerautomate.com
2. Click **Create** → **Automated cloud flow**
3. Name: "Parts Availability Checker"
4. Trigger: **When a new email arrives (V3)**

### 2. Configure Email Trigger

**Settings:**
- **Folder**: Inbox
- **Subject Filter** (Optional):
  - Contains: "Parts Request" OR
  - Contains: "Parts List" OR
  - Contains: "Quote Request"
- **From** (Optional): Specific vendor/customer emails
- **Include Attachments**: No
- **Importance**: All

### 3. Initialize Variables

Add 3 "Initialize variable" actions:

**Variable 1: foundParts**
- Name: `foundParts`
- Type: Array
- Value: `[]`

**Variable 2: missingParts**
- Name: `missingParts`
- Type: Array
- Value: `[]`

**Variable 3: lowStockParts**
- Name: `lowStockParts`
- Type: Array
- Value: `[]`

### 4. Extract Part Numbers from Email

Add **Data Operation - Select** action:

**Method 1: Using AI Builder (Recommended)**
1. Add **Predict** action (AI Builder)
2. Model type: **Text recognition**
3. Text: Email body
4. Configure to extract patterns matching part numbers

**Method 2: Using Compose + Regular Expression**
1. Add **Compose** action
2. Inputs:
```
split(body('When_a_new_email_arrives_(V3)')?['body'], ' ')
```
3. This splits email into words
4. Use **Filter array** to match pattern: `[A-Z0-9-]{5,20}`

**Part Number Regex Pattern:**
```
[A-Z0-9-]{5,20}
```
This matches:
- Uppercase letters and numbers
- Dashes allowed (MS20470AD4-6)
- 5-20 characters long

### 5. Query Inventory for Each Part

Add **Apply to each** control:

**Select output from previous step:** Part numbers array

**Inside the loop:**

1. **Get SharePoint List Rows** (or Excel Get Rows):
   - Site Address: Your SharePoint site
   - List/Workbook: InventoryIndexTable
   - Filter Query:
     ```
     PartNumber eq '@{items('Apply_to_each')}'
     ```

2. **Condition** - Check if part was found:
   - If `length(body('Get_rows')['value'])` is greater than 0:
     - **TRUE**: Part found
       - Get qty from first result: `body('Get_rows')?['value'][0]['Qty']`
       - Add **Condition**: Is qty < 2?
         - **YES**: Append to `lowStockParts`
         - **NO**: Append to `foundParts`
     - **FALSE**: Part not found
       - Append to `missingParts`

### 6. Compose Email Response

Add **Compose** action to build HTML email:

```html
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
    h2 { color: #0078D4; }
    h3 { margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    th { background-color: #0078D4; color: white; padding: 10px; text-align: left; }
    td { border: 1px solid #ddd; padding: 8px; }
    .available { color: green; font-weight: bold; }
    .low-stock { color: orange; font-weight: bold; }
    .missing { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <h2>📦 Parts Availability Report</h2>
  <p>Automated scan completed on @{utcNow('MM/dd/yyyy HH:mm')}</p>

  <h3>✅ Available Parts (@{length(variables('foundParts'))})</h3>
  @{if(greater(length(variables('foundParts')), 0), '
  <table>
    <tr>
      <th>Part Number</th>
      <th>Quantity</th>
      <th>Location</th>
      <th>Condition</th>
    </tr>
    ' & join(
      select(
        variables('foundParts'),
        concat('<tr><td class="available">', item(), '</td><td>', item()?['Qty'], '</td><td>', item()?['Location'], '</td><td>', item()?['Condition'], '</td></tr>')
      ),
      ''
    ) & '
  </table>', 'No parts available in this category')}

  <h3>⚠️ Low Stock Items (@{length(variables('lowStockParts'))})</h3>
  @{if(greater(length(variables('lowStockParts')), 0), '
  <ul class="low-stock">
    ' & join(
      select(
        variables('lowStockParts'),
        concat('<li>', item(), ' - Qty: ', item()?['Qty'], '</li>')
      ),
      ''
    ) & '
  </ul>', 'No low stock items')}

  <h3>❌ Not in Stock (@{length(variables('missingParts'))})</h3>
  @{if(greater(length(variables('missingParts')), 0), '
  <ul class="missing">
    ' & join(
      select(
        variables('missingParts'),
        concat('<li>', item(), '</li>')
      ),
      ''
    ) & '
  </ul>', 'All parts found in inventory')}

  <hr>
  <p style="color: #666; font-size: 12px;">
    This is an automated response from the GenThrust Inventory System.<br>
    Index contains 6,571+ parts across 11 warehouse locations.<br>
    For detailed information, please contact the warehouse team.
  </p>
</body>
</html>
```

### 7. Send Email Response

Add **Send an email (V2)** action:

- **To**: `@{triggerOutputs()?['body/from']}`
- **Subject**: `RE: Parts Availability - @{length(variables('foundParts'))} available, @{length(variables('missingParts'))} not in stock`
- **Body**: Output from Compose action (HTML)
- **Importance**: Normal

## Testing

### Test Email Format

Send a test email with subject "Parts Request Test":

```
Hi,

Can you check if we have these parts in stock:

MS20470AD4-6
AN470AD4-6
NAS1351-4-6
BOGUS-PART-123
MS21250-B4

Thanks!
```

Expected response should identify:
- Which parts are in stock (with qty and location)
- Which parts have low stock
- Which parts are not found

## Advanced Features (Optional)

### 1. Attachment Parsing

If customers send Excel/CSV files with parts lists:
1. Add **Parse CSV** or **Get Excel rows** action
2. Extract part number column
3. Loop through rows instead of email body

### 2. Auto-Create Quote

For available parts:
1. Calculate total value
2. Generate quote PDF
3. Attach to response email

### 3. Slack/Teams Notification

Add parallel branch to send notification to warehouse team:
- **Post message in a chat or channel** (Teams)
- Include summary of parts requested
- Tag relevant team members

### 4. Log Requests

Add **Add row** to SharePoint list:
- Timestamp
- Requester email
- Parts requested (count)
- Parts found (count)
- Parts missing (count)

## Troubleshooting

### Parts not matching

**Issue**: Part numbers not being extracted correctly

**Solutions**:
- Adjust regex pattern to match your part numbering scheme
- Use AI Builder for more accurate extraction
- Check email encoding (plain text vs HTML)

### False positives

**Issue**: Non-part-number text being matched

**Solutions**:
- Tighten regex pattern
- Add prefix/suffix requirements (e.g., all parts start with "MS" or "AN")
- Use AI Builder to train on actual part numbers

### Performance issues

**Issue**: Flow times out with large parts lists

**Solutions**:
- Batch SharePoint queries (query multiple parts at once)
- Implement pagination
- Use parallel branches for faster processing

## Maintenance

### Update part number pattern

If your part numbering scheme changes, update the regex in Step 4:
- Current: `[A-Z0-9-]{5,20}`
- Example for prefixed parts: `(MS|AN|NAS)[A-Z0-9-]{3,18}`

### Index rebuild reminder

The flow relies on InventoryIndexTable being up to date:
- Rebuild index monthly or after bulk inventory changes
- Use the dashboard Index Management feature
- Flow will only find parts that are in the index

## Security Considerations

1. **Email Filtering**: Only process emails from trusted domains
2. **Data Privacy**: Don't send pricing information in automated responses
3. **Rate Limiting**: Set concurrency limit to prevent spam
4. **Authentication**: Ensure SharePoint connector uses service account with read-only access

## Flow Diagram

```
┌─────────────────────────┐
│ Email Arrives           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Extract Part Numbers    │
│ (Regex/AI Builder)      │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ For Each Part Number    │◄────┐
└───────────┬─────────────┘     │
            │                    │
            ▼                    │
┌─────────────────────────┐     │
│ Query Inventory Index   │     │
└───────────┬─────────────┘     │
            │                    │
            ▼                    │
┌─────────────────────────┐     │
│ Part Found?             │     │
└───┬───────────┬─────────┘     │
    │ Yes       │ No            │
    ▼           ▼               │
┌───────┐   ┌─────────┐        │
│Add to │   │Add to   │        │
│Found  │   │Missing  │        │
└───┬───┘   └────┬────┘        │
    │            │              │
    ▼            │              │
┌───────┐        │              │
│Qty<2? │        │              │
└┬──┬───┘        │              │
 │  │            │              │
 │  └────────────┴──────────────┘
 │               │
 ▼               │
Add to          │
Low Stock       │
 │               │
 └───────────────┘
            │
            ▼
┌─────────────────────────┐
│ Compose HTML Response   │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Send Email Reply        │
└─────────────────────────┘
```

## Future Enhancements

1. **Machine Learning**: Train AI model on historical requests to predict which parts are commonly requested together
2. **Inventory Reservation**: Automatically reserve parts for confirmed orders
3. **Pricing Integration**: Include pricing in availability response (with authentication)
4. **Multi-language Support**: Detect email language and respond accordingly
5. **Image Recognition**: Extract part numbers from attached photos/screenshots

## Support

For questions or issues with this flow:
1. Check Power Automate run history for error details
2. Verify SharePoint permissions
3. Test regex pattern at https://regex101.com
4. Review InventoryIndexTable for data quality issues

---

**Last Updated**: 2025-01-14
**Flow Version**: 1.0
**Maintained By**: GenThrust Repairs Team
