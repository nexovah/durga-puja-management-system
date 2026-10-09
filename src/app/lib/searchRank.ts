// Shared "smart" ranking for every type-ahead picker search in the app
// (Pick a member/donor/vendor/advertiser, Collected By, etc) — a plain
// .filter(name.includes(query)) leaves results in whatever order the
// underlying list happens to be in, so typing "ap" can show "Asmita
// Sarkar C/O Pradip Bhakta" above an actual "Apple"-prefixed name. This
// ranks matches so the most relevant ones surface first:
//   0. name starts with the typed query (best match)
//   1. some word within the name starts with the query
//   2. query appears anywhere else in the name
//   3. query matches the start of a secondary field (unit/phone/etc)
//   4. query appears anywhere in a secondary field
// Ties within the same rank are broken alphabetically by name.
export function rankSearchMatches<T>(
  items: T[],
  query: string,
  nameOf: (item: T) => string,
  extraOf?: (item: T) => (string | null | undefined)[],
  limit = 8
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: { item: T; score: number; name: string }[] = [];
  for (const item of items) {
    const name = nameOf(item) || '';
    const nameLower = name.toLowerCase();
    let score: number | null = null;

    if (nameLower.startsWith(q)) {
      score = 0;
    } else if (nameLower.split(/\s+/).some(word => word.startsWith(q))) {
      score = 1;
    } else if (nameLower.includes(q)) {
      score = 2;
    } else if (extraOf) {
      const extras = extraOf(item).filter((e): e is string => !!e).map(e => e.toLowerCase());
      if (extras.some(e => e.startsWith(q))) score = 3;
      else if (extras.some(e => e.includes(q))) score = 4;
    }

    if (score !== null) scored.push({ item, score, name });
  }

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map(s => s.item);
}
