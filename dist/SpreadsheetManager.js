"use strict";
/**
 * SpreadsheetManager.ts + TableDetector.ts + ColumnDetector.ts
 * Auto-detects the active spreadsheet, scans all sheets,
 * identifies independent tables, and fuzzy-maps column types.
 */
// ─── Column Detector ─────────────────────────────────────────────────────────
const COLUMN_PATTERNS = {
    email: [/^email/i, /^(to|recipient|e.?mail|mail)/i],
    cc: [/^cc$/i, /^carbon.copy/i],
    bcc: [/^bcc$/i, /^blind.copy/i],
    name: [/^(full.?name|name|contact|person|customer)/i],
    subject: [/^subject/i, /^(title|heading)/i],
    status: [/^status/i, /^(state|stage|phase)/i],
    date: [/^(date|due.?date|send.?date|schedule.?date|deadline|dob)/i],
    attachment: [/^attach/i, /^(file|document|doc)/i],
    driveLink: [/^(drive|gdrive|link|url)/i, /docs\.google\.com/i],
    invoice: [/^(invoice|inv.?no|bill.?no|order.?id|reference)/i],
};
function detectColumnType(header) {
    for (const [type, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (patterns.some(p => p.test(header.trim())))
            return type;
    }
    return 'custom';
}
// ─── Table Detector ───────────────────────────────────────────────────────────
function detectTables(sheet, tabName) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1)
        return [];
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const tables = [];
    let r = 0;
    while (r < data.length) {
        // Skip blank rows
        if (data[r].every((cell) => cell === '' || cell === null || cell === undefined)) {
            r++;
            continue;
        }
        // Potential header row: find non-empty cells
        const headerRow = data[r];
        const nonEmpty = headerRow.map((c, i) => ({ val: String(c).trim(), i })).filter((x) => x.val !== '');
        if (nonEmpty.length === 0) {
            r++;
            continue;
        }
        const startCol = nonEmpty[0].i;
        const endCol = nonEmpty[nonEmpty.length - 1].i;
        const headers = headerRow.slice(startCol, endCol + 1).map((h) => String(h).trim()).filter((h) => h !== '');
        if (headers.length < 2) {
            r++;
            continue;
        } // Need at least 2 columns to be a table
        // Count data rows until next blank or EOF
        const startRow = r;
        r++;
        while (r < data.length) {
            const row = data[r].slice(startCol, endCol + 1);
            if (row.every((c) => c === '' || c === null))
                break;
            r++;
        }
        const endRow = r - 1;
        const rowCount = endRow - startRow;
        if (rowCount < 1)
            continue; // Header-only, no data
        const columnMap = {};
        headers.forEach((h) => { columnMap[h] = detectColumnType(h); });
        tables.push({
            tabName,
            startRow: startRow + 1, // 1-indexed
            startCol: startCol + 1,
            endRow: endRow + 1,
            endCol: endCol + 1,
            headers,
            rowCount,
            columnMap,
        });
    }
    return tables;
}
// ─── Spreadsheet Manager ─────────────────────────────────────────────────────
const SpreadsheetManager = (() => {
    function scan() {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss)
            throw new Error('No active spreadsheet found.');
        const sheets = ss.getSheets();
        const tabs = sheets.map((sheet, index) => {
            const name = sheet.getName();
            const tables = detectTables(sheet, name);
            return {
                name,
                index,
                rowCount: sheet.getLastRow(),
                colCount: sheet.getLastColumn(),
                tables,
            };
        });
        return {
            id: ss.getId(),
            name: ss.getName(),
            tabs,
        };
    }
    function getTableData(tabName, startRow, limit = 500) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(tabName);
        if (!sheet)
            return [];
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < startRow)
            return [];
        const rows = Math.min(limit, lastRow - startRow);
        if (rows < 1)
            return [];
        const data = sheet.getRange(startRow, 1, rows + 1, lastCol).getValues();
        const headers = data[0].map((h) => String(h).trim());
        return data.slice(1).map((row) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
        });
    }
    function getTableImageBlob(tabName, startRow) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(tabName);
        if (!sheet)
            return null;
        const lastRow = sheet.getLastRow();
        const lastCol = sheet.getLastColumn();
        if (lastRow < startRow)
            return null;
        // Find the end of the table by looking for the first blank row
        const data = sheet.getRange(startRow, 1, lastRow - startRow + 1, lastCol).getValues();
        let endRowOffset = 0;
        while (endRowOffset < data.length) {
            if (data[endRowOffset].every(c => c === '' || c === null))
                break;
            endRowOffset++;
        }
        if (endRowOffset === 0)
            return null;
        const range = sheet.getRange(startRow, 1, endRowOffset, lastCol);
        try {
            const chart = sheet.newChart()
                .setChartType(Charts.ChartType.TABLE)
                .addRange(range)
                .setOption('useFirstColumnAsDomain', true)
                .setOption('showRowNumber', false)
                .build();
            return chart.getAs('image/png').setName(`${tabName}_table.png`);
        }
        catch (e) {
            Logger.log('Failed to generate table image blob: ' + e.message);
            return null;
        }
    }
    return { scan, getTableData, getTableImageBlob };
})();
