/**
 * Normalise Eastern Arabic-Indic digits (٠-٩) and Persian/Extended digits (۰-۹)
 * to Western digits (0-9), and decimal comma (٫) to period (.).
 */
export function normalizeArabicIndicDigits(str: string): string {
  return str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, '');
}

/**
 * Robust RFC-4180 compliant CSV parser.
 * Supports quoted fields, commas inside quotes, escaped quotes (""),
 * newlines inside quotes, blank cells, and Arabic characters.
 */
export function parseCSV(text: string): string[][] {
  const normalized = normalizeArabicIndicDigits(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];

    if (c === '"') {
      if (insideQuotes && normalized[i + 1] === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (c === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((c === '\r' || c === '\n') && !insideQuotes) {
      if (c === '\r' && normalized[i + 1] === '\n') {
        i++; // skip \n of \r\n
      }
      currentRow.push(currentCell.trim());
      // Only push non-empty rows
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += c;
    }
  }

  // Final cell and row if file didn't end with a newline
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export interface ParsedCSV {
  headers: string[];
  records: Record<string, string>[];
}

/**
 * Parses CSV text, returning both the lowercase trimmed headers and the mapped records.
 */
export function parseCSVWithHeaders(text: string): ParsedCSV {
  const rows = parseCSV(text);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      record[header] = row[j] !== undefined ? row[j] : '';
    }
    records.push(record);
  }

  return { headers, records };
}

/**
 * Parses CSV text and maps rows to records using the first row as headers.
 */
export function parseCSVToRecords(text: string): Record<string, string>[] {
  return parseCSVWithHeaders(text).records;
}
