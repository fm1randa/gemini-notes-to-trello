# Gemini Notes to Trello: Setup Guide

This guide walks you through setting up the Google Apps Script that automatically creates Trello cards from action items in your Google Meet Gemini Notes.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [How Gemini Notes Documents Are Identified](#how-gemini-notes-documents-are-identified)
3. [Obtaining Trello Credentials](#obtaining-trello-credentials)
4. [Installing the Script](#installing-the-script)
5. [Configuring Script Properties](#configuring-script-properties)
6. [Setting Up the Trigger](#setting-up-the-trigger)
7. [Testing the Integration](#testing-the-integration)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- A Google Workspace account with Gemini Notes enabled for Google Meet
- A Trello account with at least one board
- Access to Google Apps Script (script.google.com)

---

## How Gemini Notes Documents Are Identified

Gemini Notes are Google Docs automatically created by Google Meet after meetings end. The script identifies them using several criteria:

### Document Naming Patterns

Gemini Notes documents are created in Brazilian Portuguese and follow this naming convention:

- `[Meeting Title] - Anotações do Gemini`

For example: "Weekly Team Sync - Anotações do Gemini" or "Product Planning Meeting - Anotações do Gemini"

### Document Structure

The script validates documents by checking for the standard Gemini Notes sections in Brazilian Portuguese:

- **Resumo** - AI-generated meeting summary
- **Detalhes** - Detailed meeting discussion points
- **Próximas etapas sugeridas** - Suggested next steps and action items

### Storage Location

Gemini Notes are saved to your Google Drive, typically in the root folder or a "Meet Recordings" folder. The script searches your entire Drive for matching documents.

### Filtering Logic

The script avoids reprocessing by:

1. Tracking processed document IDs in Script Properties
2. Only scanning documents modified within the configured lookback period (default: 2 hours)
3. Validating document structure before processing

---

## Obtaining Trello Credentials

You'll need four pieces of information from Trello:

### Step 1: Get Your API Key

1. Go to https://trello.com/power-ups/admin
2. Click **New** to create a new Power-Up (or use an existing one)
3. Fill in the required fields (name it something like "Gemini Notes Integration")
4. Once created, find your **API Key** on the Power-Up details page
5. Copy and save this key securely

### Step 2: Generate an Auth Token

1. On the same Power-Up page, click the link to generate a **Token**
2. Alternatively, visit this URL (replace `YOUR_API_KEY`):
   ```
   https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&key=YOUR_API_KEY
   ```
3. Click **Allow** to authorize the integration
4. Copy the displayed token and save it securely

### Step 3: Find Your Board ID

Option A - From URL:

1. Open your target Trello board in a browser
2. The URL looks like: `https://trello.com/b/BOARD_ID/board-name`
3. Copy the `BOARD_ID` portion (8 characters, alphanumeric)

Option B - Using API:

1. Visit: `https://api.trello.com/1/members/me/boards?key=YOUR_API_KEY&token=YOUR_TOKEN`
2. Find your board in the JSON response
3. Copy the `id` field

### Step 4: Find Your List ID

1. Visit this URL (replace placeholders):
   ```
   https://api.trello.com/1/boards/YOUR_BOARD_ID/lists?key=YOUR_API_KEY&token=YOUR_TOKEN
   ```
2. Find the list where you want cards created (e.g., "To Do" or "Action Items")
3. Copy the `id` field for that list

### Summary of Required Values

| Property | Example Value | Where to Find |
|----------|---------------|---------------|
| `TRELLO_API_KEY` | `a1b2c3d4e5f6...` | Trello Power-Up admin page |
| `TRELLO_TOKEN` | `xyz789abc123...` | Generated via authorization URL |
| `TRELLO_BOARD_ID` | `5f4e3d2c1b0a` | From board URL or API |
| `TRELLO_LIST_ID` | `9a8b7c6d5e4f` | From lists API endpoint |

---

## Installing the Script

### Step 1: Create a New Apps Script Project

1. Go to https://script.google.com
2. Click **New project**
3. Name your project (e.g., "Gemini Notes to Trello")

### Step 2: Add the Script Code

1. Delete any existing code in the editor
2. Copy the entire contents of `Code.gs` from this package
3. Paste it into the script editor
4. Press **Ctrl+S** (or Cmd+S) to save

### Step 3: Enable Required Services

The script uses these Google services (usually enabled by default):

- **Drive API** - For searching documents
- **Document API** - For reading document contents
- **Mail API** - For error notifications

If you encounter permission errors, go to **Services** (+ icon) and add:

- Google Drive API
- Google Docs API

---

## Configuring Script Properties

Script Properties store your configuration securely without exposing credentials in code.

### Step 1: Open Script Properties

1. In the Apps Script editor, click **Project Settings** (gear icon)
2. Scroll down to **Script Properties**
3. Click **Add script property**

### Step 2: Add Required Properties

Add these four required properties:

| Property | Value |
|----------|-------|
| `TRELLO_API_KEY` | Your Trello API key |
| `TRELLO_TOKEN` | Your Trello auth token |
| `TRELLO_BOARD_ID` | Your target board ID |
| `TRELLO_LIST_ID` | Your target list ID |

### Step 3: Add Optional Properties

| Property | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | (none) | Gemini API key to rewrite action items in imperative mood |
| `NAME_PATTERN` | `Filipe` | Name to match for action items (supports regex) |
| `NOTIFICATION_EMAIL` | Your email | Where to send error alerts |
| `LOOKBACK_HOURS` | `2` | Hours to look back for new documents |

To get a Gemini API key, visit [Google AI Studio](https://aistudio.google.com/apikey) and create a new API key.

### Alternative: Quick Setup via Code

You can also configure using the `quickSetupTrello()` function:

1. Open the script editor
2. Find the `quickSetupTrello()` function near the bottom
3. Replace the placeholder values with your actual credentials
4. Run the function once (Select it and click ▶️ Run)
5. Delete your credentials from the code after running

---

## Setting Up the Trigger

The script needs a time-based trigger to run automatically.

### Option 1: Using the Built-in Function

1. In the script editor, select `createHourlyTrigger` from the function dropdown
2. Click **Run** (▶️)
3. Grant permissions when prompted
4. The trigger is now active

### Option 2: Manual Trigger Setup

1. Click **Triggers** (clock icon) in the left sidebar
2. Click **+ Add Trigger**
3. Configure:
   - **Function to run**: `processGeminiNotes`
   - **Event source**: Time-driven
   - **Type**: Hour timer
   - **Hour interval**: Every hour
4. Click **Save**

### Recommended Trigger Settings

| Setting | Recommended Value | Notes |
|---------|-------------------|-------|
| Frequency | Every 1 hour | Balances responsiveness with quota usage |
| Failure notification | Immediately | Get alerted if the script breaks |

### Granting Permissions

On first run, Google will ask you to authorize:

1. **View and manage files in Google Drive** - To search for Gemini Notes
2. **View and manage Google Docs** - To read document contents
3. **Send email as you** - For error notifications
4. **Connect to external services** - For Trello API calls

Click through the authorization flow. If you see "This app isn't verified":

1. Click **Advanced**
2. Click **Go to [Project Name] (unsafe)**
3. Review and click **Allow**

---

## Testing the Integration

Before relying on the automated trigger, test each component:

### Test 1: Verify Configuration

```javascript
// Run this function in the script editor
showCurrentConfig()
```

Check the logs to ensure all required properties show "✓ Set".

### Test 2: Test Trello Connection

```javascript
// Run this function
testTrelloConnection()
```

You should see:
- ✓ Successfully connected to board: [Your Board Name]
- ✓ Successfully connected to list: [Your List Name]

### Test 3: Test Gemini API Connection

```javascript
// Run this function
testGeminiConnection()
```

This tests the Gemini API integration for rewriting action items in imperative mood. You should see:

- Original action items (e.g., "Filipe will send the report by Friday")
- Rewritten versions in imperative mood (e.g., "Send the report by Friday")

If `GEMINI_API_KEY` is not configured, the test will show instructions on how to get one.

### Test 4: Test Document Detection

```javascript
// Run this function
testDocumentDetection()
```

This searches the last 7 days for Gemini Notes and shows:

- Documents found
- Action items extracted
- Due dates detected

### Test 5: Full Integration Test

1. Attend a Google Meet with Gemini Notes enabled
2. Ensure someone says "[Your Name] will [do something]"
3. Wait for Gemini Notes to generate (usually 5-10 minutes after meeting)
4. Run `processGeminiNotes()` manually
5. Check your Trello board for the new card

---

## Troubleshooting

### No Documents Found

**Symptoms**: Script reports 0 documents found

**Solutions**:

1. **Check naming patterns**: Open a Gemini Notes doc and verify the title matches expected patterns
2. **Extend lookback**: Temporarily set `LOOKBACK_HOURS` to `168` (1 week) for testing
3. **Check permissions**: Ensure the script can access your Drive files
4. **Verify Gemini Notes is enabled**: Check Google Workspace admin settings

### Action Items Not Detected

**Symptoms**: Documents found but 0 action items extracted

**Solutions**:

1. **Check name spelling**: Ensure `NAME_PATTERN` matches exactly how your name appears
2. **Review document format**: Open the Gemini Notes and check how action items are formatted
3. **Test with variations**: Try setting `NAME_PATTERN` to just your first name

### Trello API Errors

**Symptoms**: "Trello API error" in logs

**Solutions**:

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid credentials | Regenerate API key and token |
| 404 Not Found | Wrong board/list ID | Double-check IDs using the API |
| 429 Rate Limited | Too many requests | Script auto-retries; reduce trigger frequency if persistent |

### Permission Errors

**Symptoms**: "You do not have permission" errors

**Solutions**:

1. Re-run authorization by removing the script from Connected Apps:
   - Go to https://myaccount.google.com/permissions
   - Find and remove the script
   - Run the script again to re-authorize

### Duplicate Cards

**Symptoms**: Same action item creates multiple cards

**Solutions**:

1. The script tracks processed documents - this shouldn't happen normally
2. Run `clearProcessedHistory()` if you need to reset (will reprocess all documents)
3. Check if the same action item appears multiple times in the source document

### Email Notifications Not Working

**Symptoms**: Errors occur but no email received

**Solutions**:

1. Verify `NOTIFICATION_EMAIL` is set correctly
2. Check spam folder
3. Ensure MailApp quota isn't exceeded (100 emails/day)

---

## Appendix: Action Item Detection Patterns

The script recognizes these formats (case-insensitive):

| Pattern | Example |
|---------|---------|
| `[Name] will...` | "Filipe will send the report" |
| `[Name] to...` | "Filipe to schedule the meeting" |
| `Action: [Name] -...` | "Action: Filipe - review PR" |
| `@[Name]:...` | "@Filipe: update documentation" |
| `[ ] [Name]:...` | "[ ] Filipe: fix the bug" |
| `- [Name]:...` | "- Filipe: prepare slides" |
| `[Name] -...` | "Filipe - follow up with client" |

The script also scans "Action Items" or "Next Steps" sections for any mention of the configured name.

---

## Appendix: Customization Examples

### Match Multiple Names

To capture action items for multiple people, use regex:

```
NAME_PATTERN: Filipe|Phil|F\. Silva
```

### Different Trigger Frequency

For more frequent checks (every 15 minutes):

```javascript
function createFrequentTrigger() {
  ScriptApp.newTrigger('processGeminiNotes')
    .timeBased()
    .everyMinutes(15)
    .create();
}
```

### Custom Card Labels

Modify the `createTrelloCard()` function to add labels:

```javascript
// Add to params object
params.idLabels = ['LABEL_ID_HERE'];
```

---

## Support

If you encounter issues not covered here:

1. Check the **Execution log** in Apps Script for detailed error messages
2. Run `testDocumentDetection()` and `testTrelloConnection()` to isolate the problem
3. Verify your Trello API credentials haven't expired

The script logs extensively - most issues can be diagnosed from the execution logs.
