/**
 * MailService.gs
 * -----------------------------------------------------------------------
 * The single choke point where an email actually leaves the system.
 * Scheduler.gs and QueueService.gs both call sendScheduledEmail(row) —
 * neither of them should ever call GmailApp directly, so retry/logging/
 * validation behavior stays consistent no matter what triggered the send.
 *
 * Designed so swapping GmailApp for SendGrid/SES later only means
 * changing _dispatch() — everything above it (rendering, attachments,
 * logging) stays identical.
 * -----------------------------------------------------------------------
 */

const MailService = (() => {

  /**
   * Sends one scheduled email end-to-end: validate -> render -> attach ->
   * dispatch -> log. Never throws — always returns a result object so
   * callers can update the sheet row's Status without try/catch.
   * @param {Object} row a row object from MailScheduler (via Utils.sheetToObjects)
   * @return {{success: boolean, error: string|null, processingTimeMs: number}}
   */
  function sendScheduledEmail(row) {
    const startTime = Date.now();
    const recipient = row['Recipient Email'];
    const templateName = row['Template Name'];

    // --- Validate ---
    if (!Utils.isValidEmail(recipient)) {
      return _fail(row, `Invalid recipient email: "${recipient}"`, startTime);
    }

    // --- Render ---
    let rendered;
    try {
      const data = _buildTemplateData(row);
      rendered = TemplateService.render(templateName, data);
    } catch (e) {
      return _fail(row, `Template render failed: ${e.message}`, startTime);
    }

    // Row-level Subject overrides template subject if explicitly set.
    const finalSubject = row['Subject'] && String(row['Subject']).trim()
      ? row['Subject']
      : rendered.subject;

    // --- Attachments ---
    const { blobs, errors: attachmentErrors } = AttachmentService.resolve(row['Attachment File ID'], data);
    if (attachmentErrors.length > 0 && blobs.length === 0 && row['Attachment File ID']) {
      // Attachment was specified but totally unresolvable — treat as failure
      // rather than silently sending without it.
      return _fail(row, attachmentErrors.join('; '), startTime);
    }

    // --- Dispatch ---
    try {
      _dispatch({
        to: recipient,
        subject: finalSubject,
        plainBody: rendered.plainText,
        htmlBody: rendered.html,
        attachments: blobs
      });
    } catch (e) {
      return _fail(row, `Send failed: ${e.message}`, startTime);
    }

    const processingTimeMs = Date.now() - startTime;
    AppLogger.logSent({
      recipient,
      subject: finalSubject,
      template: templateName,
      processingTimeMs,
      triggerType: row.__triggerType || 'Scheduled'
    });

    return { success: true, error: null, processingTimeMs };
  }

  /**
   * Builds the placeholder data object from a scheduled row. Anything
   * beyond the fixed columns (Recipient Name, ID) is treated as available
   * for {{RecipientName}}, {{ID}} etc. — extend here as custom columns
   * are added to MailScheduler.
   * @param {Object} row
   * @return {Object}
   */
  function _buildTemplateData(row) {
    return {
      Name: row['Recipient Name'] || '',
      Email: row['Recipient Email'] || '',
      Company: ConfigService.get('Company Name', ''),
      Date: Utils.formatDate(new Date()),
      ID: row['ID'] || ''
      // Department, EmployeeID, Manager, MeetingTime, CustomField are
      // expected to come from extra columns once the sheet supports them —
      // left resolvable-but-blank here rather than hardcoded.
    };
  }

  /**
   * The only function that talks to GmailApp. Kept tiny and isolated so
   * swapping providers later (SendGrid/SES) means changing only this.
   * @param {Object} params { to, subject, plainBody, htmlBody, attachments }
   */
  function _dispatch(params) {
    if (typeof NotificationService !== 'undefined') {
      try {
        const remaining = MailApp.getRemainingDailyQuota();
        if (remaining < 50) {
          NotificationService.notifyAdmin(
            'Low Email Quota Warning',
            `Your Google Workspace account only has ${remaining} emails left in its daily quota. Scheduler may fail to send remaining emails.`
          );
        }
      } catch (e) {
        // MailApp.getRemainingDailyQuota might not be available or fails
      }
    }

    const senderName = ConfigService.get('Sender Name', '');
    GmailApp.sendEmail(params.to, params.subject, params.plainBody, {
      htmlBody: params.htmlBody,
      attachments: params.attachments,
      name: senderName || undefined
    });
  }

  /**
   * Shared failure path — logs and returns a consistent result shape.
   * @param {Object} row
   * @param {string} errorMessage
   * @param {number} startTime
   * @return {{success: boolean, error: string, processingTimeMs: number}}
   */
  function _fail(row, errorMessage, startTime) {
    const processingTimeMs = Date.now() - startTime;
    AppLogger.logFailed({
      recipient: row['Recipient Email'],
      subject: row['Subject'] || '',
      template: row['Template Name'],
      error: errorMessage,
      retryCount: row['Retry Count'] || 0,
      triggerType: row.__triggerType || 'Scheduled'
    });
    return { success: false, error: errorMessage, processingTimeMs };
  }

  return { sendScheduledEmail };

})();
