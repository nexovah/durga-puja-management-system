import { useRef, useState, useMemo, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload, Wallet, Gift, Megaphone, Users, MoreVertical, User as UserIcon, PieChart, Eye, EyeOff } from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DONUT_COLORS } from './DashboardDonut';
import { DonationAd, DonationAdCategory, PaidMethod, PaymentStatus, Member, Chanda, getDonationAdCreditAmount } from '../App';
import { diffFields, ActivityFieldChange } from '../lib/db';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField } from '../lib/csv';
import { Pagination, usePagination } from './Pagination';
import { normalizeKey, prepareImportUpsert } from '../lib/uniqueCheck';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { FormModal, FormModalCancelButton } from './FormModal';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { StatusChangeConfirmModal } from './StatusChangeConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { useTableColumns, ColumnVisibilityDropdown, SortableTh, DataTableToolbar, ColumnDef } from './TableColumnManager';

interface DonationAdsCollectionProps {
  donationAdsList: DonationAd[];
  setDonationAdsList: (list: DonationAd[]) => void;
  members: Member[];
  chandaList: Chanda[];
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'donation_ads', summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  // When set, this instance is scoped to just that category — used to
  // render "Donation" and "Ads" as separate sidebar menu items sharing
  // this same component instead of one combined "Donation & Ads" page
  // with a category picker (mobile already has them separate; this
  // matches that). Category select is locked/hidden, totals and the
  // table only cover this category, but writes still go through the
  // full donationAdsList so the other category's rows are untouched.
  fixedCategory?: DonationAdCategory;
}

const DONATION_ADS_FIELD_LABELS: Record<string, string> = {
  category: 'Category', donorName: "Donor's Name", companyName: 'Company Name', amount: 'Amount',
  paidMethod: 'Paid Method', paymentStatus: 'Payment Status', inKind: 'In-Kind / Ads Category', date: 'Date', voucherNumber: 'Voucher Number',
  phone: 'Phone', phone2: 'Phone 2', collectedBy: 'Collected By', remarks: 'Remarks',
};

export const ADS_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'handBook', labelKey: 'donationAds.adsCategory.handBook' },
  { value: 'souvenir', labelKey: 'donationAds.adsCategory.souvenir' },
  { value: 'leaflet', labelKey: 'donationAds.adsCategory.leaflet' },
  { value: 'bill', labelKey: 'donationAds.adsCategory.bill' },
  { value: 'foodCoupon', labelKey: 'donationAds.adsCategory.foodCoupon' },
  { value: 'bookmark', labelKey: 'donationAds.adsCategory.bookmark' },
  { value: 'gate', labelKey: 'donationAds.adsCategory.gate' },
  { value: 'banner', labelKey: 'donationAds.adsCategory.banner' },
  { value: 'hoarding', labelKey: 'donationAds.adsCategory.hoarding' },
  { value: 'flex', labelKey: 'donationAds.adsCategory.flex' },
  { value: 'pillar', labelKey: 'donationAds.adsCategory.pillar' },
  { value: 'roadsideBranding', labelKey: 'donationAds.adsCategory.roadsideBranding' },
  { value: 'welcomeBoard', labelKey: 'donationAds.adsCategory.welcomeBoard' },
  { value: 'standee', labelKey: 'donationAds.adsCategory.standee' },
  { value: 'corridorBranding', labelKey: 'donationAds.adsCategory.corridorBranding' },
  { value: 'pandalBranding', labelKey: 'donationAds.adsCategory.pandalBranding' },
  { value: 'insidePremisesBranding', labelKey: 'donationAds.adsCategory.insidePremisesBranding' },
  { value: 'stageBackdrop', labelKey: 'donationAds.adsCategory.stageBackdrop' },
  { value: 'stageSidePanel', labelKey: 'donationAds.adsCategory.stageSidePanel' },
  { value: 'stall', labelKey: 'donationAds.adsCategory.stall' },
  { value: 'ledDisplay', labelKey: 'donationAds.adsCategory.ledDisplay' },
  { value: 'videoScreen', labelKey: 'donationAds.adsCategory.videoScreen' },
  { value: 'audioAd', labelKey: 'donationAds.adsCategory.audioAd' },
  { value: 'prasadBag', labelKey: 'donationAds.adsCategory.prasadBag' },
  { value: 'laddu', labelKey: 'donationAds.adsCategory.laddu' },
  { value: 'capTshirt', labelKey: 'donationAds.adsCategory.capTshirt' },
  { value: 'umbrella', labelKey: 'donationAds.adsCategory.umbrella' },
  { value: 'balloon', labelKey: 'donationAds.adsCategory.balloon' },
  { value: 'carSticker', labelKey: 'donationAds.adsCategory.carSticker' },
  { value: 'vehicleBranding', labelKey: 'donationAds.adsCategory.vehicleBranding' },
  { value: 'culturalSponsorship', labelKey: 'donationAds.adsCategory.culturalSponsorship' },
  { value: 'eventSponsorship', labelKey: 'donationAds.adsCategory.eventSponsorship' },
  { value: 'others', labelKey: 'donationAds.adsCategory.others' },
];

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const PAYMENT_STATUSES: { value: PaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'pending', labelKey: 'chanda.status.pending' },
  { value: 'paid', labelKey: 'chanda.status.paid' },
  { value: 'rejected', labelKey: 'chanda.status.rejected' },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

