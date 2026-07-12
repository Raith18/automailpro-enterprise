/**
 * Logger.gs
 * -----------------------------------------------------------------------
 * Structured write-path into the "Logs" sheet. Named AppLogger (not
 * Logger) to avoid shadowing Apps Script's built-in Logger.log console.
 *
 * Every module that sends, retries, or fails an email should call
 * AppLogger.log(...) exactly once per attempt, rather than writing rows
 * to the Logs sheet directly — this keeps the column order and format
 * consistent app-wide and gives us one place to change the schema later.
 * -----------------------------------------------------------------------
 */

const AppLogger = (() => {

  const SHEET_NAME = 'Logs';

  const STATUS = Object.freeze({
    SENT: 'Sent',
    FAILED: 'Failed',
    RETRY: 'Retry',
    SKIPPED: 'Skipped',
    INFO: 'Info'
  });

  /**
   * Writes one structured log row.
   * @param {Object} entry
   * @param {string} entry.recipient
   * @param {string} entry.subject
   * @param {string} [entry.template]
   * @param {string} entry.status one of AppLogger.STATUS values
   * @param {string} [entry.error] error message, if any
   * @param {number} [entry.retryCount]
   * @param {number} [entry.processingTimeMs]
   * @param {string} [entry.triggerType] e.g. "Scheduled", "Manual", "Retry"
   * @param {string} [entry.user] acting user's email
   */
  function log(entry) {
    try {
      const sheet = Utils.getSheet(SHEET_NAME);
      sheet.appendRow([
        Utils.formatDateTime(new Date()),
        entry.recipient || '',
        entry.subject || '',
        entry.template || '',
        entry.status || STATUS.INFO,
        entry.error || '',
        entry.retryCount != null ? entry.retryCount : '',
        entry.processingTimeMs != null ? `${entry.processingTimeMs}ms` : '',
        entry.triggerType || '',
        entry.user || Session.getActiveUser().getEmail()
      ]);
    } catch (e) {
      // Logging must never throw and break the calling module — fall back
      // to the console so failures are still visible during development.
      Logger.log(`AppLogger failed to write row: ${e.message} | entry: ${JSON.stringify(entry)}`);
    }
  }

  /**
   * Convenience wrapper for a successful send.
   * @param {Object} params { recipient, subject, template, processingTimeMs, triggerType }
   */
  function logSent(params) {
    log(Object.assign({}, params, { status: STATUS.SENT }));
  }

  /**
   * Convenience wrapper for a failed send.
   * @param {Object} params { recipient, subject, template, error, retryCount, triggerType }
   */
  function logFailed(params) {
    log(Object.assign({}, params, { status: STATUS.FAILED }));
  }

  /**
   * Reads the last N log rows as objects (most recent first) — used by
   * Dashboard.gs for "Recent Activity" widgets.
   * @param {number} n
   * @return {Array<Object>}
   */
  function getRecent(n = 20) {
    const sheet = Utils.getSheet(SHEET_NAME);
    const rows = Utils.sheetToObjects(sheet);
    return rows.slice(-n).reverse();
  }

  /**
   * Moves all current log rows to a dated archive sheet (e.g.
   * "Logs_Archive_2026-07") and clears the live Logs sheet, keeping the
   * header row. Call from a menu item or a scheduled monthly trigger.
   * @return {string} name of the archive sheet created
   */
  function archive() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = Utils.getSheet(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null; // nothing but header, nothing to archive

    const archiveName = `Logs_Archive_${Utils.formatDate(new Date())}`;
    let archiveSheet = ss.getSheetByName(archiveName);
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet(archiveName);
      archiveSheet.getRange(1, 1, 1, data[0].length).setValues([data[0]]);
    }
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, data.length - 1, data[0].length)
      .setValues(data.slice(1));

    sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), sheet.getLastColumn()).clearContent();
    return archiveName;
  }

  /**
   * Filtered log search for logs.html — reads at most the most recent
   * `limit` rows matching the given filters (all optional/AND-combined).
   * @param {Object} filters { recipient, subject, template, status, dateFrom, dateTo }
   * @param {number} limit
   * @return {Array<Object>} most recent first
   */
  function search(filters, limit = 200) {
    const sheet = Utils.getSheet(SHEET_NAME);
    let rows = Utils.sheetToObjects(sheet).reverse(); // most recent first

    if (filters) {
      if (filters.recipient) {
        const q = filters.recipient.toLowerCase();
        rows = rows.filter(r => String(r['Recipient']).toLowerCase().includes(q));
      }
      if (filters.subject) {
        const q = filters.subject.toLowerCase();
        rows = rows.filter(r => String(r['Subject']).toLowerCase().includes(q));
      }
      if (filters.template) {
        rows = rows.filter(r => r['Template'] === filters.template);
      }
      if (filters.status) {
        rows = rows.filter(r => r['Status'] === filters.status);
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom);
        rows = rows.filter(r => r['Timestamp'] && new Date(r['Timestamp']) >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        rows = rows.filter(r => r['Timestamp'] && new Date(r['Timestamp']) <= to);
      }
    }

    return rows.slice(0, limit);
  }

  return { log, logSent, logFailed, getRecent, archive, search, STATUS };

})();

/** Global wrapper for logs.html's search/filter form. */
function searchLogs(filters) {
  return AppLogger.search(filters, 200);
}
