/**
 * Typed wrappers around google.script.run for safe frontend consumption.
 * Falls back to mock data when running outside Apps Script (e.g. Vite dev mode).
 */
import type { AppState, Scheduler, EmailTemplate } from '../types';

declare const google: { script: { run: any } };
const IS_GAS = typeof google !== 'undefined' && google?.script?.run;

function gasRun<T>(fn: string, ...args: any[]): Promise<T> {
  if (!IS_GAS) {
    return Promise.reject(new Error(`GAS not available (dev mode). Called: ${fn}`));
  }
  return new Promise((resolve, reject) => {
    (google.script.run as any)
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [fn](...args);
  });
}

export const GAS = {
  getAppState: (): Promise<AppState> =>
    gasRun<AppState>('getAppState'),

  saveScheduler: (scheduler: Partial<Scheduler>): Promise<{ success: boolean; id: string }> =>
    gasRun('saveScheduler', scheduler),

  deleteScheduler: (id: string): Promise<{ success: boolean }> =>
    gasRun('deleteScheduler', id),

  toggleSchedulerStatus: (id: string, status: string): Promise<{ success: boolean }> =>
    gasRun('toggleSchedulerStatus', id, status),

  sendNow: (schedulerId: string): Promise<{ sent: number; failed: number }> =>
    gasRun('sendNow', schedulerId),

  saveTemplate: (template: Partial<EmailTemplate>): Promise<{ success: boolean; id: string }> =>
    gasRun('saveTemplate', template),

  deleteTemplate: (id: string): Promise<{ success: boolean }> =>
    gasRun('deleteTemplate', id),

  getLogs: (limit?: number, offset?: number): Promise<any[]> =>
    gasRun('getLogs', limit ?? 200, offset ?? 0),

  exportLogs: (format: 'csv' | 'json'): Promise<string> =>
    gasRun('exportLogs', format),

  rescanSpreadsheet: (): Promise<import('../types').SheetInfo> =>
    gasRun('rescanSpreadsheet'),

  getSenderAliases: (): Promise<string[]> =>
    gasRun('getSenderAliases'),
};
