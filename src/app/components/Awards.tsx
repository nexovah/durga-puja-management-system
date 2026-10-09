import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Trophy, Medal, Award as AwardIcon, X, MoreVertical, Eye, EyeOff } from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { AutocompleteInput } from './AutocompleteInput';
import { Pagination, usePagination } from './Pagination';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import {
  Award, AwardInput, AwardRank, CommitteeMember, createAwardRequest, updateAwardRequest, deleteAwardRequest,
} from '../lib/db';
import { ActivityModule } from '../lib/db';
import { useAutoFocusFirstField } from '../lib/useAutoFocusFirstField';
import { PaidMethod } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface AwardsProps {
  awardsList: Award[];
  onAwardsChanged: (list: Award[]) => void;
  committeeMembers: CommitteeMember[];
  canEdit: boolean;
  canDelete: boolean;
  onLog: (action: 'create' | 'update' | 'delete', module: ActivityModule, summary: string, count?: number, changes?: any, recordLabel?: string) => void;
}

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const RANKS: { value: AwardRank; labelKey: TranslationKey; gradient: string; badge: string }[] = [
  { value: '1st', labelKey: 'awards.rank.first', gradient: 'from-yellow-400 to-amber-500', badge: '🥇' },
  { value: '2nd', labelKey: 'awards.rank.second', gradient: 'from-gray-300 to-gray-400', badge: '🥈' },
  { value: '3rd', labelKey: 'awards.rank.third', gradient: 'from-amber-600 to-amber-700', badge: '🥉' },
  { value: 'winner', labelKey: 'awards.rank.winner', gradient: 'from-orange-500 to-red-500', badge: '🏆' },
  { value: 'runner_up', labelKey: 'awards.rank.runnerUp', gradient: 'from-blue-500 to-indigo-500', badge: '🎖️' },
  { value: 'special_mention', labelKey: 'awards.rank.specialMention', gradient: 'from-yellow-500 to-orange-500', badge: '⭐' },
];
const rankInfo = (r: AwardRank) => RANKS.find(x => x.value === r) || RANKS[0];

const EMPTY_FORM: AwardInput = {
  title: '', rank: '1st', category: '', awardedBy: '', awardedDate: new Date().toISOString().slice(0, 10),
  prizeMoney: 0, paidMethod: 'notSelected', receivedBy: '', details: '', photoUrl: '',
};

