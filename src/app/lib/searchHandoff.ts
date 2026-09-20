// Hands off an Advanced Search result set from GlobalSearch to the target
// page's own table: GlobalSearch stashes the matching record IDs in
// sessionStorage (survives the navigation, cleared on tab close — this is
// a live CRM, so we never want a stale filter silently surviving into a
// new session), then the page reads them on mount and narrows its table to
// just those rows, with a banner + "Clear filter" to show everything again.

const KEY_PREFIX = 'puja-search-result-ids:';

export type SearchTargetModule = 'members' | 'chanda' | 'donationAds' | 'expenses';

export function stashSearchResultIds(module: SearchTargetModule, ids: string[]) {
  try {
    sessionStorage.setItem(KEY_PREFIX + module, JSON.stringify(ids));
  } catch {
    // sessionStorage unavailable (private mode etc.) — fail silently, page just shows everything
  }
}

export function readSearchResultIds(module: SearchTargetModule): string[] | null {
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + module);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSearchResultIds(module: SearchTargetModule) {
  try {
    sessionStorage.removeItem(KEY_PREFIX + module);
  } catch {
    // ignore
  }
}
