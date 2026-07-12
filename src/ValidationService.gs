/**
 * ValidationService.gs
 * -----------------------------------------------------------------------
 * Single source of truth for "is this a valid row to schedule". Used by
 * scheduler.html's form submit today; any future bulk-import or API
 * entry point should call this too rather than re-checking fields itself.
 * -----------------------------------------------------------------------
 */

const ValidationService = (() => {

  const VALID_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

  /**
   * Validates a new-schedule form submission. Collects every problem
   * found rather than stopping at the first, so the UI can show a full
   * list instead of a frustrating one-at-a-time loop.
   * @param {Object} data { recipientEmail, recipientName, subject, templateName,
   *                         scheduleDate, scheduleTime, attachmentFileId, priority }
   * @return {{valid: boolean, errors: Array<string>}}
   */
  function validateNewSchedule(data) {
    const errors = [];

    if (!Utils.isValidEmail(data.recipientEmail)) {
      errors.push('Recipient email is missing or not a valid address.');
    }

    if (!data.templateName || !String(data.templateName).trim()) {
      errors.push('A template must be selected.');
    } else {
      const activeNames = TemplateService.listActiveTemplateNames();
      if (!activeNames.includes(data.templateName)) {
        errors.push(`Template "${data.templateName}" is not an active template.`);
      }
    }

    if (!data.scheduleDate) {
      errors.push('Schedule date is required.');
    } else {
      const scheduledAt = Utils.combineDateAndTime(data.scheduleDate, data.scheduleTime || '00:00');
      const now = new Date();
      // Allow "now" with a small grace window rather than requiring strictly future,
      // since form submission + network round-trip takes a few seconds.
      if (scheduledAt < new Date(now.getTime() - 60000)) {
        errors.push('Schedule date/time is in the past.');
      }
    }

    if (data.priority && !VALID_PRIORITIES.includes(data.priority)) {
      errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }

    if (data.attachmentFileId && String(data.attachmentFileId).trim()) {
      const ids = String(data.attachmentFileId).split(',').map(s => s.trim()).filter(Boolean);
      const inaccessible = ids.filter(id => !AttachmentService.isAccessible(id));
      if (inaccessible.length > 0) {
        errors.push(`Attachment file ID(s) not accessible: ${inaccessible.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  return { validateNewSchedule, VALID_PRIORITIES };

})();
