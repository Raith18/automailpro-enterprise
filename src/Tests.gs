/**
 * Tests.gs
 * -----------------------------------------------------------------------
 * Manual smoke tests. Select a function name in the Apps Script editor
 * toolbar and click Run, then check View > Logs (Ctrl+Enter).
 * These are NOT deployed to production — exclude this file when
 * packaging the final add-on, or gate it behind an admin-only menu item.
 * -----------------------------------------------------------------------
 */

function test_Utils() {
  const results = [];

  results.push(['generateId format', /^SMS-[0-9A-Z]+-\d{4}$/.test(Utils.generateId())]);
  results.push(['isValidEmail true', Utils.isValidEmail('a@b.com') === true]);
  results.push(['isValidEmail false', Utils.isValidEmail('not-an-email') === false]);

  const combined = Utils.combineDateAndTime(new Date(2026, 6, 8), '14:30');
  results.push(['combineDateAndTime hour', combined.getHours() === 14]);
  results.push(['combineDateAndTime minute', combined.getMinutes() === 30]);

  const now = new Date(2026, 6, 8, 12, 0, 0);
  results.push(['isWithinWorkingHours true', Utils.isWithinWorkingHours(now, '09:00', '18:00') === true]);
  results.push(['isWithinWorkingHours false', Utils.isWithinWorkingHours(now, '13:00', '18:00') === false]);

  results.push(['escapeHtml', Utils.escapeHtml('<b>Hi & "bye"</b>') ===
    '&lt;b&gt;Hi &amp; &quot;bye&quot;&lt;/b&gt;']);

  results.push(['getBackoffDelay attempt1', Utils.getBackoffDelay(1) === 60000]);
  results.push(['getBackoffDelay attempt3', Utils.getBackoffDelay(3) === 240000]);

  _logResults('Utils', results);
}

function test_ConfigService() {
  const results = [];

  // Defaults should resolve even with no sheet present.
  const batchSize = ConfigService.get('Batch Size');
  results.push(['default Batch Size resolves', typeof batchSize === 'number']);

  const unknown = ConfigService.get('Nonexistent Key', 'fallback-value');
  results.push(['unknown key returns fallback', unknown === 'fallback-value']);

  const all = ConfigService.getAll();
  results.push(['getAll returns object', typeof all === 'object' && all !== null]);

  _logResults('ConfigService', results);
}

