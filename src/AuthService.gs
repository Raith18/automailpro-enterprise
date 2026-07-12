/**
 * AuthService.gs
 * -----------------------------------------------------------------------
 * Minimal role model: Admin, HR, Manager, Viewer. Roles are stored as
 * Configuration rows shaped "Role:email@company.com" -> "HR" so no new
 * sheet is needed. Anyone not explicitly listed, and the configured
 * Admin Email itself, get sensible defaults below.
 *
 * This is intentionally simple — a real deployment might swap this for
 * Google Groups membership or a dedicated Users sheet, but the public
 * API (getCurrentUserRole, can) would stay the same.
 * -----------------------------------------------------------------------
 */

const AuthService = (() => {

  const ROLES = Object.freeze({
    ADMIN: 'Admin',
    HR: 'HR',
    MANAGER: 'Manager',
    VIEWER: 'Viewer'
  });

  // What each role is allowed to do. Keep this the single source of
  // truth for permission checks — UI and any future API layer both
  // call can(), never compare role strings directly.
  const PERMISSIONS = {
    Admin: ['view', 'schedule', 'retry', 'editTemplates', 'editSettings', 'viewReports', 'archiveLogs'],
    HR: ['view', 'schedule', 'retry', 'editTemplates', 'viewReports'],
    Manager: ['view', 'schedule', 'viewReports'],
    Viewer: ['view']
  };

  /**
   * Determines the current effective user's role.
   * @return {string} one of ROLES
   */
  function getCurrentUserRole() {
    const email = Session.getActiveUser().getEmail();
    if (!email) return ROLES.VIEWER; // no identity available — least privilege

    const adminEmail = ConfigService.get('Admin Email', '');
    if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) return ROLES.ADMIN;

    const configured = ConfigService.get(`Role:${email}`, null);
    if (configured && PERMISSIONS[configured]) return configured;

    // Whoever owns the container spreadsheet is trusted as Admin by
    // default — covers the common single-owner deployment without any
    // manual role setup required.
    try {
      const owner = SpreadsheetApp.getActiveSpreadsheet().getOwner();
      if (owner && owner.getEmail().toLowerCase() === email.toLowerCase()) return ROLES.ADMIN;
    } catch (e) { /* getOwner can fail in some contexts — fall through */ }

    return ROLES.VIEWER;
  }

  /**
   * Checks whether the current user's role permits a given action.
   * @param {string} action e.g. 'editSettings', 'retry'
   * @return {boolean}
   */
  function can(action) {
    const role = getCurrentUserRole();
    return (PERMISSIONS[role] || []).includes(action);
  }

  return { getCurrentUserRole, can, ROLES, PERMISSIONS };

})();

/** Global wrapper — used by index.html to hide nav items the user can't use. */
function getCurrentUserAccess() {
  return {
    role: AuthService.getCurrentUserRole(),
    can: {
      schedule: AuthService.can('schedule'),
      retry: AuthService.can('retry'),
      editTemplates: AuthService.can('editTemplates'),
      editSettings: AuthService.can('editSettings'),
      viewReports: AuthService.can('viewReports'),
      archiveLogs: AuthService.can('archiveLogs')
    }
  };
}
