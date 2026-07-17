"use strict";
/**
 * SchedulerEngine.ts
 * Executes each active scheduler. Called by time-driven triggers.
 */
const SchedulerEngine = (() => {
    function runAll() {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(10000)) {
            Logger.log('Could not acquire lock. Another execution is in progress.');
            return;
        }
        try {
            const schedulers = AppStorageManager.getSchedulers();
            const settings = AppStorageManager.getSettings();
            for (const scheduler of schedulers) {
                if (scheduler.status !== 'active')
                    continue;
                try {
                    runScheduler(scheduler, settings);
                }
                catch (e) {
                    Logger.log(`Scheduler "${scheduler.name}" failed: ${e.message}`);
                }
            }
        }
        finally {
            lock.releaseLock();
        }
    }
    function runScheduler(scheduler, settings) {
        // Skip weekends if configured
        if (scheduler.skipWeekends) {
            const day = new Date().getDay();
            if (day === 0 || day === 6)
                return;
        }
        // Check end date
        if (scheduler.endDate && new Date() > new Date(scheduler.endDate)) {
            AppStorageManager.saveScheduler({ ...scheduler, status: 'completed', updatedAt: new Date().toISOString() });
            return;
        }
        const rows = SpreadsheetManager.getTableData(scheduler.tabName, scheduler.tableStartRow);
        const tableBlob = SpreadsheetManager.getTableImageBlob(scheduler.tabName, scheduler.tableStartRow);
        const result = MailService.sendBatch({
            schedulerId: scheduler.id,
            schedulerName: scheduler.name,
            rows,
            recipientColumn: scheduler.recipientColumn,
            ccColumn: scheduler.ccColumn,
            bccColumn: scheduler.bccColumn,
            replyTo: scheduler.replyTo,
            senderAlias: scheduler.senderAlias,
            subjectTemplate: scheduler.subjectTemplate,
            bodyTemplate: scheduler.bodyTemplate,
            conditions: scheduler.conditions ?? [],
            batchSize: settings.batchSize ?? 50,
            bufferSecs: settings.bufferSecs ?? 3,
            maxRetries: scheduler.maxRetries ?? 3,
            tableBlob,
        });
        // Update stats
        AppStorageManager.saveScheduler({
            ...scheduler,
            totalSent: (scheduler.totalSent ?? 0) + result.sent,
            totalFailed: (scheduler.totalFailed ?? 0) + result.failed,
            lastRunAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        Logger.log(`Scheduler "${scheduler.name}": sent=${result.sent}, failed=${result.failed}`);
    }
    function runNow(schedulerId) {
        const scheduler = AppStorageManager.getSchedulers().find((s) => s.id === schedulerId);
        if (!scheduler)
            throw new Error('Scheduler not found: ' + schedulerId);
        const settings = AppStorageManager.getSettings();
        const rows = SpreadsheetManager.getTableData(scheduler.tabName, scheduler.tableStartRow);
        const tableBlob = SpreadsheetManager.getTableImageBlob(scheduler.tabName, scheduler.tableStartRow);
        return MailService.sendBatch({
            schedulerId: scheduler.id, schedulerName: scheduler.name, rows,
            recipientColumn: scheduler.recipientColumn, ccColumn: scheduler.ccColumn,
            bccColumn: scheduler.bccColumn, replyTo: scheduler.replyTo, senderAlias: scheduler.senderAlias,
            subjectTemplate: scheduler.subjectTemplate, bodyTemplate: scheduler.bodyTemplate,
            conditions: scheduler.conditions ?? [],
            batchSize: settings.batchSize ?? 50, bufferSecs: settings.bufferSecs ?? 3,
            maxRetries: scheduler.maxRetries ?? 3, tableBlob,
        });
    }
    return { runAll, runNow };
})();
