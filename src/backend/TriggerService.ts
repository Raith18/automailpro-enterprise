/**
 * TriggerService.ts
 * Manages Apps Script time-driven triggers for each active scheduler.
 */

const TriggerService = (() => {
  const TRIGGER_PROP = 'ams_triggers';

  function getTriggerMap(): Record<string, string> {
    const raw = PropertiesService.getScriptProperties().getProperty(TRIGGER_PROP);
    return raw ? JSON.parse(raw) : {};
  }

  function saveTriggerMap(map: Record<string, string>): void {
    PropertiesService.getScriptProperties().setProperty(TRIGGER_PROP, JSON.stringify(map));
  }

  function setupTrigger(scheduler: any): void {
    removeTrigger(scheduler.id);

    if (scheduler.status !== 'active') return;

    let trigger: GoogleAppsScript.Script.Trigger | null = null;

    switch (scheduler.scheduleType) {
      case 'everyXMinutes':
        trigger = ScriptApp.newTrigger('triggerRunAll')
          .timeBased()
          .everyMinutes(scheduler.scheduleValue ?? 30)
          .create();
        break;
      case 'everyXHours':
        trigger = ScriptApp.newTrigger('triggerRunAll')
          .timeBased()
          .everyHours(scheduler.scheduleValue ?? 1)
          .create();
        break;
      case 'daily':
      case 'businessDays': {
        const [h] = (scheduler.sendTime ?? '08:00').split(':').map(Number);
        trigger = ScriptApp.newTrigger('triggerRunAll')
          .timeBased()
          .everyDays(1)
          .atHour(h)
          .create();
        break;
      }
      case 'weekly': {
        const [h] = (scheduler.sendTime ?? '08:00').split(':').map(Number);
        trigger = ScriptApp.newTrigger('triggerRunAll')
          .timeBased()
          .onWeekDay(ScriptApp.WeekDay.MONDAY)
          .atHour(h)
          .create();
        break;
      }
      default:
        // once / now: handled by direct invocation only
        break;
    }

    if (trigger) {
      const map = getTriggerMap();
      map[scheduler.id] = trigger.getUniqueId();
      saveTriggerMap(map);
    }
  }

  function removeTrigger(schedulerId: string): void {
    const map = getTriggerMap();
    const triggerId = map[schedulerId];
    if (!triggerId) return;
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getUniqueId() === triggerId) ScriptApp.deleteTrigger(t);
    });
    delete map[schedulerId];
    saveTriggerMap(map);
  }

  function syncAll(): void {
    const schedulers = AppStorageManager.getSchedulers();
    schedulers.forEach((s: any) => {
      if (s.status === 'active') setupTrigger(s);
      else removeTrigger(s.id);
    });
  }

  return { setupTrigger, removeTrigger, syncAll };
})();

/** Global trigger target */
function triggerRunAll(): void {
  SchedulerEngine.runAll();
}
