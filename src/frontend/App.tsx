import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import AppShell from './components/Layout/AppShell';
import type { AppState } from './types';
import { GAS } from './services/gas';

// Mock state for local dev (removed in production GAS context)
const MOCK_STATE: AppState = {
  sheetInfo: {
    id: 'mock-sheet-id-123',
    name: 'Sample CRM Sheet',
    tabs: [
      {
        name: 'Contacts',
        index: 0,
        rowCount: 152,
        colCount: 8,
        tables: [
          {
            tabName: 'Contacts',
            startRow: 1, startCol: 1, endRow: 153, endCol: 8,
            headers: ['Name', 'Email', 'Company', 'Status', 'Invoice Number', 'Amount', 'Due Date', 'Drive Link'],
            rowCount: 152,
            columnMap: {
              'Name': 'name', 'Email': 'email', 'Company': 'custom',
              'Status': 'status', 'Invoice Number': 'invoice',
              'Amount': 'custom', 'Due Date': 'date', 'Drive Link': 'driveLink'
            }
          }
        ]
      },
      {
        name: 'Archive',
        index: 1,
        rowCount: 48,
        colCount: 5,
        tables: [
          {
            tabName: 'Archive',
            startRow: 1, startCol: 1, endRow: 49, endCol: 5,
            headers: ['Name', 'Email', 'Sent Date', 'Subject', 'Status'],
            rowCount: 48,
            columnMap: { 'Name': 'name', 'Email': 'email', 'Status': 'status', 'Sent Date': 'date', 'Subject': 'subject' }
          }
        ]
      }
    ]
  },
  schedulers: [
    {
      id: 's1', name: 'Monthly Invoice Emails', status: 'active',
      spreadsheetId: 'mock-sheet-id-123', tabName: 'Contacts', tableStartRow: 1,
      recipientColumn: 'Email', subjectTemplate: 'Invoice {{Invoice Number}} — Due {{Due Date}}',
      bodyTemplate: '<p>Dear {{Name}},</p><p>Please find your invoice attached.</p>',
      scheduleType: 'monthly', sendTime: '09:00', timezone: 'Asia/Kolkata',
      totalSent: 87, totalFailed: 2,
      lastRunAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      nextRunAt: new Date(Date.now() + 86400000 * 27).toISOString(),
      conditions: [{ column: 'Status', operator: 'equals', value: 'Pending' }],
      createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
    },
    {
      id: 's2', name: 'Daily Reminder Blast', status: 'paused',
      spreadsheetId: 'mock-sheet-id-123', tabName: 'Contacts', tableStartRow: 1,
      recipientColumn: 'Email', subjectTemplate: 'Reminder: {{Name}}',
      bodyTemplate: '<p>This is a reminder.</p>',
      scheduleType: 'daily', sendTime: '08:30', timezone: 'Asia/Kolkata',
      totalSent: 210, totalFailed: 0,
      createdAt: '2026-06-15T00:00:00Z', updatedAt: '2026-07-10T00:00:00Z',
    }
  ],
  templates: [
    {
      id: 't1', name: 'Invoice Template',
      subject: 'Invoice {{Invoice Number}}',
      htmlBody: '<h2>Dear {{Name}},</h2><p>Your invoice <strong>{{Invoice Number}}</strong> for <strong>{{Amount}}</strong> is due on {{Due Date}}.</p>',
      mergeTokens: ['{{Name}}', '{{Invoice Number}}', '{{Amount}}', '{{Due Date}}'],
      createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z'
    }
  ],
  logs: [
    { id: 'l1', schedulerId: 's1', schedulerName: 'Monthly Invoice Emails', timestamp: new Date(Date.now() - 3600000).toISOString(), recipient: 'john@example.com', subject: 'Invoice #1024 Due', status: 'Sent', retryCount: 0, durationMs: 842, gmailMessageId: 'msg_abc123' },
    { id: 'l2', schedulerId: 's1', schedulerName: 'Monthly Invoice Emails', timestamp: new Date(Date.now() - 7200000).toISOString(), recipient: 'priya@corp.in', subject: 'Invoice #1023 Due', status: 'Sent', retryCount: 0, durationMs: 620 },
    { id: 'l3', schedulerId: 's1', schedulerName: 'Monthly Invoice Emails', timestamp: new Date(Date.now() - 10800000).toISOString(), recipient: 'bad-email', subject: 'Invoice #1022 Due', status: 'Failed', retryCount: 3, durationMs: 1500, error: 'Invalid email address' },
  ],
  stats: {
    activeSchedulers: 1, totalSent: 297, totalFailed: 2, totalPending: 45,
    gmailQuotaUsed: 297, gmailQuotaLimit: 500,
    lastSyncAt: new Date().toISOString()
  },
  senderAliases: ['billing@mycompany.com', 'support@mycompany.com'],
  userEmail: 'admin@mycompany.com',
  version: '20.0'
};

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);

  const theme = useMemo(() => getTheme(mode), [mode]);

  const colorMode = useMemo(() => ({
    toggle: () => setMode(m => m === 'light' ? 'dark' : 'light'),
    mode,
  }), [mode]);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const state = await GAS.getAppState();
      setAppState(state);
    } catch {
      // Dev mode: use mock data
      setAppState(MOCK_STATE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
    // Background refresh every 30s
    const interval = setInterval(() => {
      GAS.getAppState().then(setAppState).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [loadState]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell colorMode={colorMode} appState={appState} loading={loading} />
    </ThemeProvider>
  );
}
