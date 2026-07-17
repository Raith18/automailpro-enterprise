/**
 * StorageManager.ts
 * Uses PropertiesService to store all scheduler & template config as JSON.
 * Acts as a lightweight serverless database within Apps Script quotas.
 */

const KEYS = {
  SCHEDULERS: 'ams_schedulers',
  TEMPLATES: 'ams_templates',
  SETTINGS: 'ams_settings',
  LOGS: 'ams_logs',
};

const AppStorageManager = (() => {
  function getProps() {
    return PropertiesService.getDocumentProperties();
  }

  function readJson<T>(key: string): T[] {
    try {
      const raw = getProps().getProperty(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeJson<T>(key: string, data: T[]): void {
    getProps().setProperty(key, JSON.stringify(data));
  }

  // Schedulers
  function getSchedulers(): any[] { return readJson(KEYS.SCHEDULERS); }
  function saveScheduler(scheduler: any): string {
    const list = getSchedulers();
    const isNew = !scheduler.id;
    if (isNew) scheduler.id = Utilities.getUuid();
    const idx = list.findIndex((s: any) => s.id === scheduler.id);
    if (idx >= 0) list[idx] = scheduler; else list.push(scheduler);
    writeJson(KEYS.SCHEDULERS, list);
    return scheduler.id;
  }
  function deleteScheduler(id: string): void {
    writeJson(KEYS.SCHEDULERS, getSchedulers().filter((s: any) => s.id !== id));
  }

  // Templates
  function getTemplates(): any[] { return readJson(KEYS.TEMPLATES); }
  function saveTemplate(template: any): string {
    const list = getTemplates();
    const isNew = !template.id;
    if (isNew) template.id = Utilities.getUuid();
    const idx = list.findIndex((t: any) => t.id === template.id);
    if (idx >= 0) list[idx] = template; else list.push(template);
    writeJson(KEYS.TEMPLATES, list);
    return template.id;
  }
  function deleteTemplate(id: string): void {
    writeJson(KEYS.TEMPLATES, getTemplates().filter((t: any) => t.id !== id));
  }

  // Logs
  function getLogs(limit = 200, offset = 0): any[] {
    const all = readJson<any>(KEYS.LOGS);
    return all.slice(offset, offset + limit);
  }
  function appendLog(entry: any): void {
    const all = readJson<any>(KEYS.LOGS);
    all.unshift({ ...entry, id: Utilities.getUuid() });
    // Keep only last 2000 entries to manage storage quota
    writeJson(KEYS.LOGS, all.slice(0, 2000));
  }
  function clearLogs(): void { writeJson(KEYS.LOGS, []); }

  // Settings
  function getSettings(): any { return readJson<any>(KEYS.SETTINGS)[0] ?? {}; }
  function saveSettings(settings: any): void { writeJson(KEYS.SETTINGS, [settings]); }

  return { getSchedulers, saveScheduler, deleteScheduler, getTemplates, saveTemplate, deleteTemplate, getLogs, appendLog, clearLogs, getSettings, saveSettings };
})();
