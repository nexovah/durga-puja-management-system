// Shared CSV-import matching for unique fields (Bill/Voucher numbers): used
// by the Import Preview modal to decide, per row, whether it's a brand new
// record or an update to an existing one matched by that field — case-
// insensitive, trims whitespace, blank value never matches (the field is
// optional, so a blank bill/voucher number always inserts as new).

export const normalizeKey = (v?: string | null) => (v || '').trim().toLowerCase();

export interface DedupeError {
  line: number;
  reason: string;
}

// Splits freshly-parsed CSV rows into inserts (brand new records) and
// updates (an existing record whose unique key — e.g. Bill Number — this
// row matches; the row's own `id` is swapped for the matched record's id so
// the caller can merge it straight in). If the same key appears more than
// once within the file, the later row wins — earlier ones are folded in,
// not reported as errors, since it's a legitimate "this file corrects
// itself" case, not a mistake.
export function prepareImportUpsert<T extends { id: string }>(
  rows: T[],
  getKey: (row: T) => string | undefined,
  existingRows: T[]
): { toInsert: T[]; toUpdate: T[] } {
  const existingByKey = new Map<string, string>(); // normalized key -> existing row id
  for (const row of existingRows) {
    const key = normalizeKey(getKey(row));
    if (key) existingByKey.set(key, row.id);
  }

  const insertsByKey = new Map<string, T>();
  const updatesByKey = new Map<string, T>();
  const inserts: T[] = []; // rows with no key at all — always new, never deduped against each other

  for (const row of rows) {
    const key = normalizeKey(getKey(row));
    if (!key) {
      inserts.push(row);
      continue;
    }
    const existingId = existingByKey.get(key);
    if (existingId) {
      updatesByKey.set(key, { ...row, id: existingId });
      insertsByKey.delete(key); // a later row can still turn an earlier "new" row into an update
    } else {
      insertsByKey.set(key, row);
    }
  }

  return {
    toInsert: [...inserts, ...insertsByKey.values()],
    toUpdate: [...updatesByKey.values()],
  };
}
