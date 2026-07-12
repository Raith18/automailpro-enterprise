/**
 * Scheduler.gs
 * -----------------------------------------------------------------------
 * The function the once-a-minute trigger actually calls. Reads due rows
 * from MailScheduler, enforces working hours and holidays, processes a
 * config-bounded batch through MailService, and writes results back.
 *
 * Takes a script lock for the whole run — this is what "prevent duplicate
 * sending" means in practice: if a run is still going when the next
 * minute's trigger fires, the second run backs off instead of racing the
 * first one over the same rows.
 * -----------------------------------------------------------------------
 */

const Scheduler = (() => {

  const SHEET_NAME = 'MailScheduler';
  const ACTIVE_STATUSES = ['Pending', 'Scheduled'];

  /**
   * Entry point called by the installed trigger (and safe to run manually
   * from the editor or a "Send Pending" menu item).
   * @return {Object} run summary: { processed, sent, failed, retried, skipped }
   */
  function processPendingEmails() {
    const lock = LockService.getScriptLock();
    const gotLock = lock.tryLock(5000);
    if (!gotLock) {
      return { processed: 0, sent: 0, failed: 0, retried: 0, skipped: 0, note: 'Another run is already in progress.' };
    }

    try {
      return _runBatch();
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Does the actual work once the lock is held.
   * @return {Object} run summary
   */
  function _runBatch() {
    const summary = { processed: 0, sent: 0, failed: 0, retried: 0, skipped: 0 };
    const now = new Date();

    if (_isHoliday(now)) {
      summary.skipped = -1; // sentinel meaning "whole run skipped"
      return summary;
    }

    const workStart = ConfigService.get('Working Hours Start', '09:00');
    const workEnd = ConfigService.get('Working Hours End', '18:00');
    const batchSize = Number(ConfigService.get('Batch Size', 20));
    const retryLimit = Number(ConfigService.get('Retry Limit', 3));

    const sheet = Utils.getSheet(SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = Utils.sheetToObjects(sheet);

    const due = rows.filter(row => _isDue(row, now));

    const enablePreview = String(ConfigService.get('Enable Preview')).toLowerCase() === 'true';

    for (const row of due) {
      if (summary.processed >= batchSize) break;

      if (!Utils.isWithinWorkingHours(now, workStart, workEnd)) {
        summary.skipped++;
        continue; // leave Pending — picked up automatically next in-hours run
      }

      // Mark Processing immediately so a concurrent/overlapping read
      // (even under the lock, e.g. a manual "Send Pending" click) won't
      // pick the same row twice.
      _writeBackRow(sheet, headers, row.__row, { 'Status': 'Processing' });

      const isPreview = enablePreview && row['Status'] === 'Pending';
      let sendRow = row;
      if (isPreview) {
        sendRow = Object.assign({}, row, {
          'Recipient Email': ConfigService.get('Admin Email'),
          'Subject': '[PREVIEW] ' + (row['Subject'] || row['Template Name']),
          '__triggerType': 'Preview'
        });
      } else {
        sendRow = Object.assign({}, row, { __triggerType: 'Scheduled' });
      }

      const result = MailService.sendScheduledEmail(sendRow);
      summary.processed++;

      if (result.success) {
        if (isPreview) {
          _writeBackRow(sheet, headers, row.__row, {
            'Status': 'Needs Approval',
            'Last Attempt': Utils.formatDateTime(new Date()),
            'Remarks': 'Preview sent to admin. Change Status to Scheduled to approve.'
          });
          summary.sent++;
        } else {
          _writeBackRow(sheet, headers, row.__row, {
            'Status': 'Sent',
            'Sent Timestamp': Utils.formatDateTime(new Date()),
            'Last Attempt': Utils.formatDateTime(new Date()),
            'Remarks': ''
          });
          summary.sent++;
        }
      } else {
        const currentRetries = Number(row['Retry Count']) || 0;
        const nextRetries = currentRetries + 1;

        if (nextRetries < retryLimit) {
          _writeBackRow(sheet, headers, row.__row, {
            'Status': 'Pending',
            'Retry Count': nextRetries,
            'Last Attempt': Utils.formatDateTime(new Date()),
            'Remarks': result.error
          });
          summary.retried++;
        } else {
          _writeBackRow(sheet, headers, row.__row, {
            'Status': 'Failed',
            'Retry Count': nextRetries,
            'Last Attempt': Utils.formatDateTime(new Date()),
            'Remarks': result.error
          });
          if (typeof NotificationService !== 'undefined') {
            NotificationService.notifyAdmin(
              `Email Failed (Retry Limit Reached): ${row['Recipient Email']}`,
              `The scheduled email to ${row['Recipient Email']} using template "${row['Template Name']}" has failed after ${retryLimit} retries.\n\nFinal Error: ${result.error}`
            );
          }
          summary.failed++;
        }
      }
    }

    return summary;
  }

  /**
   * Whether a row is due to be attempted right now: active status, and
   * combined Schedule Date+Time is in the past.
   * @param {Object} row
   * @param {Date} now
   * @return {boolean}
   */
  function _isDue(row, now) {
    if (!ACTIVE_STATUSES.includes(row['Status'])) return false;
    if (!row['Schedule Date']) return false;

    const scheduledAt = Utils.combineDateAndTime(row['Schedule Date'], row['Schedule Time'] || '00:00');
    if (scheduledAt > now) return false;

    if (Number(row['Retry Count']) > 0 && row['Last Attempt']) {
      const lastAttempt = new Date(row['Last Attempt']);
      const backoffMinutes = Utils.getBackoffDelay(Number(row['Retry Count']));
      const nextAttempt = new Date(lastAttempt.getTime() + backoffMinutes * 60000);
      if (now < nextAttempt) return false;
    }

    return true;
  }

  /**
   * Checks today's date against the configured Holiday sheet. Missing
   * sheet or unparseable rows fail open (treated as "not a holiday")
   * rather than blocking all sends over a config typo.
   * @param {Date} date
   * @return {boolean}
   */
  function _isHoliday(date) {
    const holidaySheetName = ConfigService.get('Holiday Sheet Name', 'Holidays');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(holidaySheetName);
    if (!sheet) return false;

    try {
      const values = sheet.getDataRange().getValues();
      const todayStr = Utils.formatDate(date);
      // Expects a single "Date" column; skip header row.
      for (let i = 1; i < values.length; i++) {
        const cell = values[i][0];
        if (!cell) continue;
        const cellDate = (cell instanceof Date) ? cell : new Date(cell);
        if (Utils.formatDate(cellDate) === todayStr) return true;
      }
    } catch (e) {
      Logger.log(`Scheduler: holiday check failed, failing open — ${e.message}`);
    }
    return false;
  }

  /**
   * Writes a set of {ColumnName: value} updates to one sheet row.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Array<string>} headers
   * @param {number} rowNum 1-indexed sheet row
   * @param {Object} updates
   */
  function _writeBackRow(sheet, headers, rowNum, updates) {
    Object.keys(updates).forEach(colName => {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) return; // unknown column — ignore rather than throw
      sheet.getRange(rowNum, colIndex + 1).setValue(updates[colName]);
    });
  }

  /**
   * Validates and appends a new row to MailScheduler from form input.
   * Called from scheduler.html via google.script.run.
   * @param {Object} data { recipientEmail, recipientName, subject, templateName,
   *                         scheduleDate (yyyy-MM-dd string), scheduleTime (HH:mm string),
   *                         attachmentFileId, priority }
   * @return {{success: boolean, errors: Array<string>, id: string|null}}
   */
  function addScheduledEmail(data) {
    const validation = ValidationService.validateNewSchedule(data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors, id: null };
    }

    const sheet = Utils.getSheet(SHEET_NAME);
    const id = Utils.generateId();

    sheet.appendRow([
      id,
      data.recipientEmail,
      data.recipientName || '',
      data.subject || '',
      data.templateName,
      data.scheduleDate,
      data.scheduleTime || '00:00',
      data.attachmentFileId || '',
      data.priority || 'Normal',
      'Pending',
      0,   // Retry Count
      '',  // Last Attempt
      '',  // Sent Timestamp
      ''   // Remarks
    ]);

    return { success: true, errors: [], id };
  }

  return { processPendingEmails, addScheduledEmail };

})();

/**
 * The literal function name the installable trigger calls.
 * Also runnable manually from the editor dropdown.
 */
function runScheduler() {
  const summary = Scheduler.processPendingEmails();
  Logger.log(JSON.stringify(summary));
}

/**
 * Global wrapper for scheduler.html's form submit — google.script.run
 * can only call top-level functions, not IIFE-module members directly.
 * @param {Object} formData
 * @return {Object}
 */
function submitNewSchedule(formData) {
  if (!AuthService.can('schedule')) throw new Error('Permission denied: requires schedule.');
  return Scheduler.addScheduledEmail(formData);
}

/**
 * Global wrapper returning the active template names for the form's
 * Template dropdown.
 * @return {Array<string>}
 */
function getActiveTemplateNames() {
  return TemplateService.listActiveTemplateNames();
}
