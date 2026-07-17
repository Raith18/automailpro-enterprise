"use strict";
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
    function readJson(key) {
        try {
            const raw = getProps().getProperty(key);
            return raw ? JSON.parse(raw) : [];
        }
        catch {
            return [];
        }
    }
    function writeJson(key, data) {
        getProps().setProperty(key, JSON.stringify(data));
    }
    // Schedulers
    function getSchedulers() { return readJson(KEYS.SCHEDULERS); }
    function saveScheduler(scheduler) {
        const list = getSchedulers();
        const isNew = !scheduler.id;
        if (isNew)
            scheduler.id = Utilities.getUuid();
        const idx = list.findIndex((s) => s.id === scheduler.id);
        if (idx >= 0)
            list[idx] = scheduler;
        else
            list.push(scheduler);
        writeJson(KEYS.SCHEDULERS, list);
        return scheduler.id;
    }
    function deleteScheduler(id) {
        writeJson(KEYS.SCHEDULERS, getSchedulers().filter((s) => s.id !== id));
    }
    // Templates
    function getTemplates() { return readJson(KEYS.TEMPLATES); }
    function saveTemplate(template) {
        const list = getTemplates();
        const isNew = !template.id;
        if (isNew)
            template.id = Utilities.getUuid();
        const idx = list.findIndex((t) => t.id === template.id);
        if (idx >= 0)
            list[idx] = template;
        else
            list.push(template);
        writeJson(KEYS.TEMPLATES, list);
        return template.id;
    }
    function deleteTemplate(id) {
        writeJson(KEYS.TEMPLATES, getTemplates().filter((t) => t.id !== id));
    }
    // Logs
    function getLogs(limit = 200, offset = 0) {
        const all = readJson(KEYS.LOGS);
        return all.slice(offset, offset + limit);
    }
    function appendLog(entry) {
        const all = readJson(KEYS.LOGS);
        all.unshift({ ...entry, id: Utilities.getUuid() });
        // Keep only last 2000 entries to manage storage quota
        writeJson(KEYS.LOGS, all.slice(0, 2000));
    }
    function clearLogs() { writeJson(KEYS.LOGS, []); }
    // Settings
    function getSettings() { return readJson(KEYS.SETTINGS)[0] ?? {}; }
    function saveSettings(settings) { writeJson(KEYS.SETTINGS, [settings]); }
    return { getSchedulers, saveScheduler, deleteScheduler, getTemplates, saveTemplate, deleteTemplate, getLogs, appendLog, clearLogs, getSettings, saveSettings };
})();
