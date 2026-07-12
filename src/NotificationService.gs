/**
 * NotificationService.gs
 * -----------------------------------------------------------------------
 * Handles emailing the admin for system alerts like batch failures, 
 * retry exhaustion, or quota warnings.
 * -----------------------------------------------------------------------
 */

const NotificationService = (() => {

  /**
   * Sends a notification email to the admin if notifications are enabled.
   * @param {string} subject 
   * @param {string} body 
   */
  function notifyAdmin(subject, body) {
    const enableNotifications = String(ConfigService.get('Enable Notifications')).toLowerCase() === 'true';
    const adminEmail = ConfigService.get('Admin Email');

    if (!enableNotifications || !adminEmail || !Utils.isValidEmail(adminEmail)) {
      return;
    }

    try {
      MailApp.sendEmail(adminEmail, '[Smart Mail Scheduler Alert] ' + subject, body);
    } catch (e) {
      Logger.log('NotificationService failed to alert admin: ' + e.message);
    }
  }

  return { notifyAdmin };

})();
