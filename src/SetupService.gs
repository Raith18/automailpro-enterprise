/**
 * SetupService.gs
 * -----------------------------------------------------------------------
 * One-time (but safe to re-run) initializer that creates every sheet the
 * app depends on, with correct headers, frozen header row, and a couple
 * of sane starter rows so the UI isn't empty on first open.
 *
 * Call SetupService.initializeWorkbook() once from the Apps Script editor
 * after binding the script to a fresh Sheet, or wire it to an "Initialize"
 * menu item (added in Menu.gs later).
 * -----------------------------------------------------------------------
 */

const SetupService = (() => {

  const SHEETS = {
    MailScheduler: [
      'ID', 'Recipient Email', 'Recipient Name', 'Subject', 'Template Name',
      'Schedule Date', 'Schedule Time', 'Attachment File ID', 'Priority',
      'Status', 'Retry Count', 'Last Attempt', 'Sent Timestamp', 'Remarks'
    ],
    Templates: [
      'Template Name', 'Subject', 'HTML Template', 'Description', 'Active'
    ],
    Logs: [
      'Timestamp', 'Recipient', 'Subject', 'Template', 'Status', 'Error',
      'Retry Count', 'Processing Time', 'Trigger Type', 'User'
    ],
    Configuration: [
      'Key', 'Value'
    ]
  };

  const DEFAULT_CONFIG_ROWS = [
    ['Admin Email', ''],
    ['Batch Size', 20],
    ['Retry Limit', 3],
    ['Sender Name', 'Smart Mail Scheduler'],
    ['Company Name', 'Your Company'],
    ['Working Hours Start', '09:00'],
    ['Working Hours End', '18:00'],
    ['Time Zone', 'Asia/Kolkata'],
    ['Holiday Sheet Name', 'Holidays'],
    ['Default Signature', ''],
    ['Enable Preview', false],
    ['Enable Notifications', true]
  ];

  /**
   * Creates a sheet with the given headers if it doesn't already exist.
   * If it exists, leaves data alone but ensures the header row matches
   * (only appends missing trailing headers — never reorders/deletes
   * existing columns, to avoid destroying live data).
   * @param {string} name
   * @param {Array<string>} headers
   * @return {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _ensureSheet(name, headers) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);

    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff');
      sheet.setColumnWidths(1, headers.length, 140);
      return sheet;
    }

    // Sheet exists — only patch missing headers, never destructive.
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    const missing = headers.filter(h => !existingHeaders.includes(h));
    if (missing.length > 0) {
      const startCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
      sheet.getRange(1, startCol, 1, missing.length)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff');
    }
    return sheet;
  }

  /**
   * Seeds the Configuration sheet with default key/value rows, but only
   * for keys that don't already have a row (won't overwrite user edits).
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  function _seedConfig(sheet) {
    const data = sheet.getDataRange().getValues();
    const existingKeys = new Set(data.slice(1).map(r => String(r[0]).trim()));
    const toAdd = DEFAULT_CONFIG_ROWS.filter(([key]) => !existingKeys.has(key));
    if (toAdd.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, toAdd.length, 2).setValues(toAdd);
    }
  }

  const SAMPLE_TEMPLATE = {
    'Template Name': 'Welcome',
    'Subject': 'Welcome to {{Company}}, {{Name}}!',
    'HTML Template':
      '<p>Hi {{Name}},</p>' +
      '<p>Welcome to the {{Department}} team at {{Company}}. Your Employee ID is <strong>{{EmployeeID}}</strong>.</p>' +
      '{{#if Manager}}<p>Your manager is {{Manager}}.</p>{{/if}}' +
      '<p>We\'re glad to have you on board.</p>',
    'Description': 'Sample onboarding email — safe to edit or delete.',
    'Active': true
  };

  /**
   * Adds one sample template row if the Templates sheet is otherwise
   * empty — gives a fresh install something real to test/preview with,
   * without ever overwriting real template rows.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  function _seedSampleTemplate(sheet) {
    const rows = Utils.sheetToObjects(sheet);
    if (rows.length === 0) {
      sheet.appendRow([
        SAMPLE_TEMPLATE['Template Name'],
        SAMPLE_TEMPLATE['Subject'],
        SAMPLE_TEMPLATE['HTML Template'],
        SAMPLE_TEMPLATE['Description'],
        SAMPLE_TEMPLATE['Active']
      ]);
    }
  }

  /**
   * Creates/repairs every required sheet. Idempotent — safe to run
   * multiple times without duplicating tabs or losing data.
   * @return {Object} summary of what was created/verified
   */
  function initializeWorkbook() {
    const summary = { created: [], verified: [] };
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    Object.keys(SHEETS).forEach(name => {
      const existedBefore = !!ss.getSheetByName(name);
      const sheet = _ensureSheet(name, SHEETS[name]);
      if (existedBefore) {
        summary.verified.push(name);
      } else {
        summary.created.push(name);
      }
      if (name === 'Configuration') {
        _seedConfig(sheet);
      }
      if (name === 'Templates') {
        _seedSampleTemplate(sheet);
      }
    });

    ConfigService.invalidate();
    return summary;
  }

  return { initializeWorkbook, SHEETS };

})();

/**
 * Convenience entry point to run from the Apps Script editor dropdown.
 */
function runInitialSetup() {
  const result = SetupService.initializeWorkbook();
  Logger.log(`Created: ${result.created.join(', ') || '(none — already existed)'}`);
  Logger.log(`Verified: ${result.verified.join(', ')}`);
}
