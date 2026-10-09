import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, MoreVertical, Pencil, Trash2, FileText, CheckCircle2, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import {
  EventInfo, Award, Chanda, DonationAd, Expense, Loan, Member,
  fetchEventChanda, fetchEventDonationAds, fetchEventExpenses, fetchEventLoans, fetchEventMembers, fetchEventAwards,
  markEventCompleteRequest, markEventReportPublishedRequest, deleteEventRequest, setEventActiveRequest, setCurrentEventRequest,
} from '../lib/db';
import { computeCashBankTotals } from '../lib/cashBank';
import { EventForm, formatFinancialYear, sortEventsNewestFirst } from './EventSwitcher';
import { FestivalReportView } from './FestivalReportView';
import { FestivalDetailView } from './FestivalDetailView';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { SuperAdminConfirmModal } from './SuperAdminConfirmModal';
import { TYPEABLE_SELECTOR } from '../lib/useAutoFocusFirstField';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, emptyTableSearchFilters } from './TableSearchBar';
import { useLanguage } from '../i18n/LanguageContext';

interface ManageFestivalsPageProps {
  events: EventInfo[];
  // The signed-in user's OWN current-festival selection (not the admin-
  // managed active set — see event.isActive for that, which any number of
  // festivals can have true at once).
  currentEventId: string | null;
  isAdmin: boolean;
  currentUserId: string;
  companyName: string;
  companyLogo: string;
  onEventCreated: (event: EventInfo) => void;
  onEventUpdated: (event: EventInfo) => void;
  onCurrentEventChanged: (eventId: string) => void;
}

interface FestivalData {
  chandaList: Chanda[];
  donationAdsList: DonationAd[];
  expenses: Expense[];
  loansList: Loan[];
  members: Member[];
  awardsList: Award[];
}

