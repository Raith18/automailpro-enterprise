/**
 * AttachmentService.gs
 * -----------------------------------------------------------------------
 * Resolves the "Attachment File ID" column (one ID, or comma-separated
 * IDs) into Blob objects GmailApp.sendEmail can attach. Isolated from
 * MailService so all DriveApp access — and its failure modes — lives in
 * one place.
 * -----------------------------------------------------------------------
 */

const AttachmentService = (() => {

  const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // Gmail's practical attachment ceiling

  /**
   * Resolves a raw "Attachment File ID" cell value into an array of Blobs.
   * Accepts empty/blank (returns []), a single ID, or comma-separated IDs.
   * Special case: "PDF:TemplateName" renders the template dynamically as PDF.
   * @param {string} rawFileIds
   * @param {Object} [data] placeholder data for dynamic PDF templates
   * @return {{blobs: Array<GoogleAppsScript.Base.Blob>, errors: Array<string>}}
   */
  function resolve(rawFileIds, data = {}) {
    const blobs = [];
    const errors = [];

    if (!rawFileIds || String(rawFileIds).trim() === '') {
      return { blobs, errors };
    }

    const ids = String(rawFileIds).split(',').map(id => id.trim()).filter(Boolean);
    let totalBytes = 0;

    for (const id of ids) {
      try {
        let blob;
        if (id.startsWith('PDF:')) {
          const templateName = id.substring(4).trim();
          const rendered = TemplateService.render(templateName, data);
          blob = Utilities.newBlob(rendered.html, 'text/html').getAs('application/pdf');
          blob.setName(templateName + '.pdf');
        } else {
          const file = DriveApp.getFileById(id);
          blob = file.getBlob();
        }
        
        totalBytes += blob.getBytes().length;

        if (totalBytes > MAX_TOTAL_BYTES) {
          errors.push(`Attachment "${blob.getName()}" (${id}) skipped — total attachments exceed 25MB limit.`);
          continue;
        }
        blobs.push(blob);
      } catch (e) {
        errors.push(`Could not access file/template ID "${id}": ${e.message}`);
      }
    }

    return { blobs, errors };
  }

  /**
   * Quick existence/permission check without downloading full blob content
   * — used by ValidationService before a send is even queued, so a bad
   * File ID surfaces at scheduling time, not send time.
   * @param {string} fileId
   * @return {boolean}
   */
  function isAccessible(fileId) {
    if (fileId.startsWith('PDF:')) {
      const templateName = fileId.substring(4).trim();
      return TemplateService.listActiveTemplateNames().includes(templateName);
    }
    try {
      DriveApp.getFileById(fileId).getName();
      return true;
    } catch (e) {
      return false;
    }
  }

  return { resolve, isAccessible, MAX_TOTAL_BYTES };

})();
