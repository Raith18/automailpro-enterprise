/**
 * Utils.gs
 * -----------------------------------------------------------------------
 * Stateless, dependency-free helper functions shared across every module.
 * Rule for this file: no function here should read/write Config or Logs.
 * If a helper needs configuration, pass it in as a parameter instead of
 * calling ConfigService from inside here — keeps this file unit-testable
 * in isolation.
 * -----------------------------------------------------------------------
 */

const Utils = (() => {

  /**
   * Generates a short, sortable unique ID.
   * Format: SMS-<timestamp36>-<random4>
   * @return {string}
   */
  function generateId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SMS-${ts}-${rand}`;
  }

  /**
   * Validates an email address using a pragmatic RFC-5322-lite regex.
   * @param {string} email
   * @return {boolean}
   */
  function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  }

  /**
   * Combines a Sheet "Schedule Date" (Date object or string) and
   * "Schedule Time" (Date object or "HH:mm" string) into one Date.
   * Sheets stores time-only cells as a Date on 1899-12-30, so we must
   * extract just the H/M/S component.
   * @param {Date|string} dateVal
   * @param {Date|string} timeVal
   * @return {Date}
   */
  function combineDateAndTime(dateVal, timeVal) {
    const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    let hours = 0, minutes = 0, seconds = 0;

    if (timeVal instanceof Date) {
      hours = timeVal.getHours();
      minutes = timeVal.getMinutes();
      seconds = timeVal.getSeconds();
    } else if (typeof timeVal === 'string' && timeVal.includes(':')) {
      const parts = timeVal.split(':').map(Number);
      hours = parts[0] || 0;
      minutes = parts[1] || 0;
      seconds = parts[2] || 0;
    }

    const combined = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes, seconds);
    return combined;
  }

  /**
   * Checks whether `now` falls within [startTime, endTime] on the same day,
   * where startTime/endTime are "HH:mm" strings (24h).
   * @param {Date} now
   * @param {string} startTime e.g. "09:00"
   * @param {string} endTime e.g. "18:00"
   * @return {boolean}
   */
  function isWithinWorkingHours(now, startTime, endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em, 0);
    return now >= start && now <= end;
  }

  /**
   * Formats a Date as "yyyy-MM-dd" using the script's timezone.
   * @param {Date} date
   * @return {string}
   */
  function formatDate(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  /**
   * Formats a Date as "yyyy-MM-dd HH:mm:ss".
   * @param {Date} date
   * @return {string}
   */
  function formatDateTime(date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }

  /**
   * Safely gets a sheet by name, throwing a descriptive error instead of
   * a null-reference crash if it's missing. Every service should call
   * this instead of getSheetByName directly.
   * @param {string} sheetName
   * @return {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function getSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`Required sheet "${sheetName}" was not found. ` +
        `Run SetupService.initializeWorkbook() to create it.`);
    }
    return sheet;
  }

  /**
   * Converts a sheet's full data range into an array of row objects keyed
   * by header name. Skips fully-empty rows.
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @return {Array<Object>}
   */
  function sheetToObjects(sheet) {
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data[0].map(h => String(h).trim());
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const isEmpty = row.every(cell => cell === '' || cell === null);
      if (isEmpty) continue;
      const obj = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      obj.__row = i + 1; // 1-indexed sheet row, for writing back
      rows.push(obj);
    }
    return rows;
  }

  /**
   * Simple exponential backoff delay calculator (in milliseconds).
   * @param {number} attempt 1-indexed retry attempt number
   * @param {number} baseMs base delay, default 60000 (1 min)
   * @return {number}
   */
  function getBackoffDelay(attempt, baseMs = 60000) {
    return baseMs * Math.pow(2, Math.max(0, attempt - 1));
  }

  /**
   * Escapes HTML special characters — used when injecting user-controlled
   * strings (names, custom fields) into HTML email templates to prevent
   * broken markup.
   * @param {string} str
   * @return {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    generateId,
    isValidEmail,
    combineDateAndTime,
    isWithinWorkingHours,
    formatDate,
    formatDateTime,
    getSheet,
    sheetToObjects,
    getBackoffDelay,
    escapeHtml
  };

})();
