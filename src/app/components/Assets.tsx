import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Package, Armchair, Home, Volume2, Lightbulb, Plug, Fan, UtensilsCrossed, Drum, X,
  Layers, Boxes, IndianRupee, MapPin, MoreVertical, Download, FileText, Eye, EyeOff,
} from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { Pagination, usePagination } from './Pagination';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { ReportPrintTable } from './ReportPrintTable';
import { downloadTableCSV, SummaryLine } from '../lib/reportExport';
import {
  Asset, AssetInput, AssetCondition, listAssetsRequest, createAssetRequest, updateAssetRequest, deleteAssetRequest,
} from '../lib/db';
import { ActivityModule } from '../lib/db';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface AssetsProps {
  canEdit: boolean;
  canDelete: boolean;
  onLog: (action: 'create' | 'update' | 'delete', module: ActivityModule, summary: string, count?: number, changes?: any, recordLabel?: string) => void;
  companyName: string;
  companyLogo: string;
}

const ASSET_ICONS: { key: string; label: string; Icon?: React.ComponentType<{ size?: number; className?: string }>; glyph?: string; bg: string; fg: string }[] = [
  { key: 'box', label: 'Box', Icon: Package, bg: 'bg-orange-100 dark:bg-orange-500/10', fg: 'text-orange-600 dark:text-orange-400' },
  { key: 'chair', label: 'Chair', Icon: Armchair, bg: 'bg-emerald-100 dark:bg-emerald-500/10', fg: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'tent', label: 'Tent', Icon: Home, bg: 'bg-amber-100 dark:bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400' },
  { key: 'sound', label: 'Sound', Icon: Volume2, bg: 'bg-blue-100 dark:bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400' },
  { key: 'light', label: 'Light', Icon: Lightbulb, bg: 'bg-pink-100 dark:bg-pink-500/10', fg: 'text-pink-600 dark:text-pink-400' },
  { key: 'electric', label: 'Electric', Icon: Plug, bg: 'bg-yellow-100 dark:bg-yellow-500/10', fg: 'text-yellow-700 dark:text-yellow-400' },
  { key: 'fan', label: 'Fan', Icon: Fan, bg: 'bg-cyan-100 dark:bg-cyan-500/10', fg: 'text-cyan-600 dark:text-cyan-400' },
  { key: 'food', label: 'Food', Icon: UtensilsCrossed, bg: 'bg-rose-100 dark:bg-rose-500/10', fg: 'text-rose-600 dark:text-rose-400' },
  { key: 'om', label: 'Om', glyph: 'ॐ', bg: 'bg-purple-100 dark:bg-purple-500/10', fg: 'text-purple-600 dark:text-purple-400' },
  { key: 'drum', label: 'Drum', Icon: Drum, bg: 'bg-red-100 dark:bg-red-500/10', fg: 'text-red-600 dark:text-red-400' },
];

const ICON_MAP = Object.fromEntries(ASSET_ICONS.map(i => [i.key, i]));
const iconFor = (key: string) => ICON_MAP[key] || ASSET_ICONS[0];

