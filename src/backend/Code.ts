/**
 * Code.ts
 * Main entry point — Web App (doGet), Add-on (onHomepage), and
 * all public functions callable from the React frontend via google.script.run.
 */

// ─── Web App Entry ────────────────────────────────────────────────────────────

function doGet(_e: any) {
  const html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AutoMailPro — Enterprise Automation')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  return html;
}

// ─── Add-on Entry ─────────────────────────────────────────────────────────────

function onHomepage(_e: any) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('AutoMailPro').setSubtitle('Enterprise Email Automation'))
    .addSection(
      CardService.newCardSection().addWidget(
        CardService.newTextButton()
          .setText('Open Dashboard')
          .setOnClickAction(CardService.newAction().setFunctionName('openSidebar'))
      )
    )
    .build();
}

function openSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('AutoMailPro Enterprise')
    .setWidth(1000)
    .setHeight(650);
  SpreadsheetApp.getUi().showModelessDialog(html, 'AutoMailPro');
}

function onFileScopeGranted(_e: any) {
  return onHomepage(_e);
}

// ─── Frontend API ─────────────────────────────────────────────────────────────

/** Main hydration call: returns all state in one round-trip */
function getAppState() {
  const sheetInfo = (() => {
    try { return SpreadsheetManager.scan(); } catch { return null; }
  })();

  const schedulers = AppStorageManager.getSchedulers();
  const templates = AppStorageManager.getTemplates();
  const logs = AppStorageManager.getLogs(100);
  const settings = AppStorageManager.getSettings();

  const totalSent = schedulers.reduce((a: number, s: any) => a + (s.totalSent ?? 0), 0);
  const totalFailed = schedulers.reduce((a: number, s: any) => a + (s.totalFailed ?? 0), 0);
  const dailyUsed = MailService.getDailyCount();

  return {
    sheetInfo,
    schedulers,
    templates,
    logs,
    stats: {
      activeSchedulers: schedulers.filter((s: any) => s.status === 'active').length,
      totalSent,
      totalFailed,
      totalPending: 0,
      gmailQuotaUsed: dailyUsed,
      gmailQuotaLimit: settings.dailyCap ?? 500,
      lastSyncAt: new Date().toISOString(),
    },
    senderAliases: getSenderAliases(),
    userEmail: Session.getActiveUser().getEmail(),
    version: '20.0',
  };
}

/** Re-scan the spreadsheet without a full state reload */
function rescanSpreadsheet() {
  return SpreadsheetManager.scan();
}

/** Save or create a scheduler, then sync its trigger */
function saveScheduler(scheduler: any): { success: boolean; id: string; error?: string } {
  try {
    const id = AppStorageManager.saveScheduler(scheduler);
    TriggerService.setupTrigger({ ...scheduler, id });
    return { success: true, id };
  } catch (e: any) {
    return { success: false, id: '', error: e.message };
  }
}

/** Delete a scheduler and its trigger */
function deleteScheduler(id: string): { success: boolean } {
  AppStorageManager.deleteScheduler(id);
  TriggerService.removeTrigger(id);
  return { success: true };
}

/** Toggle a scheduler's status */
function toggleSchedulerStatus(id: string, status: string): { success: boolean } {
  const all = AppStorageManager.getSchedulers();
  const scheduler = all.find((s: any) => s.id === id);
  if (!scheduler) return { success: false };
  AppStorageManager.saveScheduler({ ...scheduler, status, updatedAt: new Date().toISOString() });
  TriggerService.setupTrigger({ ...scheduler, status });
  return { success: true };
}

/** Trigger an immediate send for a scheduler */
function sendNow(schedulerId: string): { sent: number; failed: number } {
  return SchedulerEngine.runNow(schedulerId);
}

/** Save or create a template */
function saveTemplate(template: any): { success: boolean; id: string; error?: string } {
  try {
    const id = AppStorageManager.saveTemplate(template);
    return { success: true, id };
  } catch (e: any) {
    return { success: false, id: '', error: e.message };
  }
}

/** Delete a template */
function deleteTemplate(id: string): { success: boolean } {
  AppStorageManager.deleteTemplate(id);
  return { success: true };
}

/** Fetch paginated logs */
function getLogs(limit = 200, offset = 0): any[] {
  return AppStorageManager.getLogs(limit, offset);
}

/** Export logs as CSV or JSON string */
function exportLogs(format: 'csv' | 'json'): string {
  const logs = AppStorageManager.getLogs(2000);
  if (format === 'json') return JSON.stringify(logs, null, 2);

  const headers = ['id','schedulerName','timestamp','recipient','subject','status','retryCount','durationMs','gmailMessageId','error'];
  const rows = logs.map((l: any) =>
    headers.map(h => `"${String(l[h] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/** Fetch verified Gmail sender aliases */
function getSenderAliases(): string[] {
  try {
    return GmailApp.getAliases();
  } catch {
    return [];
  }
}

/** Apps Script custom menu installer */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AutoMailPro')
    .addItem('Open Dashboard', 'openSidebar')
    .addSeparator()
    .addItem('Run All Schedulers Now', 'triggerRunAll')
    .addItem('Sync Triggers', 'syncTriggers')
    .addSeparator()
    .addItem('Generate Sample Schedulers', 'generateSampleSchedulers')
    .addToUi();
}

function syncTriggers() {
  TriggerService.syncAll();
  SpreadsheetApp.getUi().alert('Triggers synchronized successfully!');
}

function generateSampleSchedulers() {
  const sample1 = {
    id: Utilities.getUuid(),
    name: 'Sample: Invoice Routing',
    tabName: 'Sheet1',
    tableStartRow: 1,
    recipientColumn: 'Email',
    subjectTemplate: 'Invoice #{{InvoiceNo}} is Due',
    bodyTemplate: 'Hello {{Name}},<br><br>Your invoice #{{InvoiceNo}} for {{Amount}} is due on {{DueDate}}.',
    scheduleType: 'daily',
    timeValue: '09:00',
    status: 'active',
    conditions: [
      { column: 'Status', operator: 'equals', value: 'Unpaid' }
    ],
    maxRetries: 3
  };

  const sample2 = {
    id: Utilities.getUuid(),
    name: 'Sample: HR Onboarding',
    tabName: 'Sheet1',
    tableStartRow: 1,
    recipientColumn: 'Email',
    subjectTemplate: 'Welcome to the Team, {{Name}}!',
    bodyTemplate: 'Hi {{Name}},<br><br>We are thrilled to have you join us starting {{StartDate}}.',
    scheduleType: 'weekly',
    daysOfWeek: [1], // Monday
    timeValue: '10:00',
    status: 'paused',
    conditions: [],
    maxRetries: 2
  };

  AppStorageManager.saveScheduler(sample1);
  AppStorageManager.saveScheduler(sample2);
  
  SpreadsheetApp.getUi().alert('Successfully added 2 sample schedulers! Open the Dashboard to view them.');
}
