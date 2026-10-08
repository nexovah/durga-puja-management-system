import { useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, Pencil, X, MoreHorizontal } from 'lucide-react';
import {
  EventInfo, createEventRequest, updateEventRequest, switchActiveEventRequest,
  fetchEventChanda, fetchEventDonationAds, fetchEventMembers, fetchEventLoans, fetchEventExpenses,
  copyMembersToActiveEvent, copyChandaDonorsToActiveEvent, copyAdsDonorsToActiveEvent,
} from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';
import { CustomSelect } from './CustomSelect';
import { RequiredMark } from './RequiredMark';
import { EventManageModal } from './EventManageModal';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

export function formatFinancialYear(year: number | string): string {
  const y = typeof year === 'string' ? parseInt(year, 10) : year;
  if (!y || isNaN(y)) return String(year || '');
  return `FY ${y}-${y + 1}`;
}

// Newest festival first — by financial year descending, then by creation
// time as a tiebreaker for events sharing the same year.
export function sortEventsNewestFirst(events: EventInfo[]): EventInfo[] {
  return [...events].sort((a, b) =>
    b.year - a.year || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// Curated Indian-festival/puja emoji set — a static picker, not a general
// emoji library, per the plan. Kept to 11 + a "more" tile so the grid
// stays at exactly 2 rows; MORE_EVENT_EMOJIS holds the expanded set shown
// in the secondary picker popover.
const EVENT_EMOJIS = ['🪔', '🕉️', '🙏', '🎉', '🌸', '💥', '🐘', '🎆', '⛩️', '🔱', '🌺'];
const MORE_EVENT_EMOJIS = [
  '🪘', '🛕', '🚩', '🔔', '📿', '🪷', '🦚', '🐚', '🎊', '🎇', '🌼', '🎭',
  '🍬', '🎈', '🥻', '🌟', '✨', '🎋', '🪬', '🎐', '🪈', '🌙', '🧿', '🪯',
];

interface EventSwitcherProps {
  events: EventInfo[];
  activeEventId: string | null;
  isAdmin: boolean;
  collapsed: boolean;
  currentUserId: string;
  onEventCreated: (event: EventInfo) => void;
  onEventUpdated: (event: EventInfo) => void;
  onEventSwitched: (eventId: string) => void;
  // 'sidebar' (default): bordered box trigger, full-width, chevron only.
  // 'topbar': plain text trigger (no border/bg), always-visible Live pill
  // beside the name, used when this component is rendered in the top bar
  // instead of the sidebar.
  variant?: 'sidebar' | 'topbar';
}

// Small animated-dot "Live" pill — shared between the sidebar dropdown's
// per-row indicator and the topbar trigger's always-visible indicator.
function LivePill() {
  return (
    <span className="flex items-center gap-1 text-[10.5px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-[7px] py-[3px] rounded-full shrink-0">
      <span className="relative flex w-[7px] h-[7px]">
        <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex w-[7px] h-[7px] rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}

export function EventSwitcher({
  events, activeEventId, isAdmin, collapsed, currentUserId,
  onEventCreated, onEventUpdated, onEventSwitched, variant = 'sidebar',
}: EventSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const activeEvent = events.find(e => e.id === activeEventId) || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeAll = () => { setOpen(false); setManageOpen(false); };

  const handleRowClick = (event: EventInfo) => {
    if (event.id === activeEventId) { closeAll(); return; }
    setPendingSwitchId(event.id);
  };

  const handleConfirmSwitch = async () => {
    if (!pendingSwitchId) return;
    try {
      await switchActiveEventRequest(pendingSwitchId);
      onEventSwitched(pendingSwitchId);
    } catch (err) {
      console.error('Failed to switch event', err);
      alert('Could not switch the event. Please try again.');
    } finally {
      setPendingSwitchId(null);
      closeAll();
    }
  };

  if (variant === 'topbar') {
    return (
      <div ref={containerRef} className="relative shrink-0">
        <button
          ref={anchorRef}
          onClick={() => isAdmin && setOpen(o => !o)}
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="text-base leading-none shrink-0">{activeEvent?.emoji || '🪔'}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[12rem]">
            {activeEvent ? `${activeEvent.name} — ${formatFinancialYear(activeEvent.year)}` : 'No active Puja'}
          </span>
          {activeEvent && <LivePill />}
          {isAdmin && <ChevronsUpDown size={15} className="text-gray-400 dark:text-gray-500 shrink-0" />}
        </button>

        {open && isAdmin && (
          <EventPopover
            events={events}
            activeEventId={activeEventId}
            onRowClick={handleRowClick}
            onManageClick={() => { setOpen(false); setManageOpen(true); }}
            align="left-0"
          />
        )}

        {manageOpen && isAdmin && (
          <EventManageModal
            events={events}
            activeEventId={activeEventId}
            currentUserId={currentUserId}
            onClose={() => setManageOpen(false)}
            onRowClick={handleRowClick}
            onCreated={onEventCreated}
            onUpdated={onEventUpdated}
            onSwitched={onEventSwitched}
          />
        )}

        <SuperAdminConfirmModal
          open={pendingSwitchId !== null}
          title="Switch 'Puja, Festival or Event'?"
          message="Every user in this tenant will immediately move to this event — all data they view and add from now on will belong to it. This cannot be undone by simply switching back and forth without care."
          confirmLabel="Switch Everyone"
          danger
          codeLength={12}
          onCancel={() => setPendingSwitchId(null)}
          onConfirm={handleConfirmSwitch}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0 px-3">
      <button
        ref={anchorRef}
        onClick={() => isAdmin && setOpen(o => !o)}
        className={`w-full flex items-center gap-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors ${
          collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
        } ${isAdmin ? 'hover:border-orange-300 dark:hover:border-orange-500/40 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="w-7 h-7 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-base shrink-0">
          {activeEvent?.emoji || '🪔'}
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 text-left flex-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                {activeEvent ? `${activeEvent.name} — ${formatFinancialYear(activeEvent.year)}` : 'No active Puja'}
              </p>
            </div>
            {isAdmin && <ChevronsUpDown size={16} className="text-gray-400 dark:text-gray-500 shrink-0" />}
          </>
        )}
      </button>

      {open && isAdmin && (
        <EventPopover
          events={events}
          activeEventId={activeEventId}
          onRowClick={handleRowClick}
          onManageClick={() => { setOpen(false); setManageOpen(true); }}
        />
      )}

      {manageOpen && isAdmin && (
        <EventManageModal
          events={events}
          activeEventId={activeEventId}
          currentUserId={currentUserId}
          onClose={() => setManageOpen(false)}
          onRowClick={handleRowClick}
          onCreated={onEventCreated}
          onUpdated={onEventUpdated}
          onSwitched={onEventSwitched}
        />
      )}

      <SuperAdminConfirmModal
        open={pendingSwitchId !== null}
        title="Switch 'Puja, Festival or Event'?"
        message="Every user in this tenant will immediately move to this event — all data they view and add from now on will belong to it. This cannot be undone by simply switching back and forth without care."
        confirmLabel="Switch Everyone"
        danger
        codeLength={12}
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={handleConfirmSwitch}
      />
    </div>
  );
}

// Dropdown is a quick shortlist, not the full roster — only the 6 newest
// festivals, plus the active one if it'd otherwise fall outside that top 6
// (e.g. an older event was reactivated). Everything else lives in the
// "Manage" modal.
const DROPDOWN_LIMIT = 6;
function shortlistEvents(events: EventInfo[], activeEventId: string | null): EventInfo[] {
  const sorted = sortEventsNewestFirst(events);
  const top = sorted.slice(0, DROPDOWN_LIMIT);
  if (activeEventId && !top.some(e => e.id === activeEventId)) {
    const active = sorted.find(e => e.id === activeEventId);
    if (active) return [...top.slice(0, DROPDOWN_LIMIT - 1), active];
  }
  return top;
}

function EventPopover({
  events, activeEventId, onRowClick, onEditClick, onManageClick, align = 'left-3',
}: {
  events: EventInfo[];
  activeEventId: string | null;
  onRowClick: (event: EventInfo) => void;
  onManageClick: () => void;
  align?: string;
}) {
  const shortlist = shortlistEvents(events, activeEventId);
  return (
    <div className={`absolute top-full ${align} mt-2 w-[346px] z-[100] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700`} onClick={e => e.stopPropagation()}>
      <div className="rounded-xl overflow-hidden">
          <div className="py-1.5">
            {shortlist.map(event => {
              const active = event.id === activeEventId;
              return (
                <div
                  key={event.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 transition-colors group ${
                    active ? 'bg-orange-50/70 dark:bg-orange-500/10' : 'hover:bg-orange-50 dark:hover:bg-orange-500/10'
                  }`}
                >
                  <button onClick={() => onRowClick(event)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <span className="w-6 h-6 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-sm shrink-0">
                      {event.emoji || '🪔'}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {event.name} — {formatFinancialYear(event.year)}
                    </span>
                  </button>
                  {active && <LivePill />}
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800" />
          <button
            onClick={onManageClick}
            className="w-full py-2.5 text-sm font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-center"
          >
            Manage 'Puja, Festival or Event'
          </button>
        </div>
    </div>
  );
}

export function EventForm({
  existing, otherEvents, currentUserId, onCancel, onSaved, onSwitched, compact = false,
}: {
  existing: EventInfo | null;
  otherEvents: EventInfo[];
  currentUserId: string;
  onCancel: () => void;
  onSaved: (event: EventInfo) => void;
  onSwitched: (eventId: string) => void;
  // true inside the tight 346px quick-switcher popover; false (default) for
  // the full-size "Manage" modal, which matches the app's standard
  // add/edit-form sizing (FormModal-style: bigger title, px-4 py-2 inputs,
  // px-6 py-3 buttons) instead of the popover's compact text-xs/px-3 one.
  compact?: boolean;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [year, setYear] = useState(existing?.year || currentYear);
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji ?? null);
  const [openingCash, setOpeningCash] = useState(existing ? String(existing.openingCash) : '0');
  const [openingBank, setOpeningBank] = useState(existing ? String(existing.openingBank) : '0');

  // Year and the opening Cash/Bank balance are locked once an event
  // already exists — editing them after transactions may have already
  // accrued is sensitive (a wrong change risks money recorded against the
  // wrong year/balance), so both require a strong confirm-code unlock,
  // same as switching the active event. Brand-new events (still being
  // created) are never locked — nothing to protect yet.
  const [yearLocked, setYearLocked] = useState(!!existing);
  const [cashBankLocked, setCashBankLocked] = useState(!!existing);
  const [unlockTarget, setUnlockTarget] = useState<'year' | 'cashBank' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // "Connect with a previous Puja/Festival" — create-mode only. Carries
  // forward that event's closing Cash/Bank balance as this one's opening
  // balance, and optionally bulk-copies its members/donor identities.
  const [connectEventId, setConnectEventId] = useState('');
  const [copyMembers, setCopyMembers] = useState(false);
  const [copyDonors, setCopyDonors] = useState(false);
  const [loadingConnect, setLoadingConnect] = useState(false);

  const handleConnectChange = async (eventId: string) => {
    setConnectEventId(eventId);
    setCopyMembers(false);
    setCopyDonors(false);
    if (!eventId) return;
    const source = otherEvents.find(e => e.id === eventId);
    if (!source) return;
    setLoadingConnect(true);
    setError('');
    try {
      const [chandaList, donationAdsList, members, loansList, expenses] = await Promise.all([
        fetchEventChanda(eventId),
        fetchEventDonationAds(eventId),
        fetchEventMembers(eventId),
        fetchEventLoans(eventId),
        fetchEventExpenses(eventId),
      ]);
      const totals = computeCashBankTotals({ event: source, chandaList, donationAdsList, members, loansList, expenses });
      setOpeningCash(String(totals.closingCash));
      setOpeningBank(String(totals.closingBank));
    } catch (err: any) {
      console.error('Failed to load previous event balance', err);
      setError('Could not load that event\'s balance — please enter it manually.');
    } finally {
      setLoadingConnect(false);
    }
  };

  // When a "more" emoji is picked, pin it to the front of the visible row
  // so the selection is obvious without needing to reopen the more popover.
  const displayEmojis = emoji && !EVENT_EMOJIS.includes(emoji)
    ? [emoji, ...EVENT_EMOJIS.slice(0, EVENT_EMOJIS.length - 1)]
    : EVENT_EMOJIS;

  useEffect(() => {
    if (!moreOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const cash = parseFloat(openingCash) || 0;
      const bank = parseFloat(openingBank) || 0;
      const saved = existing
        ? await updateEventRequest(existing.id, name.trim(), year, emoji, cash, bank)
        : await createEventRequest(name.trim(), year, emoji, currentUserId, cash, bank);

      if (!existing && connectEventId && (copyMembers || copyDonors)) {
        // Bulk copy inserts must land with event_id = this new event, which
        // only happens once it's the active event (RLS scopes every insert
        // to current_event_id()) — switch to it first.
        await switchActiveEventRequest(saved.id);
        onSwitched(saved.id);
        if (copyMembers) {
          const members = await fetchEventMembers(connectEventId);
          await copyMembersToActiveEvent(members);
        }
        if (copyDonors) {
          const [chandaList, donationAdsList] = await Promise.all([
            fetchEventChanda(connectEventId),
            fetchEventDonationAds(connectEventId),
          ]);
          await copyChandaDonorsToActiveEvent(chandaList);
          await copyAdsDonorsToActiveEvent(donationAdsList);
        }
      }

      onSaved(saved);
    } catch (err: any) {
      console.error('Failed to save event', err);
      setError(err?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Two sizing tiers sharing one layout: `compact` for the tight 346px
  // quick-switcher popover (unchanged), full-size (default) matching the
  // app's standard add/edit-form conventions (ChandaCollection etc. — see
  // durga-crm-ui-design-system skill) for the "Manage" modal.
  const labelCls = compact ? 'text-xs font-medium text-gray-500 dark:text-gray-400' : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';
  const inputCls = compact
    ? 'w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500'
    : 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none';

  return (
    <div className={compact ? 'p-3.5' : 'p-4 sm:p-6'}>
      <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
        <p className={compact ? 'text-sm font-bold text-gray-800 dark:text-gray-200' : 'text-lg sm:text-xl font-bold text-gray-800 dark:text-gray-200'}>
          {existing ? "Edit 'Puja, Festival or Event'" : "Add 'Puja, Festival or Event'"}
        </p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={compact ? 16 : 24} />
        </button>
      </div>

      <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
        <div>
          <label className={labelCls}>Name<RequiredMark /></label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Durga Puja"
            className={inputCls}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Financial Year<RequiredMark /></label>
            {yearLocked && (
              <button
                type="button"
                onClick={() => setUnlockTarget('year')}
                className="text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                aria-label="Unlock financial year"
              >
                <Pencil size={compact ? 13 : 15} />
              </button>
            )}
          </div>
          <CustomSelect
            value={String(year)}
            disabled={yearLocked}
            onChange={v => setYear(Number(v))}
            options={YEAR_OPTIONS.map(y => ({ value: String(y), label: formatFinancialYear(y) }))}
            className={compact ? 'mt-1' : 'mt-2'}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Opening Balance</label>
            {cashBankLocked && (
              <button
                type="button"
                onClick={() => setUnlockTarget('cashBank')}
                className="text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                aria-label="Unlock opening balance"
              >
                <Pencil size={compact ? 13 : 15} />
              </button>
            )}
          </div>
          <div className={`grid grid-cols-2 gap-2.5 ${compact ? 'mt-1' : 'mt-2'}`}>
            <div>
              <label className={compact ? 'text-[11px] text-gray-400 dark:text-gray-500' : 'text-xs text-gray-500 dark:text-gray-400'}>Cash in Hand (₹)</label>
              <input
                type="number"
                min="0"
                disabled={cashBankLocked}
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className={`w-full mt-1 ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-2'} border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  cashBankLocked
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100'
                }`}
              />
            </div>
            <div>
              <label className={compact ? 'text-[11px] text-gray-400 dark:text-gray-500' : 'text-xs text-gray-500 dark:text-gray-400'}>Money in Bank (₹)</label>
              <input
                type="number"
                min="0"
                disabled={cashBankLocked}
                value={openingBank}
                onChange={e => setOpeningBank(e.target.value)}
                className={`w-full mt-1 ${compact ? 'px-3 py-2 text-sm' : 'px-4 py-2'} border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  cashBankLocked
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100'
                }`}
              />
            </div>
          </div>
        </div>
        <div className="relative" ref={moreRef}>
          <label className={labelCls}>Emoji (optional)</label>
          <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-1.5' : 'mt-2'}`}>
            {displayEmojis.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(emoji === e ? null : e)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border transition-colors ${
                  emoji === e ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                }`}
              >
                {e}
              </button>
            ))}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(o => !o)}
                aria-label="More emojis"
                className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                  moreOpen || (emoji && MORE_EVENT_EMOJIS.includes(emoji))
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                    : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 text-gray-500 dark:text-gray-400'
                }`}
              >
                <MoreHorizontal size={16} />
              </button>

              {moreOpen && (
                <div className="absolute left-0 bottom-full mb-1.5 w-64 max-h-48 overflow-y-auto z-[200] origin-bottom-left animate-in fade-in zoom-in-90 duration-150 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2.5 grid grid-cols-6 gap-1.5">
                  {MORE_EVENT_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => { setEmoji(emoji === e ? null : e); setMoreOpen(false); }}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border transition-colors ${
                        emoji === e ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {!existing && otherEvents.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-2.5">
            <label className={labelCls}>Connect with a previous 'Puja, Festival or Event'? (optional)</label>
            <CustomSelect
              value={connectEventId}
              disabled={loadingConnect}
              onChange={v => handleConnectChange(v)}
              options={[
                { value: '', label: 'No, start fresh' },
                ...otherEvents.map(e => ({ value: e.id, label: `${e.name} — ${formatFinancialYear(e.year)}` })),
              ]}
              className={compact ? 'mt-1' : 'mt-2'}
            />
            {connectEventId && (
              <div className="mt-2 space-y-1.5">
                {loadingConnect && <p className="text-xs text-gray-400 dark:text-gray-500">Loading balance…</p>}
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={copyMembers} onChange={e => setCopyMembers(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500" />
                  Copy committee members from this event
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={copyDonors} onChange={e => setCopyDonors(e.target.checked)} className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500" />
                  Copy Collection &amp; Sponsorship donor list from this event
                </label>
              </div>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className={`border-t border-gray-100 dark:border-gray-800 flex gap-3 ${compact ? 'mt-3.5 pt-3.5' : 'mt-5 pt-5'}`}>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex-1 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors ${compact ? 'px-3 py-2 text-sm' : 'px-6 py-3 text-sm sm:text-base'}`}
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          className={`bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${compact ? 'px-3 py-2 text-sm' : 'px-6 py-3 text-sm sm:text-base'}`}
        >
          Cancel
        </button>
      </div>

      <SuperAdminConfirmModal
        open={unlockTarget !== null}
        title={unlockTarget === 'year' ? 'Change the Financial Year?' : 'Change the Opening Balance?'}
        message={
          unlockTarget === 'year'
            ? 'This event\'s financial year is locked after creation to avoid an accidental mistake. Confirm to unlock it for editing.'
            : 'The opening Cash in Hand / Money in Bank is locked after being set, since transactions may already be recorded against it. Confirm to unlock both fields for editing.'
        }
        confirmLabel="Unlock"
        danger={false}
        codeLength={12}
        onCancel={() => setUnlockTarget(null)}
        onConfirm={() => {
          if (unlockTarget === 'year') setYearLocked(false);
          if (unlockTarget === 'cashBank') setCashBankLocked(false);
          setUnlockTarget(null);
        }}
      />
    </div>
  );
}