const CONDITION_KEYS: { value: AssetCondition; labelKey: TranslationKey; badgeClass: string }[] = [
  { value: 'good', labelKey: 'assets.condition.good', badgeClass: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  { value: 'needs_repair', labelKey: 'assets.condition.needs_repair', badgeClass: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'damaged', labelKey: 'assets.condition.damaged', badgeClass: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400' },
  { value: 'retired', labelKey: 'assets.condition.retired', badgeClass: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
];

const EMPTY_FORM: AssetInput = {
  name: '', quantityOwned: 1, quantityInUse: 0, unit: 'pcs', category: '', condition: 'good',
  value: null, storedAt: '', icon: 'box', notes: '', purchaseDate: '',
};

export function Assets({ canEdit, canDelete, onLog, companyName, companyLogo }: AssetsProps) {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssetInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible('assets');
  const [printData, setPrintData] = useState<{ rows: (string | number)[][]; summary: SummaryLine[] } | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  const conditionOptions = useMemo(() => CONDITION_KEYS.map(o => ({
    value: o.value,
    label: t(o.labelKey),
    badgeClass: o.badgeClass,
  })), [t]);

  const conditionInfo = (c: AssetCondition) => conditionOptions.find(o => o.value === c) || conditionOptions[0];

  const assetColumns = useMemo((): { label: string; render: (a: Asset) => string | number }[] => [
    { label: t('assets.col.name'), render: a => a.name },
    { label: t('assets.col.category'), render: a => a.category || '' },
    { label: t('assets.col.condition'), render: a => conditionInfo(a.condition).label },
    { label: t('assets.col.owned'), render: a => a.quantityOwned },
    { label: t('assets.col.inUse'), render: a => a.quantityInUse },
    { label: t('assets.col.available'), render: a => Math.max(0, a.quantityOwned - a.quantityInUse) },
    { label: t('assets.col.unit'), render: a => a.unit },
    { label: t('assets.col.value'), render: a => a.value ?? '' },
    { label: t('assets.col.storedAt'), render: a => a.storedAt || '' },
    { label: t('assets.col.purchaseDate'), render: a => a.purchaseDate || '' },
  ], [t, conditionOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!printData) return;
    const timer = setTimeout(() => window.print(), 50);
    const onAfterPrint = () => setPrintData(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printData]);

  const reload = () => {
    setLoading(true);
    listAssetsRequest()
      .then(setAssets)
      .catch(err => setError(err?.message || 'Failed to load assets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter(a => {
      if (q) {
        const hay = `${a.name} ${a.category || ''} ${a.storedAt || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (appliedFilters.status && a.condition !== appliedFilters.status) return false;
      if (appliedFilters.dateFrom && (!a.purchaseDate || a.purchaseDate < appliedFilters.dateFrom)) return false;
      if (appliedFilters.dateTo && (!a.purchaseDate || a.purchaseDate > appliedFilters.dateTo)) return false;
      return true;
    });
  }, [assets, searchQuery, appliedFilters]);

  const pagination = usePagination(filteredAssets);

  const summary = useMemo(() => {
    const unitsOwned = assets.reduce((s, a) => s + a.quantityOwned, 0);
    const unitsOut = assets.reduce((s, a) => s + a.quantityInUse, 0);
    const totalValue = assets.reduce((s, a) => s + (a.value || 0), 0);
    return { distinct: assets.length, unitsOwned, unitsOut, totalValue };
  }, [assets]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportRows = () => (selected.size > 0 ? assets.filter(a => selected.has(a.id)) : filteredAssets);

  const exportSummary = (rows: Asset[]): SummaryLine[] => [
    { label: t('assets.distinctAssets'), value: String(rows.length) },
    { label: t('assets.owned'), value: String(rows.reduce((s, a) => s + a.quantityOwned, 0)) },
    { label: t('assets.inUse'), value: String(rows.reduce((s, a) => s + a.quantityInUse, 0)) },
    { label: t('assets.assetValue'), value: `₹${rows.reduce((s, a) => s + (a.value || 0), 0).toLocaleString()}` },
  ];

  const handleDownloadCSV = () => {
    const rows = exportRows();
    downloadTableCSV('assets.csv', {
      companyName,
      summary: exportSummary(rows),
      headers: assetColumns.map(c => c.label),
      rows: rows.map(a => assetColumns.map(c => c.render(a))),
    });
    setMenuOpen(false);
  };

  const handleDownloadPDF = () => {
    const rows = exportRows();
    setPrintData({
      rows: rows.map(a => assetColumns.map(c => c.render(a))),
      summary: exportSummary(rows),
    });
    setMenuOpen(false);
  };

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true); };
  const openEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setForm({
      name: asset.name, quantityOwned: asset.quantityOwned, quantityInUse: asset.quantityInUse, unit: asset.unit,
      category: asset.category || '', condition: asset.condition, value: asset.value, storedAt: asset.storedAt || '',
      icon: asset.icon, notes: asset.notes || '', purchaseDate: asset.purchaseDate || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError(t('assets.validation.nameRequired')); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await updateAssetRequest(editingId, form);
        setAssets(prev => prev.map(a => (a.id === editingId ? updated : a)));
        onLog('update', 'assets', form.name, undefined, undefined, form.name);
      } else {
        const created = await createAssetRequest(form);
        setAssets(prev => [created, ...prev]);
        onLog('create', 'assets', form.name, undefined, undefined, form.name);
      }
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.message || t('assets.validation.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAssetRequest(deleteTarget.id);
      setAssets(prev => prev.filter(a => a.id !== deleteTarget.id));
      onLog('delete', 'assets', deleteTarget.name, undefined, undefined, deleteTarget.name);
    } catch (err: any) {
      setError(err?.message || t('assets.validation.deleteFailed'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {selected.size > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">{selected.size} {t('assets.selected')}</span>
            )}
            {canEdit && (
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} /> {t('assets.addAsset')}
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <button onClick={handleDownloadCSV} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Download size={16} /> {t('assets.downloadCSV')}
                  </button>
                  <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <FileText size={16} /> {t('assets.downloadPDF')}
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); toggleWidgets(); }}
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
        {t('assets.pageTitle')}
      </PageHeading>
      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4 max-w-2xl">
        {t('assets.subtitle')}
      </p>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('assets.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredAssets.length}
          totalCount={assets.length}
          statusOptions={conditionOptions.map(o => ({ value: o.value, label: o.label }))}
          statusLabel={t('assets.condition')}
          showDateRange
        />
      </CollapsibleSearchPanel>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {widgetsVisible && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-blue-500 dark:border-blue-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('assets.distinctAssets')}</h3>
            <Layers className="text-blue-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{summary.distinct}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-amber-500 dark:border-amber-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('assets.unitsOwnedOut')}</h3>
            <Boxes className="text-amber-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-600">
            {summary.unitsOwned} <span className="text-base font-medium text-gray-400 dark:text-gray-500">· {summary.unitsOut} {t('assets.out')}</span>
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-green-500 dark:border-green-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('assets.assetValue')}</h3>
            <IndianRupee className="text-green-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{summary.totalValue.toLocaleString()}</p>
        </div>
      </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">{t('assets.loading')}</p>
        ) : assets.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">{t('assets.empty')}</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm">{t('assets.noMatch')}</p>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 sm:p-6">
            {pagination.pageItems.map(asset => {
              const icon = iconFor(asset.icon);
              const cond = conditionInfo(asset.condition);
              const available = Math.max(0, asset.quantityOwned - asset.quantityInUse);
              return (
                <div key={asset.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selected.has(asset.id)}
                      onChange={() => toggleSelect(asset.id)}
                      className="mt-2.5 rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                    />
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${icon.bg} ${icon.fg}`}>
                      {icon.Icon ? <icon.Icon size={20} /> : <span className="text-lg font-bold">{icon.glyph}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 truncate">{asset.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{asset.category || t('assets.col.category')}</p>
                    </div>
                    {(canEdit || canDelete) && (
                      <div className="relative shrink-0" ref={openRowMenuId === asset.id ? rowMenuRef : undefined}>
                        <button
                          onClick={() => setOpenRowMenuId(o => (o === asset.id ? null : asset.id))}
                          className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openRowMenuId === asset.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                            {canEdit && (
                              <button onClick={() => { setOpenRowMenuId(null); openEdit(asset); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Pencil size={14} className="text-blue-600" /> {t('common.edit')}
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { setOpenRowMenuId(null); setDeleteTarget(asset); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 size={14} /> {t('common.delete')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{available}</p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">{t('assets.available')}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{asset.quantityInUse}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('assets.inUse')}</p>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{asset.quantityOwned}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('assets.owned')} ({asset.unit})</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cond.badgeClass}`}>{cond.label}</span>
                    {asset.storedAt && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <MapPin size={12} /> {asset.storedAt}
                      </span>
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
      </div>

      {showForm && (
        <AssetFormModal
          form={form}
          setForm={setForm}
          conditionOptions={conditionOptions}
          editing={!!editingId}
          saving={saving}
          error={formError}
          onCancel={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {printData && (
        <ReportPrintTable
          companyName={companyName}
          companyLogo={companyLogo}
          title={t('assets.pageTitle')}
          summary={printData.summary}
          columns={assetColumns.map((c, i) => ({ label: c.label, align: i >= 3 && i <= 7 ? 'right' : 'left' }))}
          rows={printData.rows}
          emptyMessage={t('assets.noAssetsToShow')}
        />
      )}
    </div>
  );
}

function AssetFormModal({
  form, setForm, conditionOptions, editing, saving, error, onCancel, onSave,
}: {
  form: AssetInput;
  setForm: (f: AssetInput) => void;
  conditionOptions: { value: AssetCondition; label: string }[];
  editing: boolean;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Package size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{editing ? t('assets.editAsset') : t('assets.addAsset')}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500">{t('assets.form.reusableNotice')}</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('assets.form.name')}</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder={t('assets.form.namePlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('assets.form.quantityOwned')}</label>
              <input
                type="number"
                min={0}
                value={form.quantityOwned}
                onChange={e => setForm({ ...form, quantityOwned: Number(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('assets.form.unit')}</label>
              <input
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
                placeholder={t('assets.form.unitPlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('assets.form.category')} <span className="text-orange-500 font-normal">{t('assets.form.optional')}</span>
              </label>
              <input
                value={form.category || ''}
                onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder={t('assets.form.categoryPlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('assets.condition')}</label>
              <CustomSelect
                value={form.condition}
                onChange={(v) => setForm({ ...form, condition: v as AssetCondition })}
                options={conditionOptions}
                className="py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('assets.form.value')} <span className="text-orange-500 font-normal">{t('assets.form.optional')}</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.value ?? ''}
                onChange={e => setForm({ ...form, value: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder={t('assets.form.valuePlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('assets.form.storedAt')} <span className="text-orange-500 font-normal">{t('assets.form.optional')}</span>
              </label>
              <input
                value={form.storedAt || ''}
                onChange={e => setForm({ ...form, storedAt: e.target.value })}
                placeholder={t('assets.form.storedAtPlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('assets.form.purchaseDate')} <span className="text-orange-500 font-normal">{t('assets.form.optional')}</span>
            </label>
            <input
              type="date"
              value={form.purchaseDate || ''}
              onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('assets.form.icon')}</label>
            <div className="flex flex-wrap gap-1.5">
              {ASSET_ICONS.map(icon => (
                <button
                  key={icon.key}
                  type="button"
                  onClick={() => setForm({ ...form, icon: icon.key })}
                  aria-label={icon.label}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                    form.icon === icon.key ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                  }`}
                >
                  {icon.Icon ? <icon.Icon size={17} className="text-gray-600 dark:text-gray-300" /> : <span className="text-base font-bold text-gray-600 dark:text-gray-300">{icon.glyph}</span>}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('assets.form.notes')} <span className="text-orange-500 font-normal">{t('assets.form.optional')}</span>
            </label>
            <input
              value={form.notes || ''}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder={t('assets.form.notesPlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {saving ? t('assets.saving') : editing ? t('assets.saveChanges') : t('assets.addAsset')}
          </button>
        </div>
      </div>
    </div>
  );
}
