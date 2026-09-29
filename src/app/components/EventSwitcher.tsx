import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, Pencil, X, MoreHorizontal } from 'lucide-react';
import {
  EventInfo, createEventRequest, updateEventRequest, switchActiveEventRequest,
  fetchEventChanda, fetchEventDonationAds, fetchEventMembers, fetchEventLoans, fetchEventExpenses,
  copyMembersToActiveEvent, copyChandaDonorsToActiveEvent, copyAdsDonorsToActiveEvent,
} from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - i);

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
}

export function EventSwitcher({
  events, activeEventId, isAdmin, collapsed, currentUserId,
  onEventCreated, onEventUpdated, onEventSwitched,
}: EventSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingEvent, setEditingEvent] = useState<EventInfo | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const activeEvent = events.find(e => e.id === activeEventId) || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMode('list');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeAll = () => { setOpen(false); setMode('list'); setEditingEvent(null); };

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
                {activeEvent ? `${activeEvent.name} ${activeEvent.year}` : 'No active Puja'}
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
          mode={mode}
          editingEvent={editingEvent}
          currentUserId={currentUserId}
          onClose={closeAll}
          onRowClick={handleRowClick}
          onEditClick={(e) => { setEditingEvent(e); setMode('edit'); }}
          onCreateClick={() => { setEditingEvent(null); setMode('create'); }}
          onBackToList={() => setMode('list')}
          onCreated={(event) => { onEventCreated(event); setMode('list'); }}
          onUpdated={(event) => { onEventUpdated(event); setMode('list'); setEditingEvent(null); }}
          onSwitched={onEventSwitched}
        />
      )}

      <SuperAdminConfirmModal
        open={pendingSwitchId !== null}
        title="Switch Puja / Festival?"
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

function EventPopover({
  events, activeEventId, mode, editingEvent, currentUserId,
  onClose, onRowClick, onEditClick, onCreateClick, onBackToList, onCreated, onUpdated, onSwitched,
}: {
  events: EventInfo[];
  activeEventId: string | null;
  mode: 'list' | 'create' | 'edit';
  editingEvent: EventInfo | null;
  currentUserId: string;
  onClose: () => void;
  onRowClick: (event: EventInfo) => void;
  onEditClick: (event: EventInfo) => void;
  onCreateClick: () => void;
  onBackToList: () => void;
  onCreated: (event: EventInfo) => void;
  onUpdated: (event: EventInfo) => void;
  onSwitched: (eventId: string) => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-2 w-72 z-[100] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
      {mode === 'list' && (
        <div className="rounded-xl overflow-hidden">
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {events.map(event => {
              const active = event.id === activeEventId;
              return (
                <div
                  key={event.id}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group"
                >
                  <button onClick={() => onRowClick(event)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                    <span className="w-6 h-6 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-sm shrink-0">
                      {event.emoji || '🪔'}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {event.name} {event.year}
                    </span>
                  </button>
                  <button
                    onClick={() => onEditClick(event)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-opacity shrink-0"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  {active && <Check size={16} className="text-orange-600 shrink-0" />}
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800" />
          <button
            onClick={onCreateClick}
            className="w-full flex items-start gap-2.5 px-3 py-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-left"
          >
            <div className="w-6 h-6 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center shrink-0 mt-0.5">
              <Plus size={14} className="text-gray-500 dark:text-gray-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Create Puja or Festival</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Collaborate with your entire committee to take full management under control.</p>
            </div>
          </button>
        </div>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <EventForm
          existing={editingEvent}
          otherEvents={events.filter(e => e.id !== editingEvent?.id)}
          currentUserId={currentUserId}
          onCancel={mode === 'create' ? onClose : onBackToList}
          onSaved={mode === 'create' ? onCreated : onUpdated}
          onSwitched={onSwitched}
        />
      )}
    </div>
  );
}

function EventForm({
  existing, otherEvents, currentUserId, onCancel, onSaved, onSwitched,
}: {
  existing: EventInfo | null;
  otherEvents: EventInfo[];
  currentUserId: string;
  onCancel: () => void;
  onSaved: (event: EventInfo) => void;
  onSwitched: (eventId: string) => void;
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

  return (
    <div className="p-3.5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
          {existing ? 'Edit Puja/Festival' : 'Add Puja/Festival'}
        </p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Durga Puja"
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Year *</label>
            {yearLocked && (
              <button
                type="button"
                onClick={() => setUnlockTarget('year')}
                className="text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                aria-label="Unlock year"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          <select
            value={year}
            disabled={yearLocked}
            onChange={e => setYear(Number(e.target.value))}
            className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg outline-none focus:border-orange-500 ${
              yearLocked
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100'
            }`}
          >
            {YEAR_OPTIONS.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Opening Balance</label>
            {cashBankLocked && (
              <button
                type="button"
                onClick={() => setUnlockTarget('cashBank')}
                className="text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                aria-label="Unlock opening balance"
              >
                <Pencil size={13} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-1">
            <div>
              <label className="text-[11px] text-gray-400 dark:text-gray-500">Cash in Hand (₹)</label>
              <input
                type="number"
                min="0"
                disabled={cashBankLocked}
                value={openingCash}
                onChange={e => setOpeningCash(e.target.value)}
                className={`w-full mt-0.5 px-3 py-2 text-sm border rounded-lg outline-none focus:border-orange-500 ${
                  cashBankLocked
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100'
                }`}
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-400 dark:text-gray-500">Money in Bank (₹)</label>
              <input
                type="number"
                min="0"
                disabled={cashBankLocked}
                value={openingBank}
                onChange={e => setOpeningBank(e.target.value)}
                className={`w-full mt-0.5 px-3 py-2 text-sm border rounded-lg outline-none focus:border-orange-500 ${
                  cashBankLocked
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:text-gray-100'
                }`}
              />
            </div>
          </div>
        </div>
        <div className="relative" ref={moreRef}>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Emoji (optional)</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
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
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Connect with a previous Puja/Festival? (optional)</label>
            <select
              value={connectEventId}
              onChange={e => handleConnectChange(e.target.value)}
              disabled={loadingConnect}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500 bg-white dark:bg-gray-900"
            >
              <option value="">No, start fresh</option>
              {otherEvents.map(e => (
                <option key={e.id} value={e.id}>{e.name} {e.year}</option>
              ))}
            </select>
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

      <div className="border-t border-gray-100 dark:border-gray-800 mt-3.5 pt-3.5 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
      </div>

      <SuperAdminConfirmModal
        open={unlockTarget !== null}
        title={unlockTarget === 'year' ? 'Change the Year?' : 'Change the Opening Balance?'}
        message={
          unlockTarget === 'year'
            ? 'This event\'s year is locked after creation to avoid an accidental mistake. Confirm to unlock it for editing.'
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
