/**
 * ConfigService.gs
 * -----------------------------------------------------------------------
 * Single source of truth for reading the "Configuration" sheet.
 * Caches values for the lifetime of one script execution (Apps Script
 * re-runs the whole file top-to-bottom on every trigger, so an in-memory
 * cache here is safe — it never goes stale mid-run, and never persists
 * across runs, which is exactly what we want since a human may edit
 * Configuration between runs).
 * -----------------------------------------------------------------------
 */

const ConfigService = (() => {

  const SHEET_NAME = 'Configuration';

  // Key -> default value. Anything missing from the sheet falls back here
  // so the app never crashes on a blank install.
  const DEFAULTS = {
    'Admin Email': '',
    'Batch Size': 20,
    'Retry Limit': 3,
    'Sender Name': 'Smart Mail Scheduler',
    'Company Name': 'Your Company',
    'Working Hours Start': '09:00',
    'Working Hours End': '18:00',
    'Time Zone': 'Asia/Kolkata',
    'Holiday Sheet Name': 'Holidays',
    'Default Signature': '',
    'Enable Preview': false,
    'Enable Notifications': true
  };

  let _cache = null;

  /**
   * Loads the Configuration sheet into memory as a key/value map.
   * Expects two columns: Key | Value. Silently ignores extra columns.
   * @return {Object}
   */
  function _load() {
    if (_cache) return _cache;

    const map = Object.assign({}, DEFAULTS);
    try {
      const sheet = Utils.getSheet(SHEET_NAME);
      const data = sheet.getDataRange().getValues();
      // Row 0 assumed header: ["Key", "Value"]
      for (let i = 1; i < data.length; i++) {
        const key = String(data[i][0]).trim();
        const value = data[i][1];
        if (key) map[key] = value;
      }
    } catch (e) {
      // If the sheet doesn't exist yet, fall back to defaults rather than
      // hard-crashing every module that touches config.
      Logger.log(`ConfigService: falling back to defaults — ${e.message}`);
    }

    _cache = map;
    return _cache;
  }

  /**
   * Gets a single config value by key.
   * @param {string} key
   * @param {*} [fallback] override if key is entirely unknown
   * @return {*}
   */
  function get(key, fallback) {
    const map = _load();
    if (key in map) return map[key];
    return fallback !== undefined ? fallback : null;
  }

  /**
   * Gets the entire config map (read-only copy).
   * @return {Object}
   */
  function getAll() {
    return Object.assign({}, _load());
  }

  /**
   * Writes a single key/value back to the Configuration sheet, creating
   * the row if it doesn't exist yet. Invalidates the in-memory cache.
   * @param {string} key
   * @param {*} value
   */
  function set(key, value) {
    const sheet = Utils.getSheet(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, value]);
    }
    _cache = null; // force reload next get()
  }

  /**
   * Forces the next get()/getAll() to re-read the sheet.
   * Call this after Settings UI writes multiple values at once.
   */
  function invalidate() {
    _cache = null;
  }

  return { get, getAll, set, invalidate };

})();

/** Global wrapper for settings.html — read all current config values. */
function getAllConfig() {
  return ConfigService.getAll();
}

/** Global wrapper for settings.html's Save button. */
function saveConfigUpdates(updates) {
  if (!AuthService.can('editSettings')) throw new Error('Permission denied: requires editSettings.');
  Object.keys(updates).forEach(key => ConfigService.set(key, updates[key]));
  ConfigService.invalidate();
  return { success: true };
}
