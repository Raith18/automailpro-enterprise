// ─── Core Data Types ────────────────────────────────────────────────────────

export interface SheetInfo {
  id: string;
  name: string;
  tabs: TabInfo[];
}

export interface TabInfo {
  name: string;
  index: number;
  rowCount: number;
  colCount: number;
  tables: TableInfo[];
}

export interface TableInfo {
  tabName: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  headers: string[];
  rowCount: number;
  columnMap: ColumnMap;
}

export type ColumnType =
  | 'email' | 'cc' | 'bcc' | 'name' | 'subject' | 'status'
  | 'date' | 'attachment' | 'driveLink' | 'invoice' | 'custom';

export interface ColumnMap {
  [header: string]: ColumnType;
}

// ─── Scheduler Types ─────────────────────────────────────────────────────────

export type ScheduleType =
  | 'now' | 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  | 'businessDays' | 'everyXMinutes' | 'everyXHours' | 'everyXDays' | 'cron';

export type SchedulerStatus = 'active' | 'paused' | 'disabled' | 'completed' | 'error';

export interface ConditionRule {
  column: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isDate' | 'isChecked' | 'isNotEmpty';
  value: string;
  logicOperator?: 'AND' | 'OR';
}

export interface Scheduler {
  id: string;
  name: string;
  status: SchedulerStatus;
  // Data source
  spreadsheetId: string;
  tabName: string;
  tableStartRow: number;
  // Recipients
  recipientColumn: string;
  ccColumn?: string;
  bccColumn?: string;
  replyTo?: string;
  senderAlias?: string;
  // Email content
  subjectTemplate: string;
  bodyTemplate: string;
  templateId?: string;
  attachments?: string[];
  // Schedule
  scheduleType: ScheduleType;
  scheduleValue?: number;   // for everyX types
  cronExpression?: string;
  sendTime?: string;        // HH:MM
  timezone?: string;
  startDate?: string;
  endDate?: string;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
  // Conditions
  conditions?: ConditionRule[];
  // Retry
  maxRetries?: number;
  retryDelaySecs?: number;
  // Stats
  totalSent?: number;
  totalFailed?: number;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Template Types ───────────────────────────────────────────────────────────

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  mergeTokens: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Log Types ───────────────────────────────────────────────────────────────

export type LogStatus = 'Sent' | 'Failed' | 'Pending' | 'Retrying' | 'Skipped';

export interface LogEntry {
  id: string;
  schedulerId: string;
  schedulerName: string;
  timestamp: string;
  recipient: string;
  subject: string;
  status: LogStatus;
  retryCount: number;
  durationMs: number;
  gmailMessageId?: string;
  error?: string;
}

// ─── App State ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  activeSchedulers: number;
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  gmailQuotaUsed: number;
  gmailQuotaLimit: number;
  lastSyncAt: string;
}

export interface AppState {
  sheetInfo: SheetInfo | null;
  schedulers: Scheduler[];
  templates: EmailTemplate[];
  logs: LogEntry[];
  stats: DashboardStats;
  senderAliases: string[];
  userEmail: string;
  version: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  read: boolean;
}
