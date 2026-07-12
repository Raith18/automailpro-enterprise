/**
 * Menu.gs
 * -----------------------------------------------------------------------
 * Custom "Smart Mail Scheduler" menu. Every handler here is a thin
 * wrapper around a real service call — no business logic belongs in this
 * file. Items needing a rich UI (Dashboard, Settings) show a placeholder
 * for now and get replaced with real sidebar pages in the frontend
 * module, without changing this menu's structure.
 * -----------------------------------------------------------------------
 */

/**
 * Simple trigger — runs automatically when the spreadsheet opens.
 * No installation required (unlike runScheduler).
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Smart Mail Scheduler')
    .addItem('Dashboard', 'menuShowDashboard')
    .addSeparator()
    .addItem('Send Pending', 'menuSendPending')
    .addItem('Retry Failed', 'menuRetryFailed')
    .addItem('Preview Sample Email', 'menuPreviewSample')
    .addSeparator()
    .addItem('Generate Report', 'menuGenerateReport')
    .addSeparator()
    .addSubMenu(ui.createMenu('Scheduler trigger')
      .addItem('Install (turn on)', 'menuInstallTrigger')
      .addItem('Uninstall (turn off)', 'menuUninstallTrigger')
      .addItem('Check status', 'menuTriggerStatus'))
    .addSeparator()
    .addItem('Settings', 'menuShowSettings')
    .addItem('Archive Logs', 'menuArchiveLogs')
    .addItem('Initialize / Repair Sheets', 'menuInitializeWorkbook')
    .addItem('About', 'menuAbout')
    .addToUi();
}

/** Runs the scheduler immediately, on demand, outside the trigger cycle. */
function menuSendPending() {
  if (!AuthService.can('schedule')) throw new Error('Permission denied: requires schedule.');
  const summary = Scheduler.processPendingEmails();
  const message = summary.skipped === -1
    ? 'Skipped — today is a configured holiday.'
    : `Processed: ${summary.processed}\nSent: ${summary.sent}\nRetried: ${summary.retried}\nFailed: ${summary.failed}\nSkipped (outside hours): ${summary.skipped}`;
  SpreadsheetApp.getUi().alert('Send Pending — result', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Resets every Failed row back to Pending with Retry Count cleared, then
 * immediately runs the scheduler once so they're attempted right away.
 */
function menuRetryFailed() {
  if (!AuthService.can('retry')) throw new Error('Permission denied: requires retry.');
  const sheet = Utils.getSheet('MailScheduler');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rows = Utils.sheetToObjects(sheet);
  const statusCol = headers.indexOf('Status') + 1;
  const retryCol = headers.indexOf('Retry Count') + 1;

  let resetCount = 0;
  rows.forEach(row => {
    if (row['Status'] === 'Failed') {
      sheet.getRange(row.__row, statusCol).setValue('Pending');
      sheet.getRange(row.__row, retryCol).setValue(0);
      resetCount++;
    }
  });

  if (resetCount === 0) {
    SpreadsheetApp.getUi().alert('No Failed rows found.');
    return;
  }

  const summary = Scheduler.processPendingEmails();
  SpreadsheetApp.getUi().alert(
    'Retry Failed — result',
    `Reset ${resetCount} row(s) to Pending.\nThen processed: ${summary.processed}, sent: ${summary.sent}, failed again: ${summary.failed}.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Renders the sample "Welcome" template with placeholder data and shows
 * it in a modal dialog — a real preview, not a stub, since TemplateService
 * already supports this fully.
 */
function menuPreviewSample() {
  try {
    const rendered = TemplateService.render('Welcome', {
      Name: 'Sample Person', Company: ConfigService.get('Company Name', 'Your Company'),
      Department: 'Operations', EmployeeID: 'E0001', Manager: 'Sample Manager'
    });
    const html = HtmlService.createHtmlOutput(
      `<div style="font-family:Arial,sans-serif;padding:8px">
         <p style="color:#5f6368;font-size:12px;margin:0 0 12px 0">Subject: ${Utils.escapeHtml(rendered.subject)}</p>
         ${rendered.html}
       </div>`
    ).setWidth(500).setHeight(500);
    SpreadsheetApp.getUi().showModalDialog(html, 'Preview — Welcome template');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Preview failed: ' + e.message);
  }
}

/** Generates and emails a Daily report to the Admin, on demand from the menu. */
function menuGenerateReport() {
  if (!AuthService.can('viewReports')) throw new Error('Permission denied: requires viewReports.');
  const report = ReportService.generate('Daily');
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Daily Report',
    `Sent: ${report.sent}\nFailed: ${report.failed}\nSuccess rate: ${report.successRate !== null ? report.successRate + '%' : 'N/A'}\n\nEmail this report to the configured Admin?`,
    ui.ButtonSet.YES_NO
  );
  if (response === ui.Button.YES) {
    const result = ReportService.emailToAdmin('Daily');
    ui.alert(result.sent ? 'Report emailed to Admin.' : result.reason);
  }
}

/**
 * Opens the real sidebar (index.html). Optionally jumps straight to a
 * given tab instead of the default Dashboard — used by menuShowSettings
 * so "Settings" in the menu opens the real settings.html page instead of
 * duplicating a second, separate settings UI in a modal.
 * @param {string} [page] one of the sidebar nav page IDs, e.g. 'settings'
 */
function menuOpenSidebar(page) {
  try {
    const template = HtmlService.createTemplateFromFile('index');
    template.initialPage = page || 'dashboard';
    const html = template.evaluate().setTitle('Smart Mail Scheduler');
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (err) {
    SpreadsheetApp.getUi().alert('Failed to launch Dashboard: ' + err.message);
  }
}

function menuShowDashboard() {
  menuOpenSidebar('dashboard');
}

/**
 * Include helper for the Apps Script HTML templating pattern — lets
 * index.html pull in style.html, script.html, dashboard.html via
 * <?!= include('filename'); ?>.
 * @param {string} filename
 * @return {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Opens the sidebar directly to the Settings tab — replaces the earlier
 * standalone modal-dialog settings editor now that settings.html exists,
 * so there's exactly one settings UI instead of two diverging ones.
 */
function menuShowSettings() {
  menuOpenSidebar('settings');
}

function menuArchiveLogs() {
  if (!AuthService.can('archiveLogs')) throw new Error('Permission denied: requires archiveLogs.');
  const archiveName = AppLogger.archive();
  SpreadsheetApp.getUi().alert(
    archiveName ? `Archived to sheet "${archiveName}".` : 'No log rows to archive.'
  );
}

function menuInitializeWorkbook() {
  if (AuthService.getCurrentUserRole() !== AuthService.ROLES.ADMIN) throw new Error('Admin permission required.');
  const result = SetupService.initializeWorkbook();
  SpreadsheetApp.getUi().alert(
    'Initialize / Repair',
    `Created: ${result.created.join(', ') || '(none)'}\nVerified: ${result.verified.join(', ')}`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuInstallTrigger() {
  if (AuthService.getCurrentUserRole() !== AuthService.ROLES.ADMIN) throw new Error('Admin permission required.');
  const message = TriggerService.installScheduler();
  SpreadsheetApp.getUi().alert(message);
}

function menuUninstallTrigger() {
  if (AuthService.getCurrentUserRole() !== AuthService.ROLES.ADMIN) throw new Error('Admin permission required.');
  const message = TriggerService.uninstallScheduler();
  SpreadsheetApp.getUi().alert(message);
}

function menuTriggerStatus() {
  const active = TriggerService.isSchedulerActive();
  SpreadsheetApp.getUi().alert(active ? 'Scheduler is ON — running every minute.' : 'Scheduler is OFF.');
}

function menuAbout() {
  SpreadsheetApp.getUi().alert(
    'Smart Mail Scheduler',
    'A Google Workspace Add-on for scheduling, templating, and tracking bulk email from Google Sheets.\nBuilt module-by-module as a portfolio project.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
