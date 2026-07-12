/**
 * Analytics.gs
 * -----------------------------------------------------------------------
 * Cross-cutting analytics that don't belong to one specific sheet's
 * service — currently template usage ranking. Kept separate from
 * Dashboard.gs so Dashboard stays focused on "current state" while this
 * stays focused on "usage patterns over time".
 * -----------------------------------------------------------------------
 */

const Analytics = (() => {

  /**
   * Ranks templates by how many times each has been successfully sent,
   * all-time, based on Logs.
   * @return {Array<{name: string, count: number}>}
   */
  function getTemplateUsage() {
    const logs = Utils.sheetToObjects(Utils.getSheet('Logs'));
    const counts = {};
    logs.forEach(l => {
      if (l['Status'] !== 'Sent') return;
      const t = l['Template'] || 'Unspecified';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts)
      .map(name => ({ name, count: counts[name] }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Average processing time (ms) over the most recent N log entries with
   * a recorded processing time — a simple performance health signal.
   * @param {number} sampleSize
   * @return {number|null}
   */
  function getAverageProcessingTimeMs(sampleSize = 50) {
    const logs = AppLogger.getRecent(sampleSize);
    const withTiming = logs
      .map(l => parseInt(String(l['Processing Time'] || '').replace('ms', ''), 10))
      .filter(n => !isNaN(n));
    if (withTiming.length === 0) return null;
    return Math.round(withTiming.reduce((a, b) => a + b, 0) / withTiming.length);
  }

  return { getTemplateUsage, getAverageProcessingTimeMs };

})();

/** Global wrapper for reports.html / dashboard consumption. */
function getTemplateUsageAnalytics() {
  if (!AuthService.can('viewReports')) throw new Error('Permission denied: requires viewReports.');
  return Analytics.getTemplateUsage();
}
