/**
 * ReportService.gs
 * -----------------------------------------------------------------------
 * Aggregates the Logs sheet into period reports (Daily/Weekly/Monthly)
 * and can email a formatted summary to the configured Admin Email.
 * -----------------------------------------------------------------------
 */

const ReportService = (() => {

  const PERIOD_DAYS = { Daily: 1, Weekly: 7, Monthly: 30 };

  /**
   * Builds a report object for the given period, counting back from now.
   * @param {string} period one of 'Daily' | 'Weekly' | 'Monthly'
   * @return {Object}
   */
  function generate(period) {
    const days = PERIOD_DAYS[period] || 1;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logs = Utils.sheetToObjects(Utils.getSheet('Logs')).filter(l => {
      if (!l['Timestamp']) return false;
      try { return new Date(l['Timestamp']) >= cutoff; } catch (e) { return false; }
    });

    const sent = logs.filter(l => l['Status'] === 'Sent');
    const failed = logs.filter(l => l['Status'] === 'Failed');
    const total = sent.length + failed.length;

    const byTemplate = {};
    sent.forEach(l => {
      const t = l['Template'] || 'Unspecified';
      byTemplate[t] = (byTemplate[t] || 0) + 1;
    });
    const topTemplates = Object.keys(byTemplate)
      .map(name => ({ name, count: byTemplate[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topErrors = {};
    failed.forEach(l => {
      const e = (l['Error'] || 'Unknown error').slice(0, 80);
      topErrors[e] = (topErrors[e] || 0) + 1;
    });
    const commonErrors = Object.keys(topErrors)
      .map(message => ({ message, count: topErrors[message] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      period,
      generatedAt: Utils.formatDateTime(new Date()),
      sent: sent.length,
      failed: failed.length,
      successRate: total > 0 ? Math.round((sent.length / total) * 1000) / 10 : null,
      topTemplates,
      commonErrors
    };
  }

  /**
   * Generates a report and emails it to the configured Admin Email.
   * No-op with a clear return value if Admin Email isn't configured.
   * @param {string} period
   * @return {{sent: boolean, reason: string|null}}
   */
  function emailToAdmin(period) {
    const adminEmail = ConfigService.get('Admin Email', '');
    if (!adminEmail || !Utils.isValidEmail(adminEmail)) {
      return { sent: false, reason: 'No valid Admin Email configured in Settings.' };
    }

    const report = generate(period);
    const companyName = ConfigService.get('Company Name', 'Your Company');
    const subject = `${period} Email Report — ${companyName} — ${Utils.formatDate(new Date())}`;

    const templateRows = report.topTemplates.map(t =>
      `<tr><td style="padding:4px 8px;">${Utils.escapeHtml(t.name)}</td><td style="padding:4px 8px;">${t.count}</td></tr>`
    ).join('') || '<tr><td colspan="2" style="padding:4px 8px;color:#5f6368;">No sends in this period.</td></tr>';

    const html = `
      <div style="font-family:Roboto, Arial, sans-serif; max-width:520px;">
        <h2 style="color:#2874f0;">${period} Report — ${Utils.escapeHtml(companyName)}</h2>
        <p style="color:#5f6368; font-size:12px;">Generated ${report.generatedAt}</p>
        <p><strong>Sent:</strong> ${report.sent} &nbsp; <strong>Failed:</strong> ${report.failed} &nbsp;
           <strong>Success rate:</strong> ${report.successRate !== null ? report.successRate + '%' : 'N/A'}</p>
        <h3 style="font-size:14px;">Top templates</h3>
        <table style="border-collapse:collapse; width:100%;">${templateRows}</table>
      </div>`;

    GmailApp.sendEmail(adminEmail, subject, `${period} report: ${report.sent} sent, ${report.failed} failed.`, { htmlBody: html });
    return { sent: true, reason: null };
  }

  return { generate, emailToAdmin };

})();

/** Global wrapper for reports.html. */
function generateReport(period) {
  if (!AuthService.can('viewReports')) throw new Error('Permission denied: requires viewReports.');
  return ReportService.generate(period);
}

/** Global wrapper for reports.html's "Email to Admin" button. */
function emailReportToAdmin(period) {
  if (!AuthService.can('viewReports')) throw new Error('Permission denied: requires viewReports.');
  return ReportService.emailToAdmin(period);
}
