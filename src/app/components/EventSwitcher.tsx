import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Plus, Pencil, X } from 'lucide-react';
import { EventInfo, createEventRequest, updateEventRequest, switchActiveEventRequest } from '../lib/db';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';

// Curated Indian-festival/puja emoji set — a static picker, not a general
// emoji library, per the plan.
const EVENT_EMOJIS = ['🪔', '🕉️', '🙏', '🎉', '🌸', '💥', '🐘', '🎆', '⛩️', '🔱', '🌺', '🪘'];

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
    <div ref={containerRef} className="relative shrink-0 px-3 pb-3">
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

      {open && isAdmin && createPortal(
        <EventPopover
          anchorRef={anchorRef}
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
        />,
        document.body
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
  anchorRef, events, activeEventId, mode, editingEvent, currentUserId,
  onClose, onRowClick, onEditClick, onCreateClick, onBackToList, onCreated, onUpdated,
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
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
}) {
  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: rect.left,
    bottom: window.innerHeight - rect.top + 8,
    width: Math.max(rect.width, 280),
  };

  return (
    <div style={style} className="z-[100] bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden" onClick={e => e.stopPropagation()}>
      {mode === 'list' && (
        <>
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
        </>
      )}

      {(mode === 'create' || mode === 'edit') && (
        <EventForm
          existing={editingEvent}
          currentUserId={currentUserId}
          onCancel={mode === 'create' ? onClose : onBackToList}
          onSaved={mode === 'create' ? onCreated : onUpdated}
        />
      )}
    </div>
  );
}

function EventForm({
  existing, currentUserId, onCancel, onSaved,
}: {
  existing: EventInfo | null;
  currentUserId: string;
  onCancel: () => void;
  onSaved: (event: EventInfo) => void;
}) {
  const [name, setName] = useState(existing?.name || '');
  const [year, setYear] = useState(String(existing?.year || new Date().getFullYear()));
  const [emoji, setEmoji] = useState<string | null>(existing?.emoji ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !year.trim()) {
      setError('Name and year are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = existing
        ? await updateEventRequest(existing.id, name.trim(), Number(year), emoji)
        : await createEventRequest(name.trim(), Number(year), emoji, currentUserId);
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
          {existing ? 'Edit Puja / Festival' : 'Puja / Festival to Manage CRM'}
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
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Year *</label>
          <input
            value={year}
            onChange={e => setYear(e.target.value.replace(/\D/g, ''))}
            placeholder="2026"
            maxLength={4}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:border-orange-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Emoji (optional)</label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {EVENT_EMOJIS.map(e => (
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
          </div>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex gap-2 mt-3.5">
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
    </div>
  );
}
