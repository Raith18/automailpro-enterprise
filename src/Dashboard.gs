/**
 * Dashboard.gs
 * -----------------------------------------------------------------------
 * Aggregates live stats from MailScheduler and Logs into one payload for
 * the sidebar. Pure data functions — zero HTML/rendering logic here,
 * that all lives in dashboard.html. Called from the client via
 * google.script.run.withSuccessHandler(...).getDashboardData().
 * -----------------------------------------------------------------------
 */

const Dashboard = (() => {

  const ACTIVE_STATUSES = ['Pending', 'Scheduled'];

  /**
   * Full dashboard payload — one round trip for the whole page.
   * @return {Object}
   */
  function getData() {
    const schedulerSheet = Utils.getSheet('MailScheduler');
    const rows = Utils.sheetToObjects(schedulerSheet);
    const today = Utils.formatDate(new Date());

    const logRows = _getLogRows();

    return {
      counts: _getCounts(rows, logRows, today),
      quota: _getQuota(),
      upcoming: _getUpcoming(rows, 8),
      recentActivity: AppLogger.getRecent(10),
      charts: {
        monthly: _getMonthlyChart(logRows),
        successVsFailure: _getSuccessVsFailure(logRows),
        priorityDistribution: _getPriorityDistribution(rows),
        dailyTrend: _getDailyTrend(logRows, 7)
      }
    };
  }

  /**
   * Safely reads Logs as objects; returns [] rather than throwing if the
   * sheet is temporarily missing (e.g. right after a fresh install before
   * SetupService has run).
   * @return {Array<Object>}
   */
  function _getLogRows() {
    try {
      return Utils.sheetToObjects(Utils.getSheet('Logs'));
    } catch (e) {
      return [];
    }
  }

  /**
   * @param {Array<Object>} rows MailScheduler rows
   * @param {Array<Object>} logRows Logs rows
   * @param {string} todayStr yyyy-MM-dd
   * @return {Object}
   */
  function _getCounts(rows, logRows, todayStr) {
    const pending = rows.filter(r => ACTIVE_STATUSES.includes(r['Status'])).length;
    const failed = rows.filter(r => r['Status'] === 'Failed').length;
    const retryQueue = rows.filter(r => r['Status'] === 'Pending' && Number(r['Retry Count']) > 0).length;
    const todays = rows.filter(r => {
      if (!r['Schedule Date']) return false;
      const d = (r['Schedule Date'] instanceof Date) ? r['Schedule Date'] : new Date(r['Schedule Date']);
      return Utils.formatDate(d) === todayStr;
    }).length;

    const sentTotal = logRows.filter(l => l['Status'] === 'Sent').length;
    const failedTotal = logRows.filter(l => l['Status'] === 'Failed').length;
    const attempted = sentTotal + failedTotal;
    const successRate = attempted > 0 ? Math.round((sentTotal / attempted) * 1000) / 10 : null;

    return { pending, failed, retryQueue, today: todays, successRate };
  }

  /**
   * Gmail's remaining send quota for the current executing user/day.
   * @return {Object}
   */
  function _getQuota() {
    try {
      return { remaining: MailApp.getRemainingDailyQuota() };
    } catch (e) {
      return { remaining: null };
    }
  }

  /**
   * Next N upcoming active rows, soonest first.
   * @param {Array<Object>} rows
   * @param {number} limit
   * @return {Array<Object>}
   */
  function _getUpcoming(rows, limit) {
    return rows
      .filter(r => ACTIVE_STATUSES.includes(r['Status']) && r['Schedule Date'])
      .map(r => ({
        recipient: r['Recipient Email'],
        subject: r['Subject'] || r['Template Name'],
        scheduledAt: Utils.combineDateAndTime(r['Schedule Date'], r['Schedule Time'] || '00:00'),
        priority: r['Priority'] || 'Normal'
      }))
      .sort((a, b) => a.scheduledAt - b.scheduledAt)
      .slice(0, limit)
      .map(r => Object.assign({}, r, { scheduledAt: Utils.formatDateTime(r.scheduledAt) }));
  }

  /**
   * Sent-email counts per month for the last 6 months.
   * @param {Array<Object>} logRows
   * @return {Array<{label: string, count: number}>}
   */
  function _getMonthlyChart(logRows) {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM'),
        label: Utilities.formatDate(d, Session.getScriptTimeZone(), 'MMM') });
    }
    const counts = {};
    months.forEach(m => counts[m.key] = 0);

    logRows.forEach(l => {
      if (l['Status'] !== 'Sent' || !l['Timestamp']) return;
      const ts = (l['Timestamp'] instanceof Date) ? l['Timestamp'] : new Date(l['Timestamp']);
      const key = Utils.formatDate(ts).slice(0, 7);
      if (key in counts) counts[key]++;
    });

    return months.map(m => ({ label: m.label, count: counts[m.key] }));
  }

  /**
   * @param {Array<Object>} logRows
   * @return {{sent: number, failed: number}}
   */
  function _getSuccessVsFailure(logRows) {
    return {
      sent: logRows.filter(l => l['Status'] === 'Sent').length,
      failed: logRows.filter(l => l['Status'] === 'Failed').length
    };
  }

  /**
   * @param {Array<Object>} rows MailScheduler rows
   * @return {Object} { Priority: count }
   */
  function _getPriorityDistribution(rows) {
    const dist = {};
    rows.forEach(r => {
      const p = r['Priority'] || 'Normal';
      dist[p] = (dist[p] || 0) + 1;
    });
    return dist;
  }

  /**
   * Sent-email counts per day for the last N days.
   * @param {Array<Object>} logRows
   * @param {number} days
   * @return {Array<{label: string, count: number}>}
   */
  function _getDailyTrend(logRows, days) {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = Utils.formatDate(d);
      const count = logRows.filter(l => {
        if (l['Status'] !== 'Sent' || !l['Timestamp']) return false;
        const ts = (l['Timestamp'] instanceof Date) ? l['Timestamp'] : new Date(l['Timestamp']);
        return Utils.formatDate(ts) === key;
      }).length;
      result.push({ label: Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE'), count });
    }
    return result;
  }

  return { getData };

})();

/**
 * Global wrapper — google.script.run can only call top-level functions,
 * not IIFE-module members directly.
 * @return {Object}
 */
function getDashboardData() {
  return Dashboard.getData();
}