function test_SetupService() {
  const results = [];

  SetupService.initializeWorkbook();
  results.push(['MailScheduler sheet exists', !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MailScheduler')]);
  results.push(['Templates sheet exists', !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Templates')]);
  results.push(['Logs sheet exists', !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Logs')]);
  results.push(['Configuration sheet exists', !!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuration')]);

  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Configuration');
  const rows = Utils.sheetToObjects(configSheet);
  results.push(['Configuration seeded with defaults', rows.length >= 10]);

  // Re-run to confirm idempotency: second run should verify, not re-create.
  const secondRun = SetupService.initializeWorkbook();
  results.push(['second run creates nothing new', secondRun.created.length === 0]);

  _logResults('SetupService', results);
}

function test_AppLogger() {
  const results = [];

  const before = Utils.getSheet('Logs').getLastRow();
  AppLogger.logSent({
    recipient: 'test@example.com',
    subject: 'Test Subject',
    template: 'Welcome',
    processingTimeMs: 123,
    triggerType: 'Manual'
  });
  const afterSent = Utils.getSheet('Logs').getLastRow();
  results.push(['logSent appends one row', afterSent === before + 1]);

  AppLogger.logFailed({
    recipient: 'bad@example.com',
    subject: 'Test Subject',
    template: 'Welcome',
    error: 'Simulated failure',
    retryCount: 1,
    triggerType: 'Manual'
  });
  const afterFailed = Utils.getSheet('Logs').getLastRow();
  results.push(['logFailed appends one row', afterFailed === afterSent + 1]);

  const recent = AppLogger.getRecent(2);
  results.push(['getRecent returns 2 rows', recent.length === 2]);
  results.push(['getRecent most recent first', recent[0]['Status'] === 'Failed']);

  _logResults('AppLogger', results);
}

function test_TemplateService() {
  const results = [];

  // Ensure sheets + sample template exist before testing against them.
  SetupService.initializeWorkbook();

  const withManager = TemplateService.render('Welcome', {
    Name: 'Fatima',
    Company: 'Acme Corp',
    Department: 'Operations',
    EmployeeID: 'E1042',
    Manager: 'Sam Lee'
  });
  results.push(['subject placeholder resolved', withManager.subject === 'Welcome to Acme Corp, Fatima!']);
  results.push(['body placeholder resolved', withManager.html.includes('Hi Fatima,')]);
  results.push(['conditional shown when field present', withManager.html.includes('Your manager is Sam Lee')]);
  results.push(['plainText has no HTML tags', !/<[^>]+>/.test(withManager.plainText)]);

  const withoutManager = TemplateService.render('Welcome', {
    Name: 'Omar',
    Company: 'Acme Corp',
    Department: 'Sales',
    EmployeeID: 'E1099'
    // Manager intentionally omitted
  });
  results.push(['conditional hidden when field absent', !withoutManager.html.includes('Your manager is')]);

  const escapeTest = TemplateService.render('Welcome', {
    Name: '<script>alert(1)</script>',
    Company: 'Acme Corp',
    Department: 'IT',
    EmployeeID: 'E1000'
  });
  results.push(['HTML in data gets escaped', !escapeTest.html.includes('<script>')]);

  const validation = TemplateService.validatePlaceholders(
    '{{Name}} joins {{Department}} on {{StartDate}}',
    { Name: 'X', Department: 'Y' }
  );
  results.push(['validatePlaceholders finds missing field', validation.missing.includes('StartDate')]);

  let threwOnMissingTemplate = false;
  try {
    TemplateService.render('DoesNotExist', {});
  } catch (e) {
    threwOnMissingTemplate = true;
  }
  results.push(['throws on missing template', threwOnMissingTemplate]);

  _logResults('TemplateService', results);
}

function test_AttachmentService() {
  const results = [];

  const empty = AttachmentService.resolve('');
  results.push(['empty input returns no blobs, no errors', empty.blobs.length === 0 && empty.errors.length === 0]);

  const bad = AttachmentService.resolve('not-a-real-file-id-12345');
  results.push(['invalid file ID produces an error', bad.errors.length === 1 && bad.blobs.length === 0]);

  results.push(['isAccessible false for bad ID', AttachmentService.isAccessible('not-a-real-file-id-12345') === false]);

  _logResults('AttachmentService', results);
}

function test_MailService_failurePaths() {
  // IMPORTANT: this test never calls a valid recipient + valid template
  // together, specifically so it cannot accidentally send a real email
  // during automated testing. Verify the success path manually with your
  // own email address using test_MailService_liveSend_MANUAL below.
  const results = [];

  SetupService.initializeWorkbook();

  const invalidEmailResult = MailService.sendScheduledEmail({
    'ID': 'TEST1', 'Recipient Email': 'not-an-email', 'Recipient Name': 'X',
    'Subject': '', 'Template Name': 'Welcome', 'Attachment File ID': '', 'Retry Count': 0
  });
  results.push(['rejects invalid email before sending', invalidEmailResult.success === false]);
  results.push(['invalid email error message present', !!invalidEmailResult.error]);

  const missingTemplateResult = MailService.sendScheduledEmail({
    'ID': 'TEST2', 'Recipient Email': 'someone@example.com', 'Recipient Name': 'X',
    'Subject': '', 'Template Name': 'DoesNotExist', 'Attachment File ID': '', 'Retry Count': 0
  });
  results.push(['rejects unknown template before sending', missingTemplateResult.success === false]);

  const badAttachmentResult = MailService.sendScheduledEmail({
    'ID': 'TEST3', 'Recipient Email': 'someone@example.com', 'Recipient Name': 'X',
    'Subject': '', 'Template Name': 'Welcome', 'Attachment File ID': 'not-a-real-file-id', 'Retry Count': 0
  });
  results.push(['rejects unresolvable attachment before sending', badAttachmentResult.success === false]);

  _logResults('MailService (failure paths)', results);
}

/**
 * NOT run automatically. Edit YOUR_EMAIL, select this function by name in
 * the editor dropdown, and run manually if you want to confirm a real
 * send works end-to-end. Sends one real email via your own Gmail account.
 */
function test_MailService_liveSend_MANUAL() {
  const YOUR_EMAIL = 'YOUR_EMAIL@example.com'; // <-- change this
  const result = MailService.sendScheduledEmail({
    'ID': 'LIVE-TEST', 'Recipient Email': YOUR_EMAIL, 'Recipient Name': 'Tester',
    'Subject': '', 'Template Name': 'Welcome', 'Attachment File ID': '', 'Retry Count': 0
  });
  Logger.log(JSON.stringify(result));
}

function test_Scheduler() {
  const results = [];

  SetupService.initializeWorkbook();
  const sheet = Utils.getSheet('MailScheduler');

  // Clear any leftover test rows from previous runs, keep header.
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }

  // Force working hours wide open and batch size generous, so this test
  // isn't flaky depending on what time it's actually run.
  ConfigService.set('Working Hours Start', '00:00');
  ConfigService.set('Working Hours End', '23:59');
  ConfigService.set('Batch Size', 10);
  ConfigService.set('Retry Limit', 3);

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Row 1: due now, invalid email -> should fail and increment retry (not yet at limit).
  sheet.appendRow(['T1', 'not-an-email', 'Test User', '', 'Welcome', yesterday, '09:00', '', 'Normal', 'Pending', 0, '', '', '']);
  // Row 2: due now, invalid email, already at retry limit - 1 -> should move to Failed.
  sheet.appendRow(['T2', 'not-an-email', 'Test User', '', 'Welcome', yesterday, '09:00', '', 'Normal', 'Pending', 2, '', '', '']);
  // Row 3: scheduled in the future -> must NOT be touched.
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  sheet.appendRow(['T3', 'not-an-email', 'Test User', '', 'Welcome', future, '09:00', '', 'Normal', 'Pending', 0, '', '', '']);
  // Row 4: Cancelled -> must NOT be touched.
  sheet.appendRow(['T4', 'not-an-email', 'Test User', '', 'Welcome', yesterday, '09:00', '', 'Normal', 'Cancelled', 0, '', '', '']);

  const summary = Scheduler.processPendingEmails();
  results.push(['processed exactly the 2 due+active rows', summary.processed === 2]);
  results.push(['one retried (below limit)', summary.retried === 1]);
  results.push(['one failed (hit limit)', summary.failed === 1]);

  const after = Utils.sheetToObjects(sheet);
  const row1 = after.find(r => r['ID'] === 'T1');
  const row2 = after.find(r => r['ID'] === 'T2');
  const row3 = after.find(r => r['ID'] === 'T3');
  const row4 = after.find(r => r['ID'] === 'T4');

  results.push(['row1 back to Pending with retry incremented', row1['Status'] === 'Pending' && row1['Retry Count'] === 1]);
  results.push(['row2 moved to Failed', row2['Status'] === 'Failed' && row2['Retry Count'] === 3]);
  results.push(['row3 (future) untouched', row3['Status'] === 'Pending' && row3['Retry Count'] === 0]);
  results.push(['row4 (cancelled) untouched', row4['Status'] === 'Cancelled']);

  const secondRun = Scheduler.processPendingEmails();
  results.push(['row2 (already Failed) not reprocessed', secondRun.processed === 1]); // only row1 still active

  _logResults('Scheduler', results);
}

function test_TriggerService() {
  const results = [];

  TriggerService.uninstallScheduler(); // start clean regardless of prior state
  results.push(['inactive before install', TriggerService.isSchedulerActive() === false]);

  TriggerService.installScheduler();
  results.push(['active after install', TriggerService.isSchedulerActive() === true]);

  // Installing twice must not create duplicate triggers.
  TriggerService.installScheduler();
  const schedulerTriggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runScheduler');
  results.push(['no duplicate triggers after re-install', schedulerTriggers.length === 1]);

  TriggerService.uninstallScheduler();
  results.push(['inactive after uninstall', TriggerService.isSchedulerActive() === false]);

  _logResults('TriggerService', results);
}

function test_ValidationService() {
  const results = [];

  SetupService.initializeWorkbook();

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowStr = Utils.formatDate(tomorrow);

  const valid = ValidationService.validateNewSchedule({
    recipientEmail: 'someone@example.com',
    templateName: 'Welcome',
    scheduleDate: tomorrowStr,
    scheduleTime: '09:00',
    priority: 'Normal'
  });
  results.push(['valid submission passes', valid.valid === true && valid.errors.length === 0]);

  const badEmail = ValidationService.validateNewSchedule({
    recipientEmail: 'not-an-email',
    templateName: 'Welcome',
    scheduleDate: tomorrowStr
  });
  results.push(['invalid email rejected', badEmail.valid === false]);

  const badTemplate = ValidationService.validateNewSchedule({
    recipientEmail: 'someone@example.com',
    templateName: 'NopeDoesNotExist',
    scheduleDate: tomorrowStr
  });
  results.push(['unknown template rejected', badTemplate.valid === false]);

  const pastDate = ValidationService.validateNewSchedule({
    recipientEmail: 'someone@example.com',
    templateName: 'Welcome',
    scheduleDate: '2020-01-01',
    scheduleTime: '09:00'
  });
  results.push(['past date rejected', pastDate.valid === false]);

  const badPriority = ValidationService.validateNewSchedule({
    recipientEmail: 'someone@example.com',
    templateName: 'Welcome',
    scheduleDate: tomorrowStr,
    priority: 'Whenever'
  });
  results.push(['invalid priority rejected', badPriority.valid === false]);

  const multiError = ValidationService.validateNewSchedule({
    recipientEmail: 'bad',
    templateName: 'Nope',
    scheduleDate: ''
  });
  results.push(['collects multiple errors at once', multiError.errors.length >= 3]);

  _logResults('ValidationService', results);
}

function test_Scheduler_addScheduledEmail() {
  const results = [];

  SetupService.initializeWorkbook();
  const sheet = Utils.getSheet('MailScheduler');
  const before = sheet.getLastRow();

  const tomorrow = Utils.formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const rejected = Scheduler.addScheduledEmail({
    recipientEmail: 'not-an-email',
    templateName: 'Welcome',
    scheduleDate: tomorrow
  });
  results.push(['rejects invalid submission without writing a row', rejected.success === false]);
  results.push(['sheet unchanged after rejection', sheet.getLastRow() === before]);

  const accepted = Scheduler.addScheduledEmail({
    recipientEmail: 'newhire@example.com',
    recipientName: 'New Hire',
    templateName: 'Welcome',
    scheduleDate: tomorrow,
    scheduleTime: '09:30',
    priority: 'High'
  });
  results.push(['accepts valid submission', accepted.success === true]);
  results.push(['returns a generated ID', typeof accepted.id === 'string' && accepted.id.startsWith('SMS-')]);
  results.push(['sheet grew by one row', sheet.getLastRow() === before + 1]);

  const newRow = Utils.sheetToObjects(sheet).find(r => r['ID'] === accepted.id);
  results.push(['new row has Status Pending', newRow['Status'] === 'Pending']);
  results.push(['new row has Retry Count 0', newRow['Retry Count'] === 0]);
  results.push(['new row has correct priority', newRow['Priority'] === 'High']);

  _logResults('Scheduler.addScheduledEmail', results);
}

function test_QueueService() {
  const results = [];
  SetupService.initializeWorkbook();

  const summary = QueueService.getSummary();
  results.push(['getSummary returns all expected keys', 'pending' in summary && 'processing' in summary && 'retryQueue' in summary && 'completed' in summary && 'failed' in summary]);

  const sheet = Utils.getSheet('MailScheduler');
  const before = Utils.sheetToObjects(sheet).length;
  const oldTimestamp = Utils.formatDateTime(new Date(Date.now() - 20 * 60000));
  sheet.appendRow(['STUCK1', 'stuck@example.com', 'X', '', 'Welcome', new Date(), '09:00', '', 'Normal', 'Processing', 0, oldTimestamp, '', '']);

  const recovered = QueueService.recoverStuckRows(10);
  results.push(['recovers rows stuck past threshold', recovered >= 1]);

  const after = Utils.sheetToObjects(sheet).find(r => r['ID'] === 'STUCK1');
  results.push(['recovered row is back to Pending', after['Status'] === 'Pending']);

  _logResults('QueueService', results);
}

function test_ReportService() {
  const results = [];
  SetupService.initializeWorkbook();

  const report = ReportService.generate('Daily');
  results.push(['generate returns expected shape', 'sent' in report && 'failed' in report && 'topTemplates' in report && 'commonErrors' in report]);
  results.push(['period label matches request', report.period === 'Daily']);

  const noAdmin = ReportService.emailToAdmin('Daily');
  // Fresh install has no Admin Email configured, so this should fail gracefully, not throw.
  results.push(['emailToAdmin fails gracefully with no Admin Email', noAdmin.sent === false && !!noAdmin.reason]);

  _logResults('ReportService', results);
}

function test_Analytics() {
  const results = [];
  SetupService.initializeWorkbook();

  const usage = Analytics.getTemplateUsage();
  results.push(['getTemplateUsage returns an array', Array.isArray(usage)]);

  const avgTime = Analytics.getAverageProcessingTimeMs(50);
  results.push(['getAverageProcessingTimeMs returns number or null', avgTime === null || typeof avgTime === 'number']);

  _logResults('Analytics', results);
}

function test_AuthService() {
  const results = [];
  SetupService.initializeWorkbook();

  const role = AuthService.getCurrentUserRole();
  results.push(['getCurrentUserRole returns a known role', Object.values(AuthService.ROLES).includes(role)]);

  const access = getCurrentUserAccess();
  results.push(['getCurrentUserAccess returns can{} map', typeof access.can === 'object']);
  results.push(['view permission implied for all roles via can.schedule shape', typeof access.can.schedule === 'boolean']);

  _logResults('AuthService', results);
}

function test_TemplateService_crud() {
  const results = [];
  SetupService.initializeWorkbook();

  const saveResult = TemplateService.saveTemplate({
    name: 'TestTemplateXYZ',
    subject: 'Test {{Name}}',
    htmlTemplate: '<p>Hello {{Name}}</p>',
    description: 'temp test template',
    active: true
  });
  results.push(['saveTemplate creates new template', saveResult.success === true]);

  const all = TemplateService.listAllTemplates();
  results.push(['new template appears in listAllTemplates', all.some(t => t['Template Name'] === 'TestTemplateXYZ')]);

  const updateResult = TemplateService.saveTemplate({
    name: 'TestTemplateXYZ',
    subject: 'Updated subject {{Name}}',
    htmlTemplate: '<p>Updated {{Name}}</p>',
    description: 'updated',
    active: true
  });
  results.push(['saveTemplate updates existing (no duplicate row)', updateResult.success === true]);

  const afterUpdate = TemplateService.listAllTemplates().filter(t => t['Template Name'] === 'TestTemplateXYZ');
  results.push(['exactly one row after update (not duplicated)', afterUpdate.length === 1]);
  results.push(['update actually changed the subject', afterUpdate[0]['Subject'] === 'Updated subject {{Name}}']);

  const invalidSave = TemplateService.saveTemplate({ name: '', subject: '', htmlTemplate: '' });
  results.push(['rejects empty required fields', invalidSave.success === false && invalidSave.errors.length > 0]);

  const deleteResult = TemplateService.deleteTemplate('TestTemplateXYZ');
  results.push(['deleteTemplate removes the row', deleteResult.success === true]);

  const afterDelete = TemplateService.listAllTemplates();
  results.push(['template no longer present after delete', !afterDelete.some(t => t['Template Name'] === 'TestTemplateXYZ')]);

  _logResults('TemplateService (CRUD)', results);
}

function test_AppLogger_search() {
  const results = [];
  SetupService.initializeWorkbook();

  AppLogger.logSent({ recipient: 'search-test@example.com', subject: 'Searchable Subject', template: 'Welcome' });
  AppLogger.logFailed({ recipient: 'search-fail@example.com', subject: 'Other Subject', template: 'Welcome', error: 'Boom' });

  const byRecipient = AppLogger.search({ recipient: 'search-test' });
  results.push(['search by recipient substring', byRecipient.some(r => r['Recipient'] === 'search-test@example.com')]);

  const byStatus = AppLogger.search({ status: 'Failed' });
  results.push(['search by status', byStatus.every(r => r['Status'] === 'Failed')]);

  const combined = AppLogger.search({ recipient: 'search-fail', status: 'Sent' });
  results.push(['combined filters AND together (no match here)', combined.length === 0]);

  _logResults('AppLogger.search', results);
}

function test_AuthService_permissionKeysMatchUI() {
  // index.html hand-declares a NAV_PERMISSION map of {tab: permissionName}.
  // This test guards against that list drifting from what AuthService
  // actually grants — if someone renames a permission in AuthService
  // without updating index.html, this catches it here instead of silently
  // leaving a nav tab permanently disabled/enabled for everyone.
  const results = [];
  const uiDeclaredPermissions = ['schedule', 'editTemplates', 'viewReports', 'retry', 'editSettings'];
  const access = getCurrentUserAccess();

  uiDeclaredPermissions.forEach(p => {
    results.push([`AuthService exposes '${p}' in can{}`, p in access.can]);
  });

  _logResults('AuthService <-> UI permission consistency', results);
}

function _logResults(moduleName, results) {
  Logger.log(`--- ${moduleName} test results ---`);
  let passCount = 0;
  results.forEach(([name, passed]) => {
    Logger.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}`);
    if (passed) passCount++;
  });
  Logger.log(`${passCount}/${results.length} passed`);
}