export function Awards({ awardsList: awards, onAwardsChanged, committeeMembers, canEdit, canDelete, onLog }: AwardsProps) {
  const { t } = useLanguage();
  const committeeMemberNames = useMemo(
    () => committeeMembers.filter(m => m.isActive !== false).map(m => [m.firstName, m.lastName].filter(Boolean).join(' ')).filter(Boolean),
    [committeeMembers]
  );
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AwardInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Award | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible('awards');

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) setPageMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pagination = usePagination(awards);

  const summary = useMemo(() => ({
    count: awards.length,
    totalPrizeMoney: awards.reduce((s, a) => s + a.prizeMoney, 0),
  }), [awards]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); };
  const openEdit = (award: Award) => {
    setEditingId(award.id);
    setForm({
      title: award.title, rank: award.rank, category: award.category || '', awardedBy: award.awardedBy || '',
      awardedDate: award.awardedDate, prizeMoney: award.prizeMoney, paidMethod: award.paidMethod, receivedBy: award.receivedBy || '',
      details: award.details || '', photoUrl: award.photoUrl || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError(t('awards.titleRequired')); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await updateAwardRequest(editingId, form);
        onAwardsChanged(awards.map(a => (a.id === editingId ? updated : a)));
        onLog('update', 'awards', form.title, undefined, undefined, form.title);
      } else {
        const created = await createAwardRequest(form);
        onAwardsChanged([created, ...awards]);
        onLog('create', 'awards', form.title, undefined, undefined, form.title);
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.message || t('awards.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAwardRequest(deleteTarget.id);
      onAwardsChanged(awards.filter(a => a.id !== deleteTarget.id));
      onLog('delete', 'awards', deleteTarget.title, undefined, undefined, deleteTarget.title);
    } catch (err: any) {
      setError(err?.message || t('awards.deleteFailed'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3 page-actions-row">
            {canEdit && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Trophy size={20} /> {t('awards.recordPrize')}
              </button>
            )}
            <div className="relative" ref={pageMenuRef}>
              <button
                onClick={() => setPageMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              {pageMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <button
                    onClick={() => { setPageMenuOpen(false); toggleWidgets(); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {widgetsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    {widgetsVisible ? t('common.hideWidgets') : t('common.viewWidgets')}
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      >
        {t('nav.awards')}
      </PageHeading>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {widgetsVisible && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('awards.prizesWon')}</h3>
            <Medal className="text-amber-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">{summary.count}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('awards.prizeMoney')}</h3>
            <AwardIcon className="text-green-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{summary.totalPrizeMoney.toLocaleString()}</p>
        </div>
      </div>
      )}

      {awards.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <Trophy className="w-8 h-8 mx-auto mb-2 opacity-60" />
          <p className="text-sm">{t('awards.noPrizes')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pagination.pageItems.map(award => {
              const rank = rankInfo(award.rank);
              return (
                <div key={award.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className={`bg-gradient-to-r ${rank.gradient} rounded-t-2xl px-5 py-4 flex items-center justify-between text-white`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{rank.badge}</span>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{award.title}</p>
                        <p className="text-xs opacity-90">{t(rank.labelKey)}</p>
                      </div>
                    </div>
                    {award.prizeMoney > 0 && (
                      <p className="text-lg font-extrabold shrink-0">₹{award.prizeMoney.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                      {award.awardedBy && <span className="flex items-center gap-1">{award.awardedBy}</span>}
                      <span>{new Date(award.awardedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {award.receivedBy && <span>{award.receivedBy}</span>}
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="relative" ref={openMenuId === award.id ? menuRef : undefined}>
                        <button
                          onClick={() => setOpenMenuId(o => (o === award.id ? null : award.id))}
                          className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openMenuId === award.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                            {canEdit && (
                              <button
                                onClick={() => { setOpenMenuId(null); openEdit(award); }}
                                className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                              >
                                <Pencil size={14} className="text-blue-600" /> {t('awards.edit')}
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => { setOpenMenuId(null); setDeleteTarget(award); }}
                                className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 size={14} /> {t('awards.delete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            pageSize={pagination.pageSize}
            onPageSizeChange={pagination.setPageSize}
            totalItems={pagination.totalItems}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
          />
        </>
      )}

      {showForm && (
        <AwardFormModal
          form={form}
          setForm={setForm}
          editing={!!editingId}
          saving={saving}
          error={formError}
          onCancel={() => setShowForm(false)}
          onSave={handleSave}
          committeeMemberNames={committeeMemberNames}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.title}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AwardFormModal({
  form, setForm, editing, saving, error, onCancel, onSave, committeeMemberNames,
}: {
  form: AwardInput;
  setForm: (f: AwardInput) => void;
  editing: boolean;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
  committeeMemberNames: string[];
}) {
  const { t } = useLanguage();
  const formRef = useRef<HTMLDivElement>(null);
  useAutoFocusFirstField(formRef);
  const inputClass = "w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";
  return (
    <div className="fixed inset-0 h-dvh bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div ref={formRef} className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Trophy size={20} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex-1">{editing ? t('awards.editPrize') : t('awards.recordPrize')}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('awards.prizeAward')}</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('awards.prizeAwardPlaceholder')} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('awards.rankLabel')}</label>
            <div className="flex flex-wrap gap-2">
              {RANKS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm({ ...form, rank: r.value })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                    form.rank === r.value ? 'border-orange-600 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {t(r.labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('awards.categoryCompetition')} <span className="text-orange-500 font-normal">({t('common.optional')})</span>
              </label>
              <input value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} placeholder={t('awards.categoryCompetitionPlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('awards.date')}</label>
              <input type="date" value={form.awardedDate} onChange={e => setForm({ ...form, awardedDate: e.target.value })} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('awards.awardedBy')} <span className="text-orange-500 font-normal">({t('common.optional')})</span>
              </label>
              <input value={form.awardedBy || ''} onChange={e => setForm({ ...form, awardedBy: e.target.value })} placeholder={t('awards.awardedByPlaceholder')} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('awards.receivedBy')} <span className="text-orange-500 font-normal">({t('common.optional')})</span>
              </label>
              <AutocompleteInput value={form.receivedBy || ''} onChange={v => setForm({ ...form, receivedBy: v })} suggestions={committeeMemberNames} placeholder={t('awards.receivedByPlaceholder')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('awards.prizeMoneyLabel')}
              </label>
              <input
                type="number"
                min={0}
                value={form.prizeMoney}
                onChange={e => setForm({ ...form, prizeMoney: Number(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('common.paidMethod')}</label>
              <CustomSelect
                value={form.paidMethod}
                onChange={(v) => setForm({ ...form, paidMethod: v as PaidMethod })}
                options={PAID_METHODS.map((m) => ({ value: m.value, label: t(m.labelKey) }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('awards.details')} <span className="text-orange-500 font-normal">({t('common.optional')})</span>
            </label>
            <textarea
              rows={2}
              value={form.details || ''}
              onChange={e => setForm({ ...form, details: e.target.value })}
              placeholder={t('awards.detailsPlaceholder')}
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t('awards.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? t('awards.saving') : editing ? t('awards.saveChanges') : t('awards.recordPrizeButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
