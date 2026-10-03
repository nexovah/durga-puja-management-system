import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, X, MoreVertical, Pencil } from 'lucide-react';
import { EventInfo } from '../lib/db';
import { CustomSelect } from './CustomSelect';
import { EventForm, formatFinancialYear, sortEventsNewestFirst } from './EventSwitcher';

// How many rows show before the list scrolls — sized via ROW_HEIGHT so the
// container's max-height always matches exactly 8 rows, no partial row
// peeking over the edge, with the scrollbar itself hidden (.scrollbar-hide)
// since the row count already signals there's more to scroll to.
const VISIBLE_ROWS = 8;
const ROW_HEIGHT = 56;

interface EventManageModalProps {
  events: EventInfo[];
  activeEventId: string | null;
  currentUserId: string;
  // When set (dropdown's pencil icon was clicked), the modal opens
  // straight into edit mode for this event instead of the list — read
  // once at mount, since the modal itself unmounts/remounts each time
  // it's opened/closed.
  initialEditingEvent?: EventInfo | null;
  onClose: () => void;
  onRowClick: (event: EventInfo) => void;
  onCreated: (event: EventInfo) => void;
  onUpdated: (event: EventInfo) => void;
  onSwitched: (eventId: string) => void;
}

export function EventManageModal({
  events, activeEventId, currentUserId, initialEditingEvent = null, onClose, onRowClick, onCreated, onUpdated, onSwitched,
}: EventManageModalProps) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>(initialEditingEvent ? 'edit' : 'list');
  const [editingEvent, setEditingEvent] = useState<EventInfo | null>(initialEditingEvent);
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  // Row 3-dot menus render via a portal to document.body, not inline —
  // the list they live in scrolls (overflow-y-auto), and an absolutely
  // positioned dropdown nested inside a scrolling ancestor gets clipped by
  // it regardless of z-index (see durga-crm-ui-design-system skill). The
  // portal escapes that clip; position comes from the trigger button's own
  // getBoundingClientRect() at open time.
  const [rowMenu, setRowMenu] = useState<{ id: string; top: number; right: number } | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (rowMenuRef.current && rowMenuRef.current.contains(target)) return;
      if (target.closest('[data-row-menu-trigger]')) return;
      setRowMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [rowMenu]);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(events.map(e => e.year))).sort((a, b) => b - a);
    return [{ value: '', label: 'All years' }, ...years.map(y => ({ value: String(y), label: formatFinancialYear(y) }))];
  }, [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortEventsNewestFirst(events).filter(e =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!yearFilter || String(e.year) === yearFilter)
    );
  }, [events, query, yearFilter]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/*
        List mode scrolls internally (max-h-[90vh], body below handles its
        own overflow) so rounded corners stay intact. Create/edit mode gets
        no height cap or overflow here at all — EventForm's "more emoji"
        popover is absolutely positioned against an ancestor inside this
        card, and an overflow-auto/hidden ancestor clips an absolute child
        regardless of z-index (see durga-crm-ui-design-system skill's note
        on this exact class of bug) — so this card must stay unclipped
        whenever that popover can open.
      */}
      <div
        className={`bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg flex flex-col ${mode === 'list' ? 'max-h-[90vh]' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {mode === 'list' ? (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Manage 'Puja, Festival or Event'</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setEditingEvent(null); setMode('create'); }}
                  className="p-1.5 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                  aria-label="Create 'Puja, Festival or Event'"
                  title="Create 'Puja, Festival or Event'"
                >
                  <Plus size={20} />
                </button>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-6 py-4 shrink-0">
              <div className="relative min-w-0 flex-[3_1_0%]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search festivals…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <CustomSelect
                value={yearFilter}
                onChange={setYearFilter}
                options={yearOptions}
                className="min-w-0 flex-[2_1_0%]"
              />
            </div>

            <div
              className="overflow-y-auto scrollbar-hide px-3 pb-3"
              style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT }}
              onScroll={() => setRowMenu(null)}
            >
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">No festivals match.</p>
              ) : (
                filtered.map(event => {
                  const active = event.id === activeEventId;
                  return (
                    <div
                      key={event.id}
                      style={{ height: ROW_HEIGHT }}
                      className={`w-full flex items-center gap-3 px-3 rounded-lg transition-colors group ${
                        active ? 'bg-orange-50/70 dark:bg-orange-500/10' : 'hover:bg-orange-50 dark:hover:bg-orange-500/10'
                      }`}
                    >
                      <button onClick={() => onRowClick(event)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        <span className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-base shrink-0">
                          {event.emoji || '🪔'}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {event.name} — {formatFinancialYear(event.year)}
                        </span>
                      </button>
                      {active ? (
                        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-[7px] py-[3px] rounded-full shrink-0">
                          <span className="relative flex w-[7px] h-[7px]">
                            <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex w-[7px] h-[7px] rounded-full bg-green-500" />
                          </span>
                          Live
                        </span>
                      ) : (
                        <button
                          data-row-menu-trigger
                          onClick={(e) => {
                            if (rowMenu?.id === event.id) { setRowMenu(null); return; }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRowMenu({ id: event.id, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                          }}
                          className="opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-opacity shrink-0"
                          data-open={rowMenu?.id === event.id}
                          aria-label="Row actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {rowMenu && createPortal(
              <div
                ref={rowMenuRef}
                style={{ position: 'fixed', top: rowMenu.top, right: rowMenu.right }}
                className="w-32 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[200] overflow-hidden"
              >
                <button
                  onClick={() => {
                    const event = events.find(e => e.id === rowMenu.id);
                    if (event) { setEditingEvent(event); setMode('edit'); }
                    setRowMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Pencil size={14} /> Edit
                </button>
              </div>,
              document.body
            )}
          </>
        ) : (
          <EventForm
            existing={editingEvent}
            otherEvents={events.filter(e => e.id !== editingEvent?.id)}
            currentUserId={currentUserId}
            onCancel={() => setMode('list')}
            onSaved={(event) => {
              if (mode === 'create') onCreated(event); else onUpdated(event);
              setMode('list');
              setEditingEvent(null);
            }}
            onSwitched={onSwitched}
          />
        )}
      </div>
    </div>
  );
}