// Per-event financial data, fetched once on mount for every festival via
// the cross-event RPCs (not limited to the active event like normal RLS) —
// event counts are small per tenant, so eager-fetch-all is simpler than an
// IntersectionObserver-deferred load.
function useFestivalData(events: EventInfo[]) {
  const [dataByEvent, setDataByEvent] = useState<Record<string, FestivalData>>({});

  useEffect(() => {
    let cancelled = false;
    events.forEach(async (event) => {
      if (dataByEvent[event.id]) return;
      try {
        const [chandaList, donationAdsList, expenses, loansList, members, awardsList] = await Promise.all([
          fetchEventChanda(event.id),
          fetchEventDonationAds(event.id),
          fetchEventExpenses(event.id),
          fetchEventLoans(event.id),
          fetchEventMembers(event.id),
          fetchEventAwards(event.id),
        ]);
        if (cancelled) return;
        setDataByEvent(prev => ({ ...prev, [event.id]: { chandaList, donationAdsList, expenses, loansList, members, awardsList } }));
      } catch (err) {
        console.error(`Failed to load festival data for ${event.id}`, err);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  return dataByEvent;
}

export function ManageFestivalsPage({
  events, currentEventId, isAdmin, currentUserId, companyName, companyLogo,
  onEventCreated, onEventUpdated, onCurrentEventChanged,
}: ManageFestivalsPageProps) {
  const { t } = useLanguage();
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [localEvents, setLocalEvents] = useState(events);
  const [showForm, setShowForm] = useState(false);
  const eventFormRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showForm) return;
    const timer = setTimeout(() => {
      eventFormRef.current?.querySelector<HTMLElement>(TYPEABLE_SELECTOR)?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [showForm]);
  const [editingEvent, setEditingEvent] = useState<EventInfo | null>(null);
  const [reportEvent, setReportEvent] = useState<EventInfo | null>(null);
  const [viewingEvent, setViewingEvent] = useState<EventInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventInfo | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<EventInfo | null>(null);
  const [cardMenu, setCardMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalEvents(events); }, [events]);

  const dataByEvent = useFestivalData(localEvents);

  useEffect(() => {
    if (!cardMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (cardMenuRef.current?.contains(target)) return;
      if (target.closest('[data-card-menu-trigger]')) return;
      setCardMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cardMenu]);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(localEvents.map(e => e.year))).sort((a, b) => b - a);
    return [{ value: '', label: t('festivals.allYears') }, ...years.map(y => ({ value: String(y), label: formatFinancialYear(y) }))];
  }, [localEvents, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = sortEventsNewestFirst(localEvents).filter(e =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!yearFilter || String(e.year) === yearFilter)
    );
    // Active festivals always sort first (current selection first among
    // those), inactive ones keep their newest-first order after.
    const actives = matched.filter(e => e.isActive);
    const inactives = matched.filter(e => !e.isActive);
    actives.sort((a, b) => (a.id === currentEventId ? -1 : b.id === currentEventId ? 1 : 0));
    return [...actives, ...inactives];
  }, [localEvents, query, yearFilter, currentEventId]);

  const openCreate = () => { setEditingEvent(null); setShowForm(true); };
  const openEdit = (event: EventInfo) => { setEditingEvent(event); setShowForm(true); setCardMenu(null); };

  const handleMarkComplete = async (event: EventInfo) => {
    setCardMenu(null);
    try {
      await markEventCompleteRequest(event.id, !event.isComplete);
      const updated = { ...event, isComplete: !event.isComplete };
      setLocalEvents(prev => prev.map(e => (e.id === event.id ? updated : e)));
      onEventUpdated(updated);
    } catch (err) {
      console.error('Failed to update festival status', err);
    }
  };

  const handlePublishReport = async (event: EventInfo) => {
    await markEventReportPublishedRequest(event.id);
    const updated = { ...event, reportPublished: true, reportPublishedAt: new Date().toISOString() };
    setLocalEvents(prev => prev.map(e => (e.id === event.id ? updated : e)));
    onEventUpdated(updated);
    setReportEvent(updated);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteEventRequest(deleteTarget.id);
      setLocalEvents(prev => prev.filter(e => e.id !== deleteTarget.id));
    } catch (err: any) {
      console.error('Failed to delete festival', err);
      alert(err?.message || 'Could not delete this festival. Please try again.');
    } finally {
      setDeleteTarget(null);
    }
  };

  // Activating a festival (adding it to the tenant's active set): instant,
  // no confirmation — low-stakes, purely additive (it just becomes
  // selectable; nobody's current view changes because of it).
  const handleActivate = async (event: EventInfo) => {
    setCardMenu(null);
    try {
      await setEventActiveRequest(event.id, true);
      const updated = { ...event, isActive: true };
      setLocalEvents(prev => prev.map(e => (e.id === event.id ? updated : e)));
      onEventUpdated(updated);
    } catch (err: any) {
      console.error('Failed to activate festival', err);
      alert(err?.message || 'Could not activate this festival. Please try again.');
    }
  };

  // Deactivating always confirms (12-char) — unlike activating, this can
  // silently cut off whoever currently has it selected as their own
  // current festival, tenant-wide impact.
  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await setEventActiveRequest(deactivateTarget.id, false);
      const updated = { ...deactivateTarget, isActive: false };
      setLocalEvents(prev => prev.map(e => (e.id === deactivateTarget.id ? updated : e)));
      onEventUpdated(updated);
    } catch (err: any) {
      console.error('Failed to deactivate festival', err);
      alert(err?.message || 'Could not deactivate this festival. Please try again.');
    } finally {
      setDeactivateTarget(null);
    }
  };

  // Switching YOUR OWN view to an already-active festival — personal,
  // instant, no confirmation (same as the topbar EventSwitcher dropdown).
  const handleSwitchMyView = async (event: EventInfo) => {
    setCardMenu(null);
    try {
      await setCurrentEventRequest(event.id);
      onCurrentEventChanged(event.id);
    } catch (err) {
      console.error('Failed to switch festival', err);
      alert('Could not switch to that festival. Please try again.');
    }
  };

  // Self-contained read-only screen — fully replaces this page's body while
  // active (no sidebar/nav interaction), per the confirmed "one screen,
  // exit back to Manage Festivals" design. Never touches the active-event
  // mechanism in any way.
  if (viewingEvent) {
    const data = dataByEvent[viewingEvent.id];
    if (!data) {
      return (
        <div className="space-y-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      );
    }
    return (
      <FestivalDetailView
        event={viewingEvent}
        chandaList={data.chandaList}
        donationAdsList={data.donationAdsList}
        expenses={data.expenses}
        awardsList={data.awardsList}
        loansList={data.loansList}
        members={data.members}
        onBack={() => setViewingEvent(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <CustomSelect value={yearFilter} onChange={setYearFilter} options={yearOptions} className="min-w-[9rem]" />
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {isAdmin && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} /> {t('festivals.addFestival')}
              </button>
            )}
          </div>
        }
      >
        {t('festivals.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('festivals.hint')}</p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={query}
          onQueryChange={setQuery}
          placeholder={t('festivals.searchPlaceholder')}
          filters={emptyTableSearchFilters}
          onFiltersChange={() => {}}
          onSearch={() => {}}
          onClear={() => setQuery('')}
          filtersActive={false}
          resultCount={filtered.length}
          totalCount={localEvents.length}
        />
      </CollapsibleSearchPanel>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-sm">{t('festivals.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(event => {
            const active = event.isActive;
            const viewing = event.id === currentEventId;
            const data = dataByEvent[event.id];
            const totals = data
              ? computeCashBankTotals({ event, chandaList: data.chandaList, donationAdsList: data.donationAdsList, members: data.members, loansList: data.loansList, expenses: data.expenses, awardsList: data.awardsList })
              : null;
            const totalRaised = totals ? totals.sources.filter(s => ['collection', 'donation', 'sponsorship', 'awardPrizeMoney'].includes(s.key)).reduce((s, r) => s + r.cash + r.bank, 0) : 0;
            const totalSpent = totals ? totals.sources.find(s => s.key === 'expenses') : undefined;
            const spent = totalSpent ? totalSpent.cash + totalSpent.bank : 0;

            return (
              <div
                key={event.id}
                className={`rounded-xl p-4 transition-all ${
                  active
                    ? 'border-2 border-green-400 dark:border-green-500/60 ring-4 ring-green-100 dark:ring-green-500/10 shadow-lg shadow-green-500/10 bg-gradient-to-br from-green-50/60 dark:from-green-500/5 to-white dark:to-gray-900'
                    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 text-xl">
                    {event.emoji || '🪔'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate">{event.name}</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{formatFinancialYear(event.year)}</p>
                  </div>
                  {isAdmin && (
                    <div className="relative shrink-0">
                      <button
                        data-card-menu-trigger
                        onClick={(e) => {
                          if (cardMenu?.id === event.id) { setCardMenu(null); return; }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setCardMenu({ id: event.id, top: rect.bottom + 4, left: Math.max(8, rect.right - 192) });
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {cardMenu?.id === event.id && createPortal(
                        <div ref={cardMenuRef} style={{ position: 'fixed', top: cardMenu.top, left: cardMenu.left }} className="w-48 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                          {active ? (
                            <button onClick={() => { setCardMenu(null); setDeactivateTarget(event); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400" /> {t('festivals.setInactive')}
                            </button>
                          ) : (
                            <button onClick={() => handleActivate(event)} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <span className="w-3.5 h-3.5 rounded-full bg-green-500" /> {t('festivals.setActive')}
                            </button>
                          )}
                          {active && !viewing && (
                            <button onClick={() => handleSwitchMyView(event)} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                              <CheckCircle2 size={14} className="text-gray-400" /> {t('festivals.switchToThis')}
                            </button>
                          )}
                          <button onClick={() => { setCardMenu(null); setViewingEvent(event); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Eye size={14} className="text-gray-400" /> {t('festivals.viewFestival')}
                          </button>
                          <button onClick={() => { setCardMenu(null); setReportEvent(event); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <FileText size={14} className="text-gray-400" /> {t('festivals.publishReport')}
                          </button>
                          <button onClick={() => handleMarkComplete(event)} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <CheckCircle2 size={14} className="text-gray-400" /> {event.isComplete ? t('festivals.markIncomplete') : t('festivals.markComplete')}
                          </button>
                          <button onClick={() => openEdit(event)} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                            <Pencil size={14} className="text-gray-500" /> {t('common.edit')}
                          </button>
                          <button
                            onClick={() => { setCardMenu(null); if (!active) setDeleteTarget(event); }}
                            disabled={active}
                            title={active ? t('festivals.cannotDeleteActive') : undefined}
                            className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                          >
                            <Trash2 size={14} /> {t('common.delete')}
                          </button>
                        </div>,
                        document.body
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  {active ? (
                    <span
                      role={!viewing ? 'button' : undefined}
                      onClick={() => !viewing && handleSwitchMyView(event)}
                      title={!viewing ? t('festivals.switchToThis') : undefined}
                      className={`flex items-center gap-1 text-[10.5px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-[7px] py-[3px] rounded-full ${!viewing ? 'cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/50' : ''}`}
                    >
                      <span className="relative flex w-[7px] h-[7px]">
                        <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex w-[7px] h-[7px] rounded-full bg-green-500" />
                      </span>
                      {t('festivals.status.ongoing')}
                    </span>
                  ) : event.isComplete ? (
                    <span className="text-[10.5px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-[7px] py-[3px] rounded-full">
                      {t('festivals.status.closed')}
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-[7px] py-[3px] rounded-full">
                      {t('festivals.status.upcoming')}
                    </span>
                  )}
                  {viewing && (
                    <span className="text-[10.5px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-[7px] py-[3px] rounded-full">
                      {t('festivals.viewing')}
                    </span>
                  )}
                  {event.reportPublished && (
                    <span className="flex items-center gap-1 text-[10.5px] font-semibold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-[7px] py-[3px] rounded-full">
                      <FileText size={10} /> {t('festivals.reportPublished')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center justify-center gap-1">
                      <TrendingUp size={12} /> {data ? `₹${totalRaised.toLocaleString()}` : '…'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('festivals.raised')}</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center justify-center gap-1">
                      <TrendingDown size={12} /> {data ? `₹${spent.toLocaleString()}` : '…'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('festivals.spent')}</p>
                  </div>
                </div>

                {totals && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {t('festivals.balance')}: <span className={`font-semibold ${totals.totalBalance >= 0 ? 'text-gray-700 dark:text-gray-300' : 'text-red-600'}`}>₹{totals.totalBalance.toLocaleString()}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div ref={eventFormRef} className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <EventForm
              existing={editingEvent}
              otherEvents={localEvents.filter(e => e.id !== editingEvent?.id)}
              currentUserId={currentUserId}
              onCancel={() => { setShowForm(false); setEditingEvent(null); }}
              onSaved={(event) => {
                if (editingEvent) {
                  onEventUpdated(event);
                  setLocalEvents(prev => prev.map(e => (e.id === event.id ? event : e)));
                } else {
                  onEventCreated(event);
                  setLocalEvents(prev => [...prev, event]);
                }
                setShowForm(false);
                setEditingEvent(null);
              }}
              onSwitched={onCurrentEventChanged}
            />
          </div>
        </div>
      )}

      {reportEvent && dataByEvent[reportEvent.id] && (
        <FestivalReportView
          event={reportEvent}
          companyName={companyName}
          companyLogo={companyLogo}
          chandaList={dataByEvent[reportEvent.id].chandaList}
          donationAdsList={dataByEvent[reportEvent.id].donationAdsList}
          expenses={dataByEvent[reportEvent.id].expenses}
          awardsList={dataByEvent[reportEvent.id].awardsList}
          loansList={dataByEvent[reportEvent.id].loansList}
          members={dataByEvent[reportEvent.id].members}
          onClose={() => setReportEvent(null)}
          onPublish={() => handlePublishReport(reportEvent)}
        />
      )}

      <SuperAdminConfirmModal
        open={!!deleteTarget}
        title={t('festivals.deleteConfirmTitle')}
        message={t('festivals.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        danger
        codeLength={12}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      <SuperAdminConfirmModal
        open={!!deactivateTarget}
        title={t('festivals.deactivateConfirmTitle')}
        message={t('festivals.deactivateConfirmMessage')}
        confirmLabel={t('festivals.setInactive')}
        danger
        codeLength={12}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={handleConfirmDeactivate}
      />
    </div>
  );
}
