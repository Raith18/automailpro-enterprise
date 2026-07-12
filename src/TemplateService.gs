/**
 * TemplateService.gs
 * -----------------------------------------------------------------------
 * Resolves {{Placeholder}} tokens and {{#if Field}}...{{/if}} conditional
 * blocks against a data object, wraps the result with a shared branded
 * header/footer, and produces both HTML and plain-text versions.
 *
 * No external templating library — Apps Script has no npm at runtime, so
 * this is deliberately a small hand-rolled regex engine. Keep it that way
 * unless a genuine need for loops/partials arises.
 * -----------------------------------------------------------------------
 */

const TemplateService = (() => {

  const SHEET_NAME = 'Templates';

  // Matches {{#if FieldName}} ... {{/if}}  (non-greedy, single-level —
  // nested conditionals are intentionally unsupported to keep this simple).
  const CONDITIONAL_RE = /{{#if\s+([\w]+)\s*}}([\s\S]*?){{\/if}}/g;

  // Matches {{FieldName}}
  const PLACEHOLDER_RE = /{{\s*([\w]+)\s*}}/g;

  /**
   * Loads one template row by name. Throws if not found or inactive.
   * @param {string} templateName
   * @return {Object} { 'Template Name', 'Subject', 'HTML Template', 'Description', 'Active' }
   */
  function _loadTemplate(templateName) {
    const sheet = Utils.getSheet(SHEET_NAME);
    const rows = Utils.sheetToObjects(sheet);
    const match = rows.find(r => String(r['Template Name']).trim() === templateName.trim());

    if (!match) {
      throw new Error(`Template "${templateName}" was not found in the Templates sheet.`);
    }
    if (match['Active'] === false || String(match['Active']).toLowerCase() === 'false') {
      throw new Error(`Template "${templateName}" exists but is marked inactive.`);
    }
    return match;
  }

  /**
   * Resolves {{#if Field}}...{{/if}} blocks: keeps the inner content only
   * if data[Field] is truthy (non-empty string, non-zero, non-false).
   * @param {string} text
   * @param {Object} data
   * @return {string}
   */
  function _resolveConditionals(text, data) {
    return text.replace(CONDITIONAL_RE, (full, field, inner) => {
      const value = data[field];
      const isTruthy = value !== undefined && value !== null && value !== '' && value !== false;
      return isTruthy ? inner : '';
    });
  }

  /**
   * Replaces {{Field}} placeholders with values from data. Unmatched
   * placeholders are left as-is rather than silently blanked, so missing
   * data is visibly obvious instead of producing a broken-looking email.
   * HTML-escapes values to prevent broken markup from user data.
   * @param {string} text
   * @param {Object} data
   * @param {boolean} escape whether to HTML-escape values (true for HTML body, false for subject/plaintext)
   * @return {string}
   */
  function _resolvePlaceholders(text, data, escape) {
    return text.replace(PLACEHOLDER_RE, (full, field) => {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        return full; // leave {{Field}} visible — signals missing data
      }
      const value = String(data[field]);
      return escape ? Utils.escapeHtml(value) : value;
    });
  }

  /**
   * Strips HTML tags for a reasonable plain-text fallback. Not a full
   * HTML parser — good enough for template bodies authored as simple
   * paragraphs/lists, which covers the HR/admin use cases this targets.
   * @param {string} html
   * @return {string}
   */
  function _htmlToPlainText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Wraps a resolved HTML body with the shared branded header/footer.
   * Designed to render reasonably in dark mode: uses explicit background
   * colors rather than relying on transparency.
   * @param {string} bodyHtml
   * @return {string}
   */
  function _wrapWithBranding(bodyHtml) {
    const companyName = ConfigService.get('Company Name', 'Your Company');
    const signature = ConfigService.get('Default Signature', '');

    return `
<div style="font-family: Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f1f3f6; color: #212121; padding-bottom: 16px;">
  <div style="background-color: #2874f0; padding: 16px 24px; text-align: left;">
    <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-style: italic;">${Utils.escapeHtml(companyName)}</h2>
  </div>
  <div style="background-color: #ffffff; padding: 24px; margin: 16px; border-radius: 2px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.1); line-height: 1.6; font-size: 14px;">
    ${bodyHtml}
  </div>
  ${signature ? `<div style="padding: 0 24px 16px 24px; font-size: 13px; color: #5f6368; white-space: pre-line;">${Utils.escapeHtml(signature)}</div>` : ''}
  <div style="padding: 8px 24px; font-size: 11px; color: #878787; text-align: center;">
    Sent via Smart Mail Scheduler on behalf of ${Utils.escapeHtml(companyName)}
  </div>
</div>`.trim();
  }

  /**
   * Full render pipeline: load template -> resolve conditionals -> resolve
   * placeholders -> wrap with branding -> generate plain-text fallback.
   * @param {string} templateName
   * @param {Object} data key/value map, e.g. { Name, Department, EmployeeID, ... }
   * @return {{subject: string, html: string, plainText: string}}
   */
  function render(templateName, data) {
    const template = _loadTemplate(templateName);

    let subject = _resolvePlaceholders(String(template['Subject'] || ''), data, false);

    let body = String(template['HTML Template'] || '');
    body = _resolveConditionals(body, data);
    body = _resolvePlaceholders(body, data, true);

    const html = _wrapWithBranding(body);
    const plainText = _htmlToPlainText(html);

    return { subject, html, plainText };
  }

  /**
   * Lists active template names — used by Scheduler dropdown validation
   * and the future templates.html UI.
   * @return {Array<string>}
   */
  function listActiveTemplateNames() {
    const sheet = Utils.getSheet(SHEET_NAME);
    const rows = Utils.sheetToObjects(sheet);
    return rows
      .filter(r => r['Active'] === true || String(r['Active']).toLowerCase() === 'true')
      .map(r => r['Template Name']);
  }

  /**
   * Validates that every {{Placeholder}} in a template body has a
   * corresponding key in a sample data object — used before saving a new
   * template from the UI, to catch typos early.
   * @param {string} htmlTemplate
   * @param {Object} sampleData
   * @return {{valid: boolean, missing: Array<string>}}
   */
  function validatePlaceholders(htmlTemplate, sampleData) {
    const found = new Set();
    let m;
    const re = new RegExp(PLACEHOLDER_RE);
    while ((m = re.exec(htmlTemplate)) !== null) {
      found.add(m[1]);
    }
    const missing = Array.from(found).filter(f => !(f in sampleData));
    return { valid: missing.length === 0, missing };
  }

  /**
   * Lists ALL templates (active and inactive) as full row objects — used
   * by templates.html's management table, unlike listActiveTemplateNames
   * which is just names for the scheduler dropdown.
   * @return {Array<Object>}
   */
  function listAllTemplates() {
    const sheet = Utils.getSheet(SHEET_NAME);
    return Utils.sheetToObjects(sheet);
  }

  /**
   * Creates a new template or updates an existing one by name (name is
   * the unique key, matching how _loadTemplate looks templates up).
   * @param {Object} data { name, subject, htmlTemplate, description, active }
   * @return {{success: boolean, errors: Array<string>}}
   */
  function saveTemplate(data) {
    const errors = [];
    if (!data.name || !String(data.name).trim()) errors.push('Template name is required.');
    if (!data.subject || !String(data.subject).trim()) errors.push('Subject is required.');
    if (!data.htmlTemplate || !String(data.htmlTemplate).trim()) errors.push('HTML template body is required.');
    if (errors.length > 0) return { success: false, errors };

    const sheet = Utils.getSheet(SHEET_NAME);
    const values = sheet.getDataRange().getValues();
    let foundRow = -1;
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === data.name.trim()) { foundRow = i + 1; break; }
    }

    const rowValues = [data.name, data.subject, data.htmlTemplate, data.description || '', data.active !== false];
    if (foundRow > 0) {
      sheet.getRange(foundRow, 1, 1, 5).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    return { success: true, errors: [] };
  }

  /**
   * Deletes a template row by name. No-op (success:false) if not found,
   * rather than throwing, so the UI can show a clean message.
   * @param {string} name
   * @return {{success: boolean}}
   */
  function deleteTemplate(name) {
    const sheet = Utils.getSheet(SHEET_NAME);
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(name).trim()) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false };
  }

  return { render, listActiveTemplateNames, listAllTemplates, saveTemplate, deleteTemplate, validatePlaceholders };

})();

/** Global wrapper for templates.html. */
function getAllTemplates() {
  return TemplateService.listAllTemplates();
}

/** Global wrapper for templates.html's save form. */
function saveTemplateForm(data) {
  if (!AuthService.can('editTemplates')) throw new Error('Permission denied: requires editTemplates.');
  return TemplateService.saveTemplate(data);
}

/** Global wrapper for templates.html's delete button. */
function deleteTemplateByName(name) {
  if (!AuthService.can('editTemplates')) throw new Error('Permission denied: requires editTemplates.');
  return TemplateService.deleteTemplate(name);
}

/** Global wrapper for templates.html's live preview panel. */
function previewTemplateWithSampleData(name, sampleData) {
  return TemplateService.render(name, sampleData);
}
