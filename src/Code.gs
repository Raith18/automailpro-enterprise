/**
 * Code.gs
 * -----------------------------------------------------------------------
 * Add-on lifecycle entry points. These three function names are wired
 * directly into appsscript.json's addOns config (homepageTrigger,
 * onFileScopeGrantedTrigger) and Apps Script's own onInstall convention —
 * they must exist with these exact names or the add-on's homepage card
 * throws when Google's runtime tries to call it.
 *
 * Everything else in the project is reachable via the Sheets custom menu
 * (Menu.gs) regardless of whether this is used as a bound script or an
 * installed Workspace Add-on — this file only covers the Add-on-specific
 * surface (the homepage card shown in the Sheets sidebar's Add-ons panel).
 * -----------------------------------------------------------------------
 */

/**
 * Runs once when the add-on is installed. Apps Script does NOT call
 * onOpen automatically after install the way it does on every subsequent
 * sheet open — without this, the custom menu wouldn't appear until the
 * user manually reloaded the spreadsheet.
 * @param {Object} e install event object
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Builds the add-on's homepage card — what shows in the Sheets sidebar
 * under Extensions > Add-ons before the user has opened the full
 * Dashboard sidebar. Kept intentionally simple: status + one button.
 * @param {Object} e homepage event object
 * @return {GoogleAppsScript.Card_Service.Card}
 */
function onHomepage(e) {
  const active = _safeCheck(() => TriggerService.isSchedulerActive(), null);
  const statusText = active === null
    ? 'Status unknown — open the Dashboard to initialize.'
    : (active ? '✅ Scheduler is running.' : '⏸ Scheduler is installed but not running.');

  const card = CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader()
      .setTitle('Smart Mail Scheduler')
      .setSubtitle(statusText));

  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph()
      .setText('Schedule, template, and track bulk email from this spreadsheet.'))
    .addWidget(CardService.newTextButton()
      .setText('Open Dashboard')
      .setOnClickAction(CardService.newAction().setFunctionName('_openDashboardFromCard')));

  card.addSection(section);
  return card.build();
}

/**
 * Handler for onFileScopeGrantedTrigger — fires when a user grants
 * per-file Drive scope (relevant for the Attachment feature's file
 * access). No extra setup is needed on our side beyond acknowledging the
 * grant, since AttachmentService already re-checks accessibility per call
 * rather than caching a stale permission state.
 * @param {Object} e file-scope-granted event object
 */
function onFileScopeGranted(e) {
  // Intentionally minimal — DriveApp calls in AttachmentService already
  // handle access failures gracefully per-call, so there's no cached
  // state here that needs invalidating.
}

/**
 * Card action target for the homepage's "Open Dashboard" button —
 * CardService actions need a dedicated function, they can't call
 * menuShowDashboard's Ui.showSidebar directly since a homepage card has
 * no SpreadsheetApp.getUi() context the way a menu click does.
 * @param {Object} e action event object
 * @return {GoogleAppsScript.Card_Service.ActionResponse}
 */
function _openDashboardFromCard(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(onHomepage(e)))
    .setNotification(CardService.newNotification()
      .setText('Please look at the TOP of your Google Sheet. Click the "Smart Mail Scheduler" menu next to "Help", then click "Dashboard".'))
    .build();
}

/**
 * Runs a function and returns a fallback instead of throwing — used here
 * so a fresh install (no sheets initialized yet) doesn't crash the
 * homepage card before Setup has ever run.
 * @param {Function} fn
 * @param {*} fallback
 * @return {*}
 */
function _safeCheck(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}
