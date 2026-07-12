/**
 * TriggerService.gs
 * -----------------------------------------------------------------------
 * Owns installable trigger lifecycle. Nothing else in the project should
 * call ScriptApp.newTrigger directly — install/remove goes through here
 * so there's exactly one place that can create duplicate triggers by
 * mistake, and it guards against that itself.
 * -----------------------------------------------------------------------
 */

const TriggerService = (() => {

  const SCHEDULER_HANDLER = 'runScheduler';

  /**
   * Installs the once-a-minute trigger that drives the whole app.
   * Idempotent — removes any existing runScheduler trigger first so
   * repeated calls (e.g. clicking a menu item twice) never stack up
   * duplicate triggers sending everything twice as fast.
   * @return {string} confirmation message
   */
  function installScheduler() {
    _removeTriggersFor(SCHEDULER_HANDLER);
    ScriptApp.newTrigger(SCHEDULER_HANDLER)
      .timeBased()
      .everyMinutes(1)
      .create();
    return 'Scheduler trigger installed — runs every minute.';
  }

  /**
   * Removes the scheduler trigger, effectively pausing the whole app
   * without touching any data.
   * @return {string} confirmation message
   */
  function uninstallScheduler() {
    const removed = _removeTriggersFor(SCHEDULER_HANDLER);
    return removed > 0
      ? 'Scheduler trigger removed — app is paused.'
      : 'No active scheduler trigger was found.';
  }

  /**
   * Reports whether the scheduler trigger is currently installed —
   * used by settings.html to show an on/off indicator.
   * @return {boolean}
   */
  function isSchedulerActive() {
    return ScriptApp.getProjectTriggers()
      .some(t => t.getHandlerFunction() === SCHEDULER_HANDLER);
  }

  /**
   * Removes every installed trigger pointing at a given handler function.
   * @param {string} handlerName
   * @return {number} count removed
   */
  function _removeTriggersFor(handlerName) {
    const triggers = ScriptApp.getProjectTriggers();
    let count = 0;
    triggers.forEach(t => {
      if (t.getHandlerFunction() === handlerName) {
        ScriptApp.deleteTrigger(t);
        count++;
      }
    });
    return count;
  }

  return { installScheduler, uninstallScheduler, isSchedulerActive };

})();
