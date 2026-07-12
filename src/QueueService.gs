/**
 * QueueService.gs
 * -----------------------------------------------------------------------
 * Read-side view of queue state (Pending/Processing/Retry/Completed/Failed
 * counts) plus one important production-safety function: recovering rows
 * stuck in "Processing" if a script execution ever errors out or times
 * out mid-send, so they don't sit orphaned forever.
 * -----------------------------------------------------------------------
 */

const QueueService = (() => {

  const SHEET_NAME = 'MailScheduler';

  /**
   * Summarizes current row counts by queue state.
   * @return {{pending: number, processing: number, retryQueue: number, completed: number, failed: number}}
   */
  function getSummary() {
    const rows = Utils.sheetToObjects(Utils.getSheet(SHEET_NAME));
    return {
      pending: rows.filter(r => r['Status'] === 'Pending' && !(Number(r['Retry Count']) > 0)).length,
      processing: rows.filter(r => r['Status'] === 'Processing').length,
      retryQueue: rows.filter(r => r['Status'] === 'Pending' && Number(r['Retry Count']) > 0).length,
      completed: rows.filter(r => r['Status'] === 'Sent').length,
      failed: rows.filter(r => r['Status'] === 'Failed').length,
      cancelled: rows.filter(r => r['Status'] === 'Cancelled').length
    };
  }

  /**
   * Resets any row stuck in "Processing" for longer than thresholdMinutes
   * back to "Pending" — recovers from a script crash/timeout mid-send
   * without needing manual sheet editing.
   * @param {number} thresholdMinutes
   * @return {number} count of rows recovered
   */
  function recoverStuckRows(thresholdMinutes = 10) {
    const sheet = Utils.getSheet(SHEET_NAME);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rows = Utils.sheetToObjects(sheet);
    const statusCol = headers.indexOf('Status') + 1;
    const remarksCol = headers.indexOf('Remarks') + 1;
    const cutoff = new Date(Date.now() - thresholdMinutes * 60000);

    let recovered = 0;
    rows.forEach(row => {
      if (row['Status'] !== 'Processing') return;
      const lastAttempt = row['Last Attempt'] ? new Date(row['Last Attempt']) : null;
      // No Last Attempt timestamp at all + Processing status is itself
      // suspicious (should always be set right before send) — recover it.
      if (!lastAttempt || lastAttempt < cutoff) {
        sheet.getRange(row.__row, statusCol).setValue('Pending');
        sheet.getRange(row.__row, remarksCol).setValue('Auto-recovered from stuck Processing state.');
        recovered++;
      }
    });
    return recovered;
  }

  return { getSummary, recoverStuckRows };

})();

/** Global wrapper for queue.html / dashboard consumption. */
function getQueueSummary() {
  return QueueService.getSummary();
}

/** Global wrapper for queue.html's "Recover stuck rows" button. */
function recoverStuckQueueRows() {
  if (!AuthService.can('retry')) throw new Error('Permission denied: requires retry.');
  return QueueService.recoverStuckRows(10);
}