const AMOUNT_COLOR: Record<string, string> = {
  paid: 'text-green-600',
  pending: 'text-yellow-600',
  rejected: 'text-red-500 line-through',
};

const emptyForm = {
  category: 'ads' as DonationAdCategory,
  donorName: '',
  companyName: '',
  amount: '',
  paidMethod: 'notSelected' as PaidMethod,
  paymentStatus: 'pending' as PaymentStatus,
  inKind: '',
  date: new Date().toISOString().split('T')[0],
  voucherNumber: '',
  phone: '',
  phone2: '',
  collectedBy: '',
  remarks: '',
};

export function DonationAdsCollection({ donationAdsList, setDonationAdsList, members, chandaList, canEdit, canDelete, canBulkImport, onLog, fixedCategory }: DonationAdsCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(() => (fixedCategory ? { ...emptyForm, category: fixedCategory } : emptyForm));
  const [collectedBySuggestOpen, setCollectedBySuggestOpen] = useState(false);
  const collectedBySuggestRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: DonationAd[]; toUpdate: DonationAd[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DonationAd | null>(null);
  const [viewTarget, setViewTarget] = useState<DonationAd | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: Omit<DonationAd, 'id'>; saveAndAddNew: boolean } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible(fixedCategory || 'donationAds');
  const menuRef = useRef<HTMLDivElement>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!collectedBySuggestOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (collectedBySuggestRef.current && !collectedBySuggestRef.current.contains(e.target as Node)) setCollectedBySuggestOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collectedBySuggestOpen]);

  // "Collected by" suggestions: committee Members first (most common case),
  // then every unique donor/company name ever entered across Collection and
  // Donation/Sponsorship — covers the third-party-collector case too. Free
  // text is always allowed; this list just speeds up picking a known name.
  // Members take priority over Donor when a name matches both (e.g. a
  // member who also donated before) — confirmed tie-break.
  const collectedByTypeMap = useMemo(() => {
    const map = new Map<string, 'member' | 'donor'>();
    chandaList.forEach(c => { if (c.donorName.trim()) map.set(c.donorName.trim(), 'donor'); });
    donationAdsList.forEach(d => {
      if (d.donorName.trim()) map.set(d.donorName.trim(), 'donor');
      if (d.companyName?.trim()) map.set(d.companyName.trim(), 'donor');
    });
    members.forEach(m => { if (m.name.trim()) map.set(m.name.trim(), 'member'); });
    return map;
  }, [members, chandaList, donationAdsList]);

  const collectedByPool = useMemo(() => [...collectedByTypeMap.keys()], [collectedByTypeMap]);

  const matchingCollectedBy = useMemo(() => {
    const q = formData.collectedBy.trim().toLowerCase();
    if (!q) return [];
    return collectedByPool.filter(name => name.toLowerCase().includes(q)).slice(0, 8);
  }, [collectedByPool, formData.collectedBy]);

  const scopedList = fixedCategory ? donationAdsList.filter(item => item.category === fixedCategory) : donationAdsList;

  const total = scopedList.reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalDonation = scopedList.filter(item => item.category === 'donation').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);
  const totalAds = scopedList.filter(item => item.category === 'ads').reduce((sum, item) => sum + getDonationAdCreditAmount(item), 0);

  // Sponsorship-only: amount collected per Sponsorship Category (In Kind
  // field holds the ADS_CATEGORIES value for ads entries) — feeds the
  // category-breakdown donut widget on the Sponsorship page.
  const adsCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    donationAdsList
      .filter(item => item.category === 'ads')
      .forEach(item => {
        const key = item.inKind || '';
        if (!key) return;
        totals.set(key, (totals.get(key) || 0) + getDonationAdCreditAmount(item));
      });
    return [...totals.entries()]
      .map(([value, value_]) => {
        const found = ADS_CATEGORIES.find(c => c.value === value);
        return { name: found ? t(found.labelKey) : value, value: value_ };
      })
      .sort((a, b) => b.value - a.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donationAdsList, t]);

  const statusLabel = (status: string) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found ? t(found.labelKey) : status;
  };

  const categoryLabel = (category: DonationAdCategory) =>
    category === 'donation' ? t('donationAds.category.donation') : t('donationAds.category.ads');

  const adsCategoryLabel = (value: string) => {
    const found = ADS_CATEGORIES.find(c => c.value === value);
    return found ? t(found.labelKey) : value;
  };

  const inKindDisplay = (item: DonationAd) =>
    item.category === 'ads' ? adsCategoryLabel(item.inKind) : item.inKind;

  const paidMethodLabel = (method: PaidMethod) => {
    const found = PAID_METHODS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
  };

  // Accept category/ads-category values from a CSV in any supported language,
  // or the raw canonical keys ('donation'/'ads', 'handBook', ...).
  const normalize = (s: string) => s.trim().toLowerCase();

  const parseCategoryInput = (raw: string): DonationAdCategory => {
    const value = normalize(raw || '');
    if (value === 'donation') return 'donation';
    if (value === 'ads') return 'ads';
    for (const lang of Object.values(translations)) {
      if (normalize(lang['donationAds.category.donation']) === value) return 'donation';
      if (normalize(lang['donationAds.category.ads']) === value) return 'ads';
    }
    return 'ads';
  };

  const parseAdsCategoryInput = (raw: string): string => {
    const value = normalize(raw || '');
    const byValue = ADS_CATEGORIES.find(c => normalize(c.value) === value);
    if (byValue) return byValue.value;
    for (const cat of ADS_CATEGORIES) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[cat.labelKey]) === value) return cat.value;
      }
    }
    return raw.trim();
  };

  const parsePaidMethodInput = (raw: string): PaidMethod => {
    const value = normalize(raw || '');
    const byValue = PAID_METHODS.find(m => normalize(m.value) === value);
    if (byValue) return byValue.value;
    for (const method of PAID_METHODS) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[method.labelKey]) === value) return method.value;
      }
    }
    return 'notSelected';
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    const voucherKey = formData.category === 'donation' ? normalizeKey(formData.voucherNumber) : '';
    if (voucherKey) {
      const isDuplicate = donationAdsList.some(item => item.id !== editingId && normalizeKey(item.voucherNumber) === voucherKey);
      if (isDuplicate) {
        alert(t('donationAds.voucherNumberDuplicate'));
        return;
      }
    }

    const payload = {
      category: formData.category,
      donorName: formData.donorName,
      companyName: formData.category === 'ads' ? formData.companyName : '',
      amount: parseFloat(formData.amount) || 0,
      paidMethod: formData.paidMethod,
      paymentStatus: formData.paymentStatus,
      inKind: formData.inKind,
      date: formData.date,
      voucherNumber: formData.category === 'donation' ? formData.voucherNumber : '',
      phone: formData.phone,
      phone2: formData.phone2,
      collectedBy: formData.collectedBy.trim() || undefined,
      remarks: formData.remarks,
    };

    // Editing a record already marked Paid requires PIN confirmation —
    // same guard as Chanda & Expenses (paid means money already received).
    if (editingId) {
      const original = donationAdsList.find(item => item.id === editingId);
      if (original?.paymentStatus === 'paid') {
        setPendingSave({ payload, saveAndAddNew });
        return;
      }
    }

    commitSave(payload, saveAndAddNew);
  };

  const commitSave = (payload: Omit<DonationAd, 'id'>, saveAndAddNew: boolean) => {
    if (editingId) {
      const original = donationAdsList.find(item => item.id === editingId);
      setDonationAdsList(donationAdsList.map(item =>
        item.id === editingId ? { ...item, ...payload } : item
      ));
      onLog(
        'update', 'donation_ads', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`, 1,
        diffFields(original as any, payload as any, DONATION_ADS_FIELD_LABELS),
        payload.donorName || payload.companyName
      );
      setToastMessage(t('common.updatedSuccess'));
    } else {
      const newItem: DonationAd = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setDonationAdsList([...donationAdsList, newItem]);
      onLog('create', 'donation_ads', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`, undefined, undefined, payload.donorName || payload.companyName);
      setToastMessage(t('common.savedSuccess'));
    }

    const wasEditing = editingId;
    setFormData(fixedCategory ? { ...emptyForm, category: fixedCategory } : emptyForm);
    setEditingId(null);
    setShowForm(saveAndAddNew && !wasEditing);
  };

  const confirmStatusChange = () => {
    if (!pendingSave) return;
    commitSave(pendingSave.payload, pendingSave.saveAndAddNew);
    setPendingSave(null);
  };

  const handleEdit = (item: DonationAd) => {
    setFormData({
      category: item.category,
      donorName: item.donorName,
      companyName: item.companyName || '',
      amount: item.amount.toString(),
      paidMethod: item.paidMethod || 'notSelected',
      paymentStatus: item.paymentStatus || 'pending',
      inKind: item.inKind || '',
      date: item.date,
      voucherNumber: item.voucherNumber || '',
      phone: item.phone,
      phone2: item.phone2 || '',
      collectedBy: item.collectedBy || '',
      remarks: item.remarks,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = donationAdsList.find(item => item.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDonationAdsList(donationAdsList.filter(item => item.id !== deleteTarget.id));
    onLog('delete', 'donation_ads', `${deleteTarget.donorName} — ₹${deleteTarget.amount.toLocaleString()}`, undefined, undefined, deleteTarget.donorName || deleteTarget.companyName);
    setDeleteTarget(null);
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(fixedCategory ? { ...emptyForm, category: fixedCategory } : emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleExport = () => {
    const csvContent = [
      [
        t('donationAds.csv.category'),
        t('donationAds.donorName'),
        t('donationAds.companyName'),
        t('donationAds.csv.amount'),
        t('common.paidMethod'),
        t('donationAds.inKindOrAdsCategory'),
        t('donationAds.csv.date'),
        t('donationAds.csv.voucherNumber'),
        t('donationAds.csv.phone'),
        t('donationAds.csv.phone2'),
        t('donationAds.csv.remarks'),
      ].map(csvField).join(','),
      ...scopedList.map(item => [
        categoryLabel(item.category),
        item.donorName,
        item.companyName || '',
        item.amount,
        paidMethodLabel(item.paidMethod || 'notSelected'),
        inKindDisplay(item),
        item.date,
        item.voucherNumber || '',
        item.phone,
        item.phone2 || '',
        item.remarks,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${fixedCategory ? fixedCategory + '-collection' : 'donation-ads-collection'}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ''));
      if (rows.length === 0) return;

      // Skip a header row if the amount column (index 3) isn't numeric
      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][3] || '') ? 0 : 1;

      const imported: DonationAd[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const [categoryRaw, donorName, companyName, amountRaw, paidMethodRaw, inKindRaw, date, voucherNumber, phone, phone2, remarks] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (isNaN(amount)) continue;

        const category = parseCategoryInput(categoryRaw);
        const isDonationRow = category === 'donation';
        if (isDonationRow && !donorName) continue;

        imported.push({
          id: crypto.randomUUID(),
          category,
          donorName: (donorName || '').trim(),
          companyName: !isDonationRow ? (companyName || '').trim() : '',
          amount,
          paidMethod: parsePaidMethodInput(paidMethodRaw || ''),
          inKind: !isDonationRow ? parseAdsCategoryInput(inKindRaw || '') : (inKindRaw || '').trim(),
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          voucherNumber: isDonationRow ? (voucherNumber || '').trim() : '',
          phone: (phone || '').trim(),
          phone2: (phone2 || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      const { toInsert, toUpdate } = prepareImportUpsert(imported, (row) => row.voucherNumber, donationAdsList);
      setImportPreview({ toInsert, toUpdate, errors: [], totalRows: imported.length });
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { toInsert, toUpdate } = importPreview;
    const updatedIds = new Set(toUpdate.map(r => r.id));
    const merged = donationAdsList.map(item => (updatedIds.has(item.id) ? toUpdate.find(u => u.id === item.id)! : item));
    setDonationAdsList([...merged, ...toInsert]);
    const count = toInsert.length + toUpdate.length;
    onLog('bulk_import', 'donation_ads', `${t('common.importResult')}: ${count} (${toInsert.length} new, ${toUpdate.length} updated)`, count);
    setImportPreview(null);
  };

  const isDonation = formData.category === 'donation';

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredDonationAds = scopedList.filter(d => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [d.donorName, d.companyName, d.phone, d.phone2, d.remarks, d.voucherNumber, d.inKind, d.collectedBy]
        .some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }

    const f = appliedFilters;
    if (f.amountMin && d.amount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && d.amount > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && !(d.voucherNumber || '').toLowerCase().includes(f.billVoucher.trim().toLowerCase())) return false;
    if (f.paidMethod && d.paidMethod !== f.paidMethod) return false;
    if (f.inKind && d.inKind !== f.inKind) return false;
    if (f.phone && !(d.phone || '').includes(f.phone.trim()) && !(d.phone2 || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(d.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(d.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const donationAdsColumns: ColumnDef<DonationAd>[] = useMemo(() => [
    { id: 'donorName', label: t('donationAds.donorName'), required: true, sortValue: d => d.donorName || d.companyName || '' },
    { id: 'companyName', label: t('donationAds.companyName'), sortValue: d => d.companyName || '' },
    { id: 'amount', label: t('common.amount'), align: 'left', sortValue: d => d.amount },
    { id: 'paidMethod', label: t('common.paidMethod'), sortValue: d => paidMethodLabel(d.paidMethod || 'notSelected') },
    { id: 'paymentStatus', label: t('chanda.paymentStatus'), sortValue: d => d.paymentStatus || 'paid' },
    ...(!fixedCategory ? [{ id: 'category', label: t('donationAds.category'), sortValue: (d: DonationAd) => categoryLabel(d.category) }] : []),
    { id: 'inKind', label: t('donationAds.inKindOrAdsCategory'), sortValue: d => inKindDisplay(d) || '' },
    { id: 'date', label: t('common.date'), sortValue: d => d.date },
    { id: 'phone', label: t('common.phone1'), sortValue: d => d.phone || '' },
    { id: 'collectedBy', label: t('donationAds.collectedBy'), sortValue: d => d.collectedBy || '' },
    { id: 'remarks', label: t('common.remarks'), sortValue: d => d.remarks || '' },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, fixedCategory, canEdit, canDelete]);

  const tableCols = useTableColumns<DonationAd>({
    tableId: fixedCategory ? `donation_ads_${fixedCategory}` : 'donation_ads',
    columns: donationAdsColumns,
    defaultSort: { columnId: 'date', direction: 'desc' },
  });

  const sortedDonationAds = useMemo(() => tableCols.sortItems(filteredDonationAds), [tableCols, filteredDonationAds]);
  const pagination = usePagination(sortedDonationAds);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <SearchToggleButton open={showSearch} onToggle={() => setShowSearch(o => !o)} />
            {canEdit && canBulkImport && (
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                className="hidden"
              />
            )}
            {canEdit && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('donationAds.addNew')}
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={20} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  {canEdit && canBulkImport && (
                    <button
                      onClick={() => { setMenuOpen(false); handleImportClick(); }}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Upload size={16} /> {t('common.import')}
                    </button>
                  )}
                  <button
                    onClick={() => { setMenuOpen(false); handleExport(); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <Download size={16} /> {t('common.export')}
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
        {fixedCategory === 'donation' ? t('nav.donation') : fixedCategory === 'ads' ? t('nav.ads') : t('donationAds.pageTitle')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
      <TableSearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        placeholder={t('donationAds.searchPlaceholder')}
        filters={draftFilters}
        onFiltersChange={setDraftFilters}
        onSearch={() => setAppliedFilters(draftFilters)}
        onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
        filtersActive={hasActiveTableFilters(appliedFilters)}
        resultCount={filteredDonationAds.length}
        totalCount={scopedList.length}
        showAmount
        showBillVoucher
        billVoucherLabel={t('donationAds.voucherNumber')}
        paidMethodOptions={PAID_METHODS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
        showDateRange
        showPhone
        inKindOptions={ADS_CATEGORIES.map(c => ({ value: c.value, label: t(c.labelKey) }))}
        inKindLabel={t('donationAds.inKindOrAdsCategory')}
      />
      </CollapsibleSearchPanel>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('donationAds.editEntry') : t('donationAds.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="donation-ads-form"
              className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="donation-ads-form"
                value="andNew"
                className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <FormModalCancelButton onClick={handleCancel} label={t('common.cancel')} />
          </>
        }
      >
          <form id="donation-ads-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!fixedCategory && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.category')} *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as DonationAdCategory, inKind: '', voucherNumber: '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="ads">{t('donationAds.category.ads')}</option>
                <option value="donation">{t('donationAds.category.donation')}</option>
              </select>
            </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('donationAds.donorName')} {isDonation ? '*' : ''}
              </label>
              <input
                type="text"
                required={isDonation}
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.donorNamePlaceholder')}
              />
            </div>

            {!isDonation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.companyName')}</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.companyNamePlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.amountLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.amountPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.paidMethod')}</label>
              <select
                value={formData.paidMethod}
                onChange={(e) => setFormData({ ...formData, paidMethod: e.target.value as PaidMethod })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.paymentStatus')} *</label>
              <select
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus, partialAmount: '' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>

            {isDonation ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.inKind')}</label>
                <input
                  type="text"
                  value={formData.inKind}
                  onChange={(e) => setFormData({ ...formData, inKind: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.inKindPlaceholder')}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.adsCategory')}</label>
                <select
                  value={formData.inKind}
                  onChange={(e) => setFormData({ ...formData, inKind: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('donationAds.selectAdsCategory')}</option>
                  {ADS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{t(cat.labelKey)}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.date')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>

            {isDonation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.voucherNumber')}</label>
                <input
                  type="text"
                  value={formData.voucherNumber}
                  onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.voucherNumberPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.phone1')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.phonePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.phone2')}</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.phonePlaceholder')}
              />
            </div>

            <div className="relative" ref={collectedBySuggestRef}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.collectedBy')}</label>
              <input
                type="text"
                autoComplete="off"
                value={formData.collectedBy}
                onChange={(e) => { setFormData({ ...formData, collectedBy: e.target.value }); setCollectedBySuggestOpen(true); }}
                onFocus={() => setCollectedBySuggestOpen(true)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.collectedByPlaceholder')}
              />
              {collectedBySuggestOpen && matchingCollectedBy.length > 0 && (
                <div className="absolute left-0 top-full mt-1.5 w-full z-30 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
                  {matchingCollectedBy.map(name => {
                    const type = collectedByTypeMap.get(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => { setFormData({ ...formData, collectedBy: name }); setCollectedBySuggestOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors text-left"
                      >
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          type === 'member'
                            ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {type === 'member' ? <UserIcon size={14} /> : <Gift size={14} />}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{name}</span>
                        {type && (
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                            type === 'member'
                              ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                              : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                          }`}>
                            {type === 'member' ? t('donationAds.collectedByMember') : t('donationAds.collectedByDonor')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.remarksPlaceholder')}
                rows={2}
              />
            </div>

          </form>
      </FormModal>

      {/* Widgets — Treasury-style summary cards */}
      {widgetsVisible && (
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${fixedCategory !== 'donation' ? 'lg:grid-cols-3' : ''} gap-4 sm:gap-6`}>
        {fixedCategory === 'ads' && adsCategoryTotals.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-indigo-500 dark:border-indigo-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('donationAds.widget.byCategory')}</h3>
            <PieChart className="text-indigo-500" size={24} />
          </div>
          <div className="flex items-center gap-3 h-14">
            <div className="w-14 h-14 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={adsCategoryTotals} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="100%" paddingAngle={2}>
                    {adsCategoryTotals.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto max-h-14 space-y-0.5">
              {adsCategoryTotals.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">{c.name}</span>
                  </span>
                  <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0">₹{c.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-purple-500 dark:border-purple-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('donationAds.widget.total')}</h3>
            <Wallet className="text-purple-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-purple-600">₹{total.toLocaleString()}</p>
        </div>
        {fixedCategory && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-orange-500 dark:border-orange-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {fixedCategory === 'donation' ? t('donationAds.widget.totalDonors') : t('donationAds.widget.totalAdvertisers')}
            </h3>
            <Users className="text-orange-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-orange-600">{scopedList.length.toLocaleString()}</p>
        </div>
        )}
        {!fixedCategory && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-emerald-500 dark:border-emerald-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('donationAds.widget.donation')}</h3>
            <Gift className="text-emerald-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">₹{totalDonation.toLocaleString()}</p>
        </div>
        )}
        {!fixedCategory && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-4 sm:p-6 border border-l-4 border-blue-500 dark:border-blue-500/60">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('donationAds.widget.ads')}</h3>
            <Megaphone className="text-blue-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">₹{totalAds.toLocaleString()}</p>
        </div>
        )}
      </div>
      )}

      {/* List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          activeSortLabel={tableCols.activeSortColumn?.label}
          sortDirection={tableCols.sortState.direction}
          onResetSort={tableCols.resetSort}
          columnDropdown={
            <ColumnVisibilityDropdown
              columns={tableCols.columns}
              isColumnVisible={tableCols.isColumnVisible}
              toggleColumn={tableCols.toggleColumn}
              showAllColumns={tableCols.showAllColumns}
              resetColumns={tableCols.resetColumns}
              hasCustomVisibility={tableCols.hasCustomVisibility}
              hiddenCount={tableCols.hiddenCount}
            />
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {tableCols.isColumnVisible('donorName') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'donorName')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('companyName') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'companyName')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('amount') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'amount')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paidMethod') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'paidMethod')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paymentStatus') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'paymentStatus')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {!fixedCategory && tableCols.isColumnVisible('category') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'category')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('inKind') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'inKind')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('date') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'date')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('phone') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'phone')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('collectedBy') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'collectedBy')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('remarks') && (
                  <SortableTh column={donationAdsColumns.find(c => c.id === 'remarks')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  {tableCols.isColumnVisible('donorName') && (
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => setViewTarget(item)}
                        className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                      >
                        {item.donorName || item.companyName || '-'}
                      </button>
                    </td>
                  )}
                  {tableCols.isColumnVisible('companyName') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.companyName || '-'}</td>
                  )}
                  {tableCols.isColumnVisible('amount') && (
                    <td className={`px-6 py-4 text-sm font-bold ${AMOUNT_COLOR[item.paymentStatus || 'paid'] || 'text-green-600'}`}>₹{item.amount.toLocaleString()}</td>
                  )}
                  {tableCols.isColumnVisible('paidMethod') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidMethodLabel(item.paidMethod || 'notSelected')}</td>
                  )}
                  {tableCols.isColumnVisible('paymentStatus') && (
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_BADGE_CLASS[item.paymentStatus || 'paid'] || 'bg-green-100 text-green-700'}`}>
                        {statusLabel(item.paymentStatus || 'paid')}
                      </span>
                    </td>
                  )}
                  {!fixedCategory && tableCols.isColumnVisible('category') && (
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        item.category === 'donation' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {categoryLabel(item.category)}
                      </span>
                    </td>
                  )}
                  {tableCols.isColumnVisible('inKind') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{inKindDisplay(item) || '-'}</td>
                  )}
                  {tableCols.isColumnVisible('date') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {item.date ? new Date(item.date).toLocaleDateString(locale) : '-'}
                    </td>
                  )}
                  {tableCols.isColumnVisible('phone') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.phone || '-'}</td>
                  )}
                  {tableCols.isColumnVisible('collectedBy') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.collectedBy || '-'}</td>
                  )}
                  {tableCols.isColumnVisible('remarks') && (
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{item.remarks || '-'}</td>
                  )}
                  {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block" ref={openRowMenuId === item.id ? rowMenuRef : undefined}>
                        <button
                          onClick={() => setOpenRowMenuId(o => (o === item.id ? null : item.id))}
                          className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openRowMenuId === item.id && (
                          <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                            {canEdit && (
                              <button onClick={() => { setOpenRowMenuId(null); handleEdit(item); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Edit2 size={14} className="text-blue-600" /> Edit
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => { setOpenRowMenuId(null); handleDelete(item.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 size={14} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {filteredDonationAds.length > 0 && tableCols.isColumnVisible('amount') && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td
                    colSpan={['donorName', 'companyName'].filter(id => tableCols.isColumnVisible(id)).length || 1}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right"
                  >
                    {t('common.total')}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-gray-900 dark:text-gray-100">
                    ₹{filteredDonationAds.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {filteredDonationAds.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('donationAds.empty')}
            </div>
          )}
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
      </div>

      <ImportPreviewModal
        open={!!importPreview}
        title={t('import.preview.title')}
        totalRows={importPreview?.totalRows || 0}
        insertCount={importPreview?.toInsert.length || 0}
        updateCount={importPreview?.toUpdate.length || 0}
        errors={importPreview?.errors || []}
        onCancel={() => setImportPreview(null)}
        onConfirm={handleConfirmImport}
      />

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.donorName || viewTarget?.companyName || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const item = viewTarget; setViewTarget(null); handleEdit(item); } : undefined}
        fields={viewTarget ? [
          { label: t('donationAds.donorName'), value: viewTarget.donorName || '-' },
          { label: t('donationAds.companyName'), value: viewTarget.companyName || '-' },
          { label: t('donationAds.amountLabel'), value: `₹${viewTarget.amount.toLocaleString()}` },
          { label: t('common.paidMethod'), value: paidMethodLabel(viewTarget.paidMethod || 'notSelected') },
          { label: t('donationAds.category'), value: categoryLabel(viewTarget.category) },
          { label: t('donationAds.inKind'), value: inKindDisplay(viewTarget) || '-' },
          { label: t('common.date'), value: viewTarget.date ? new Date(viewTarget.date).toLocaleDateString(locale) : '-' },
          { label: t('donationAds.voucherNumber'), value: viewTarget.voucherNumber || '-' },
          { label: t('common.phone1'), value: viewTarget.phone || '-' },
          { label: t('common.phone2'), value: viewTarget.phone2 || '-' },
          { label: t('donationAds.collectedBy'), value: viewTarget.collectedBy || '-' },
          { label: t('common.remarks'), value: viewTarget.remarks || '-', fullWidth: true },
        ] : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.donorName || deleteTarget?.companyName}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StatusChangeConfirmModal
        open={!!pendingSave}
        itemLabel={pendingSave?.payload.donorName || pendingSave?.payload.companyName}
        fromStatusLabel={statusLabel('paid')}
        toStatusLabel={pendingSave ? statusLabel(pendingSave.payload.paymentStatus) : ''}
        messageOverride={pendingSave && pendingSave.payload.paymentStatus === 'paid' ? t('statusChange.confirmMessageEditPaid') : undefined}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
