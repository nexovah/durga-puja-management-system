import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { X, Phone, MessageCircle, Star, Wallet, BarChart3 } from 'lucide-react';
import { Donor, EventInfo, fetchEventChanda } from '../lib/db';
import { Chanda, getChandaCreditAmount } from '../App';
import { STATUS_BADGE_CLASS } from './ChandaCollection';
import { donorFullName, DONOR_CATEGORIES } from './Donors';
import { formatFinancialYear } from './EventSwitcher';
import { DONUT_COLORS } from './DashboardDonut';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';

interface DonorDetailModalProps {
  donor: Donor;
  events: EventInfo[];
  onClose: () => void;
  onAddCollection: (donorId: string) => void;
}

// Chanda rows carry no event_id field client-side (event scoping is
// entirely via RLS/current_event_id()) — fetchEventChanda(eventId) tells
// us which event a batch came from by which call returned it, so we tag
// each row with that event id ourselves while merging.
type TaggedChanda = Chanda & { _eventId: string };

// Donor profile modal — contact/WhatsApp/total stats, a per-festival
// contribution bar chart, and the donor's full Collection history across
// EVERY festival/event ever created (not just the active one), fetched via
// fetchEventChanda per event (same cross-event RPC the "connect with a
// previous Puja" feature already uses). Markup follows the Vendors.tsx/
// Advertisers.tsx "view details" modal convention already established
// elsewhere in the app — plain card header, no background color block.
export function DonorDetailModal({ donor, events, onClose, onAddCollection }: DonorDetailModalProps) {
  const { t, locale } = useLanguage();
  const { theme } = useTheme();
  const [crossEventRecords, setCrossEventRecords] = useState<TaggedChanda[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCrossEventRecords(null);
    Promise.all(events.map(e =>
      fetchEventChanda(e.id)
        .then(rows => rows.map(c => ({ ...c, _eventId: e.id })))
        .catch(() => [] as TaggedChanda[]),
    )).then(lists => {
      if (cancelled) return;
      setCrossEventRecords(lists.flat());
    });
    return () => { cancelled = true; };
  }, [donor.id, events]);

  const loading = crossEventRecords === null;

  const records = useMemo(() => {
    return (crossEventRecords || [])
      .filter(c => c.donorId === donor.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [crossEventRecords, donor.id]);

  const totalContributed = useMemo(
    () => records.reduce((sum, c) => sum + getChandaCreditAmount(c), 0),
    [records],
  );

  const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

  const chartData = useMemo(() => {
    const byEvent = new Map<string, number>();
    for (const c of records) {
      if (!c._eventId) continue;
      byEvent.set(c._eventId, (byEvent.get(c._eventId) || 0) + getChandaCreditAmount(c));
    }
    return events
      .filter(e => byEvent.has(e.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e, i) => ({
        key: e.id,
        label: `${e.name} ${formatFinancialYear(e.year)}`,
        value: byEvent.get(e.id) || 0,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      }));
  }, [records, events]);

  const axisStroke = theme === 'dark' ? '#3d434b' : '#e5e7eb';
  const axisTick = theme === 'dark' ? '#9aa1ae' : '#6b7280';
  const tooltipStyle = theme === 'dark'
    ? { borderRadius: 8, border: '1px solid #3d434b', fontSize: 13, background: '#1c1f24', color: '#e5e7eb' }
    : { borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 };

  const categoryLabel = DONOR_CATEGORIES.find(c => c.value === donor.category)?.label || donor.category;

  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-base shrink-0">
              {(donor.firstName?.charAt(0) || '').toUpperCase()}{(donor.lastName?.charAt(0) || '').toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 truncate">{donorFullName(donor)}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {donor.unitNo && <span className="text-sm text-gray-500 dark:text-gray-400">{donor.unitNo}</span>}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${donor.type === 'owner' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {donor.type === 'owner' ? t('donors.owner') : t('donors.tenant')}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">{categoryLabel}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><Phone size={12} /> {t('donors.contact')}</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">{donor.phone || '-'}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><MessageCircle size={12} /> {t('donors.whatsapp')}</p>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">{donor.whatsapp || '-'}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><Star size={12} /> {t('donors.memberRating')}</p>
              <p className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-1">{t('donors.notRatedYet')}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1"><Wallet size={12} /> {t('donors.totalContributed')}</p>
              <p className="text-sm font-bold text-green-600 mt-1">₹{totalContributed.toLocaleString()}</p>
            </div>
          </div>

          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-orange-600" /> {t('donors.contributionPerFestival')}
          </h4>
          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">{t('common.loading')}</p>
          ) : chartData.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">{t('donors.noContributions')}</p>
          ) : (
            <div className="h-48 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisTick }} tickLine={false} axisLine={{ stroke: axisStroke }} interval={0} />
                  <YAxis
                    tick={{ fontSize: 11, fill: axisTick }}
                    tickFormatter={(v) => `₹${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip formatter={(value: number) => [`₹${value.toLocaleString()}`, '']} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map(entry => <Cell key={entry.key} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-3">
            {t('donors.contributionHistory')} · {records.length}
          </h4>
          <div className="space-y-3">
            {records.map(c => {
              const event = eventById.get(c._eventId);
              return (
                <div key={c.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate">
                        {event ? `${event.name} ${formatFinancialYear(event.year)}` : '-'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {c.billNumber ? `#${c.billNumber} · ` : ''}{c.date ? new Date(c.date).toLocaleDateString(locale) : '-'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_BADGE_CLASS[c.paymentStatus]}`}>
                        {t(`chanda.status.${c.paymentStatus}` as any) || c.paymentStatus}
                      </span>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">₹{c.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && records.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">{t('donors.noContributions')}</p>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {t('common.close')}
          </button>
          <button onClick={() => onAddCollection(donor.id)} className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors">
            {t('chanda.addNew')}
          </button>
        </div>
      </div>
    </div>
  );
}
