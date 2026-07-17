"use strict";
/**
 * MailService.ts
 * Handles Gmail sending with template merge, retry logic, batch control,
 * and deduplication.
 */
const MailService = (() => {
    function mergeTags(template, row) {
        return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const val = row[key.trim()];
            return val !== undefined && val !== null ? String(val) : '';
        });
    }
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    }
    function sendBatch(opts) {
        const { rows, recipientColumn, ccColumn, bccColumn, replyTo, senderAlias, subjectTemplate, bodyTemplate, conditions = [], schedulerId, schedulerName, batchSize = 50, bufferSecs = 3, maxRetries = 3, tableBlob } = opts;
        let sent = 0;
        let failed = 0;
        const settings = AppStorageManager.getSettings();
        const dailyCap = settings.dailyCap ?? 500;
        // Gmail quota gate
        const todaySent = getDailyCount();
        if (todaySent >= dailyCap) {
            Logger.log(`Daily cap (${dailyCap}) reached. Deferring batch.`);
            return { sent: 0, failed: 0 };
        }
        const quota = Math.min(batchSize, dailyCap - todaySent);
        let processed = 0;
        for (const row of rows) {
            if (processed >= quota)
                break;
            // Evaluate conditions
            if (!ConditionEngine.evaluateRow(row, conditions))
                continue;
            const recipient = String(row[recipientColumn] ?? '').trim();
            if (!isValidEmail(recipient)) {
                logEntry(schedulerId, schedulerName, recipient, '(invalid)', 'Failed', 0, 0, '', 'Invalid email address');
                failed++;
                continue;
            }
            const subject = mergeTags(subjectTemplate, row);
            let htmlBody = mergeTags(bodyTemplate, row);
            if (tableBlob) {
                htmlBody += '<br><br><div style="margin-top: 20px;"><strong>Table Data:</strong><br><img src="cid:tableScreenshot" style="max-width: 100%; border: 1px solid #ccc;" /></div>';
            }
            let success = false;
            let lastError = '';
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const mailOpts = {
                        htmlBody,
                        noReply: false,
                        inlineImages: tableBlob ? { tableScreenshot: tableBlob } : undefined,
                    };
                    if (ccColumn && row[ccColumn])
                        mailOpts.cc = String(row[ccColumn]);
                    if (bccColumn && row[bccColumn])
                        mailOpts.bcc = String(row[bccColumn]);
                    if (replyTo)
                        mailOpts.replyTo = replyTo;
                    if (senderAlias)
                        mailOpts.from = senderAlias;
                    GmailApp.sendEmail(recipient, subject, '', mailOpts);
                    success = true;
                    break;
                }
                catch (e) {
                    lastError = e.message ?? String(e);
                    if (attempt < maxRetries)
                        Utilities.sleep(5000 * (attempt + 1));
                }
            }
            const start = Date.now();
            if (success) {
                logEntry(schedulerId, schedulerName, recipient, subject, 'Sent', 0, Date.now() - start, '');
                sent++;
                incrementDailyCount();
            }
            else {
                logEntry(schedulerId, schedulerName, recipient, subject, 'Failed', maxRetries, Date.now() - start, '', lastError);
                failed++;
            }
            processed++;
            // Safety buffer
            if (bufferSecs > 0)
                Utilities.sleep(Math.random() * bufferSecs * 1000);
        }
        return { sent, failed };
    }
    function logEntry(schedulerId, schedulerName, recipient, subject, status, retryCount, durationMs, gmailMessageId, error) {
        AppStorageManager.appendLog({
            schedulerId, schedulerName, recipient, subject, status,
            retryCount, durationMs, gmailMessageId, error,
            timestamp: new Date().toISOString(),
        });
    }
    // Daily count tracking
    function getDailyCount() {
        const key = `ams_daily_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')}`;
        return parseInt(PropertiesService.getScriptProperties().getProperty(key) ?? '0', 10);
    }
    function incrementDailyCount() {
        const key = `ams_daily_${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd')}`;
        const curr = getDailyCount();
        PropertiesService.getScriptProperties().setProperty(key, String(curr + 1));
    }
    return { sendBatch, getDailyCount };
})();
