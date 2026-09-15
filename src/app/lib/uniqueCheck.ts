// Shared duplicate-detection for unique fields (Bill/Voucher numbers): used
// both by Add/Edit form validation and by the CSV Import Preview modal.
// Case-insensitive, trims whitespace, and treats a blank value as "no
// check" since these fields are optional.

export const normalizeKey = (v?: string | null) => (v || '').trim().toLowerCase();

export interface DedupeError {
  line: number; // 1-based row number within the imported rows (not the raw CSV line, which may include a header)
  reason: string;
}

// Splits `rows` into the ones safe to import and the ones rejected because
// their key (e.g. bill number) either already exists in `existingKeys` or
// repeats an earlier row in the same file. Rows with a blank key always pass.
export function splitByDuplicateKey<T>(
  rows: T[],
  getKey: (row: T) => string | undefined,
  existingKeys: Set<string>,
  dbMessage: string,
  fileMessage: string
): { validRows: T[]; errors: DedupeError[] } {
  const seenInFile = new Set<string>();
  const validRows: T[] = [];
  const errors: DedupeError[] = [];

  rows.forEach((row, index) => {
    const key = normalizeKey(getKey(row));
    if (!key) {
      validRows.push(row);
      return;
    }
    if (existingKeys.has(key)) {
      errors.push({ line: index + 1, reason: dbMessage });
      return;
    }
    if (seenInFile.has(key)) {
      errors.push({ line: index + 1, reason: fileMessage });
      return;
    }
    seenInFile.add(key);
    validRows.push(row);
  });

  return { validRows, errors };
}
