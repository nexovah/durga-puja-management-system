import { useRef, useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, Download, Upload, CheckSquare, Square, MoreVertical, PieChart, Sparkles, Flame, Pencil, ReceiptIndianRupee, Eye, EyeOff } from 'lucide-react';
import { useWidgetsVisible } from '../hooks/useWidgetsVisible';
import { PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Chanda, ChandaCategory, PaymentStatus, PaidMethod, CommitteeInfo, Member, DonationAd, getChandaCreditAmount, User } from '../App';
import { User as UserIcon, Gift, Users as UsersIcon } from 'lucide-react';
import { Donor, CommitteeMember, createDonorRequest } from '../lib/db';
import { donorFullName, DonorFormModal } from './Donors';
import { DashboardDonut } from './DashboardDonut';
import { ReceiptModal } from './ReceiptModal';
import { ToggleSwitch } from './ToggleSwitch';
import { ReceiptSettings } from '../lib/db';
import { diffFields, ActivityFieldChange } from '../lib/db';
import { PageHeading } from './PageHeading';
import { CustomSelect } from './CustomSelect';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField, buildCsv, downloadCsv, ExportColumnDef } from '../lib/csv';
import { ExportColumnSelectorModal } from './ExportColumnSelectorModal';
import { ImportResultsModal, ImportResultsSummary } from './ImportResultsModal';
import { Pagination, usePagination } from './Pagination';
import { SelectAllBanner } from './SelectAllBanner';
import { normalizeKey, prepareImportUpsert } from '../lib/uniqueCheck';
import { ImportPreviewModal, ImportRowError } from './ImportPreviewModal';
import { FormModal, FormModalCancelButton } from './FormModal';
import { RequiredMark } from './RequiredMark';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { StatusChangeConfirmModal } from './StatusChangeConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';
import { SearchToggleButton } from './SearchToggleButton';
import { CollapsibleSearchPanel } from './CollapsibleSearchPanel';
import { useTableColumns, ColumnVisibilityDropdown, SortableTh, DataTableToolbar, ColumnDef } from './TableColumnManager';
import { onlyDigits, isPhoneValid } from '../lib/validation';
import { rankSearchMatches } from '../lib/searchRank';

interface ChandaCollectionProps {
  chandaList: Chanda[];
  setChandaList: (chandaList: Chanda[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'chanda', summary: string, count?: number, changes?: ActivityFieldChange[], recordLabel?: string) => void;
  committeeInfo: CommitteeInfo;
  onUpdateCommitteeInfo: (info: CommitteeInfo) => void;
  isAdmin: boolean;
  receiptSettings: ReceiptSettings;
  tenantSlug: string | null;
  members: Member[];
  donationAdsList: DonationAd[];
  initialAddRequestId?: number;
  // Pre-selects this donor on the Member tab when initialAddRequestId
  // fires — set by Donors.tsx's "Add Collection" deep-link (see
  // DonorDetailModal.tsx), so the collector doesn't have to re-search for
  // the donor they just viewed.
  initialDonorId?: string | null;
  donors: Donor[];
  setDonors: (donors: Donor[]) => void;
  committeeMembers: CommitteeMember[];
  currentUser: User | null;
  users: User[];
}

const CHANDA_FIELD_LABELS: Record<string, string> = {
  donorName: "Donor's Name", category: 'Category', numPersons: 'No. of Persons', amount: 'Amount', amount1: 'Amount 1', amount2: 'Amount 2',
  paidMethod: 'Paid Method', paymentStatus: 'Payment Status', partialAmount: 'Amount Paid So Far',
  date: 'Date', billNumber: 'Bill Number', phone: 'Phone', phone2: 'Phone 2', remarks: 'Remarks',
};

const CHANDA_CATEGORIES: { value: ChandaCategory; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'apartment', label: 'Apartment or Flat' },
  { value: 'shop', label: 'Shop' },
];
const chandaCategoryLabel = (v?: ChandaCategory) => CHANDA_CATEGORIES.find(c => c.value === v)?.label || '—';

const PAYMENT_STATUSES: { value: PaymentStatus; labelKey: TranslationKey }[] = [
  { value: 'paid', labelKey: 'chanda.status.paid' },
  { value: 'pending', labelKey: 'chanda.status.pending' },
  { value: 'partial', labelKey: 'chanda.status.partial' },
  { value: 'rejected', labelKey: 'chanda.status.rejected' },
];

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

export const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

// Simple case-insensitive "does any of these fields contain q" check, used
// by the page's own search bar.
const matches = (parts: (string | number | undefined | null)[], q: string) =>
  parts.some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));

const emptyForm = {
  donorName: '',
  category: '' as ChandaCategory | '',
  numPersons: '',
  amount: '',
  amount1: '',
  amount2: '',
  paidMethod: 'notSelected' as PaidMethod,
  paymentStatus: 'pending' as PaymentStatus,
  partialAmount: '',
  date: new Date().toISOString().split('T')[0],
  billNumber: '',
  phone: '',
  phone2: '',
  remarks: '',
  collectedBy: '',
  donorId: null as string | null,
};

export function ChandaCollection({ chandaList, setChandaList, canEdit, canDelete, canBulkImport, onLog, committeeInfo, onUpdateCommitteeInfo, isAdmin, receiptSettings, tenantSlug, members, donationAdsList, initialAddRequestId, initialDonorId, donors, setDonors, committeeMembers, currentUser, users }: ChandaCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [donorTab, setDonorTab] = useState<'member' | 'thirdParty'>('member');
  const [phoneSameAsContact, setPhoneSameAsContact] = useState(true);
  const [donorQuery, setDonorQuery] = useState('');
  const [quickAddDonorOpen, setQuickAddDonorOpen] = useState(false);

  // Combined searchable pool for the "Member" tab — standing Donors +
  // Committee members, both tenant-wide, reusable across every festival.
  const pickablePeople = useMemo(() => {
    const fromDonors = donors.map(d => ({ id: d.id, name: donorFullName(d), unit: d.unitNo || '', phone: d.phone || '', phone2: '', source: 'donor' as const }));
    const fromCommittee = committeeMembers
      .filter(m => !m.donorId) // standalone committee members not already covered by a donor row
      .map(m => ({ id: m.id, name: [m.firstName, m.lastName].filter(Boolean).join(' ').trim(), unit: '', phone: m.phone || '', phone2: '', source: 'member' as const }));
    return [...fromDonors, ...fromCommittee];
  }, [donors, committeeMembers]);

  const matchingPickablePeople = useMemo(() => {
    return rankSearchMatches(pickablePeople, donorQuery, p => p.name, p => [p.unit]);
  }, [donorQuery, pickablePeople]);

  // Full Donor record for the picked-person card below — gives the
  // collector a quick-glance view (type, no. of persons, phone) without
  // re-typing anything, since this is purely a payment against existing
  // donor data now.
  const pickedDonor = useMemo(() => donors.find(d => d.id === formData.donorId) || null, [donors, formData.donorId]);

  const openAddForm = (presetDonorId?: string | null) => {
    setEditingId(null);
    const preset = presetDonorId ? pickablePeople.find(p => p.id === presetDonorId) : null;
    setFormData({
      ...emptyForm,
      collectedBy: currentUser?.name || '',
      donorId: preset?.id ?? null,
      donorName: preset?.name ?? '',
      phone: preset?.phone ?? '',
    });
    setDonorTab('member');
    setDonorQuery('');
    setPhoneSameAsContact(true);
    setShowForm(true);
  };

  useEffect(() => {
    if (initialAddRequestId && initialAddRequestId > 0) {
      openAddForm(initialDonorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddRequestId]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<{ toInsert: Chanda[]; toUpdate: Chanda[]; errors: ImportRowError[]; totalRows: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [deleteTarget, setDeleteTarget] = useState<Chanda | null>(null);
  const [viewTarget, setViewTarget] = useState<Chanda | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: Omit<Chanda, 'id'>; saveAndAddNew: boolean } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [widgetsVisible, toggleWidgets] = useWidgetsVisible('chanda');
  const menuRef = useRef<HTMLDivElement>(null);
  const [editingAmountLabel, setEditingAmountLabel] = useState<'amount1' | 'amount2' | null>(null);
  const [amountLabelDraft, setAmountLabelDraft] = useState('');
  const [receiptTarget, setReceiptTarget] = useState<Chanda | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const [rowMenuPos, setRowMenuPos] = useState<{ top: number; right: number } | null>(null);
  const rowMenuPortalRef = useRef<HTMLDivElement>(null);
  const [collectedBySuggestOpen, setCollectedBySuggestOpen] = useState(false);
  const [collectedBySuggestPos, setCollectedBySuggestPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const collectedByInputRef = useRef<HTMLInputElement>(null);
  const collectedByListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!rowMenuRef.current?.contains(e.target as Node) && !rowMenuPortalRef.current?.contains(e.target as Node)) setOpenRowMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!collectedBySuggestOpen) { setCollectedBySuggestPos(null); return; }
    if (collectedByInputRef.current) {
      const rect = collectedByInputRef.current.getBoundingClientRect();
      setCollectedBySuggestPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (collectedByListRef.current?.contains(target)) return;
      if (collectedByInputRef.current?.contains(target)) return;
      setCollectedBySuggestOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collectedBySuggestOpen]);

  // Same Member/Donor-badged suggestion pool as DonationAdsCollection's
  // Collected By field — Staff takes priority (so the logged-in user's own
  // name, pre-filled on open, is recognized), then Members, then Donor.
  const collectedByTypeMap = useMemo(() => {
    const map = new Map<string, 'member' | 'donor' | 'staff'>();
    chandaList.forEach(c => { if (c.donorName.trim()) map.set(c.donorName.trim(), 'donor'); });
    donationAdsList.forEach(d => {
      if (d.donorName.trim()) map.set(d.donorName.trim(), 'donor');
      if (d.companyName?.trim()) map.set(d.companyName.trim(), 'donor');
    });
    members.forEach(m => { if (m.name.trim()) map.set(m.name.trim(), 'member'); });
    users.forEach(u => { if (u.name.trim()) map.set(u.name.trim(), 'staff'); });
    return map;
  }, [members, chandaList, donationAdsList, users]);

  const collectedByPool = useMemo(() => [...collectedByTypeMap.keys()], [collectedByTypeMap]);

  const matchingCollectedBy = useMemo(() => {
    return rankSearchMatches(collectedByPool, formData.collectedBy, name => name);
  }, [collectedByPool, formData.collectedBy]);

  // Admin-editable, tenant-wide (stored on committee_info) — falls back to
  // the default translated label when the committee hasn't renamed it.
  const amount1Label = committeeInfo.chandaAmount1Label?.trim() || t('chanda.widget.amount1');
  const amount2Label = committeeInfo.chandaAmount2Label?.trim() || t('chanda.widget.amount2');

  const openAmountLabelEditor = (which: 'amount1' | 'amount2') => {
    setAmountLabelDraft(which === 'amount1' ? amount1Label : amount2Label);
    setEditingAmountLabel(which);
  };
  const saveAmountLabel = () => {
    if (!editingAmountLabel) return;
    const value = amountLabelDraft.trim();
    onUpdateCommitteeInfo({
      ...committeeInfo,
      [editingAmountLabel === 'amount1' ? 'chandaAmount1Label' : 'chandaAmount2Label']: value || undefined,
    });
    setEditingAmountLabel(null);
  };

  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);

  // Amount still owed by donors: full amount for 'pending', the unpaid
  // remainder for 'partial'. 'rejected' is excluded (donor declined to pay).
  const pendingCollection = chandaList.reduce((sum, chanda) => {
    if (chanda.paymentStatus === 'pending') return sum + chanda.amount;
    if (chanda.paymentStatus === 'partial') return sum + Math.max(0, chanda.amount - (chanda.partialAmount || 0));
    return sum;
  }, 0);
  // Grand total billed/mentioned across every entry, regardless of payment
  // status — distinct from totalChanda (what's actually been paid so far).
  const grandTotalAmount = chandaList.reduce((sum, chanda) => sum + chanda.amount, 0);
  // Rejected entries' billed amount counts toward grandTotalAmount but not
  // toward totalChanda/pendingCollection — surfaced as a 3rd donut slice so
  // grandTotalAmount always equals the sum of all slices shown.
  const rejectedAmount = chandaList.reduce((sum, chanda) => (chanda.paymentStatus === 'rejected' ? sum + chanda.amount : sum), 0);

  const totalAmount1 = chandaList.reduce((sum, chanda) => sum + (chanda.amount1 || 0), 0);
  const totalAmount2 = chandaList.reduce((sum, chanda) => sum + (chanda.amount2 || 0), 0);

  // Amount 1 / Amount 2 each get their own "paid so far" figure. A fully
  // paid entry credits each sub-amount in full; a partial entry's single
  // blended partialAmount is split proportionally by each sub-amount's
  // share of the entry's total (e.g. Amount 1 = 60% of the bill -> 60% of
  // whatever was actually paid counts toward Amount 1's paid total).
  const { paidAmount1, paidAmount2 } = chandaList.reduce((acc, chanda) => {
    const a1 = chanda.amount1 || 0;
    const a2 = chanda.amount2 || 0;
    if (a1 + a2 <= 0) return acc;
    let credited = 0;
    if (chanda.paymentStatus === 'paid') credited = chanda.amount;
    else if (chanda.paymentStatus === 'partial') credited = chanda.partialAmount || 0;
    if (credited <= 0) return acc;
    const ratio1 = a1 / (a1 + a2);
    return {
      paidAmount1: acc.paidAmount1 + credited * ratio1,
      paidAmount2: acc.paidAmount2 + credited * (1 - ratio1),
    };
  }, { paidAmount1: 0, paidAmount2: 0 });

  const statusLabel = (status: PaymentStatus) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found ? t(found.labelKey) : status;
  };

  // Accept a payment status from a CSV in any supported language, or its canonical key.
  const normalize = (s: string) => s.trim().toLowerCase();
  const parseStatusInput = (raw: string): PaymentStatus => {
    const value = normalize(raw || '');
    const byValue = PAYMENT_STATUSES.find(s => normalize(s.value) === value);
    if (byValue) return byValue.value;
    for (const status of PAYMENT_STATUSES) {
      for (const lang of Object.values(translations)) {
        if (normalize(lang[status.labelKey]) === value) return status.value;
      }
    }
    return 'paid';
  };

  const paidMethodLabel = (method: PaidMethod) => {
    const found = PAID_METHODS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
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

  // Amount 01 / Amount 02 are an optional breakdown of the main Amount field.
  // Leaving both blank lets Amount work as a single freely-typed value;
  // filling either one makes Amount always reflect their sum.
  const handleSubAmountChange = (field: 'amount1' | 'amount2', value: string) => {
    const next = { ...formData, [field]: value };
    const a1 = field === 'amount1' ? value : formData.amount1;
    const a2 = field === 'amount2' ? value : formData.amount2;
    if (a1.trim() !== '' || a2.trim() !== '') {
      next.amount = ((parseFloat(a1) || 0) + (parseFloat(a2) || 0)).toString();
    }
    setFormData(next);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    if (formData.paidMethod === 'notSelected') {
      setToastType('error');
      setToastMessage(t('validation.fillRequired'));
      return;
    }

    if (donorTab === 'member' && !formData.donorId) {
      setToastType('error');
      setToastMessage(t('committee.pickDonorRequired'));
      return;
    }

    if (!isPhoneValid(formData.phone, false) || !isPhoneValid(formData.phone2, false)) {
      setToastType('error');
      setToastMessage(t('validation.phoneMinDigits'));
      return;
    }

    const billKey = normalizeKey(formData.billNumber);
    if (billKey) {
      const isDuplicate = chandaList.some(c => c.id !== editingId && normalizeKey(c.billNumber) === billKey);
      if (isDuplicate) {
        setToastType('error');
        setToastMessage(t('chanda.billNumberDuplicate'));
        return;
      }
    }

    const payload = {
      donorName: formData.donorName,
      category: formData.category || undefined,
      numPersons: formData.numPersons.trim() !== '' ? parseInt(formData.numPersons, 10) : undefined,
      amount: parseFloat(formData.amount),
      amount1: formData.amount1.trim() !== '' ? parseFloat(formData.amount1) : undefined,
      amount2: formData.amount2.trim() !== '' ? parseFloat(formData.amount2) : undefined,
      paidMethod: formData.paidMethod,
      paymentStatus: formData.paymentStatus,
      partialAmount: formData.paymentStatus === 'partial' ? parseFloat(formData.partialAmount || '0') : undefined,
      date: formData.date,
      billNumber: formData.billNumber,
      phone: formData.phone,
      phone2: donorTab === 'thirdParty' ? (phoneSameAsContact ? formData.phone : formData.phone2) : formData.phone2,
      remarks: formData.remarks,
      collectedBy: formData.collectedBy.trim() || undefined,
      donorId: donorTab === 'member' ? formData.donorId : null,
    };

    // Editing a record that's already Paid — whether changing its status
    // away from Paid, or changing any other field (amount, date, donor
    // name, ...) on a record already recorded as paid — requires the same
    // PIN confirmation as a delete, since Paid means money already
    // changed hands.
    if (editingId) {
      const original = chandaList.find(c => c.id === editingId);
      if (original?.paymentStatus === 'paid') {
        setPendingSave({ payload, saveAndAddNew });
        return;
      }
    }

    commitSave(payload, saveAndAddNew);
  };

  const commitSave = (payload: Omit<Chanda, 'id'>, saveAndAddNew: boolean) => {
    if (editingId) {
      // Edit existing chanda
      const original = chandaList.find(c => c.id === editingId);
      setChandaList(chandaList.map(c =>
        c.id === editingId
          ? { ...c, ...payload }
          : c
      ));
      onLog(
        'update', 'chanda', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`, 1,
        diffFields(original as any, payload as any, CHANDA_FIELD_LABELS),
        payload.donorName
      );
      setToastType('success');
      setToastMessage(t('common.updatedSuccess'));
    } else {
      // Add new chanda
      const newChanda: Chanda = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setChandaList([...chandaList, newChanda]);
      onLog('create', 'chanda', `${payload.donorName} — ₹${payload.amount.toLocaleString()}`, 1, undefined, payload.donorName);
      setToastType('success');
      setToastMessage(t('common.savedSuccess'));
    }

    const wasEditing = editingId;
    setFormData(emptyForm);
    setPhoneSameAsContact(true);
    setEditingId(null);
    setShowForm(saveAndAddNew && !wasEditing);
  };

  const confirmStatusChange = () => {
    if (!pendingSave) return;
    commitSave(pendingSave.payload, pendingSave.saveAndAddNew);
    setPendingSave(null);
  };

  const handleEdit = (chanda: Chanda) => {
    setFormData({
      donorName: chanda.donorName,
      category: chanda.category || '',
      numPersons: chanda.numPersons !== undefined ? String(chanda.numPersons) : '',
      amount: chanda.amount.toString(),
      amount1: chanda.amount1 !== undefined ? chanda.amount1.toString() : '',
      amount2: chanda.amount2 !== undefined ? chanda.amount2.toString() : '',
      paidMethod: chanda.paidMethod || 'notSelected',
      paymentStatus: chanda.paymentStatus || 'paid',
      partialAmount: chanda.partialAmount !== undefined ? chanda.partialAmount.toString() : '',
      date: chanda.date,
      billNumber: chanda.billNumber || '',
      phone: chanda.phone,
      phone2: chanda.phone2 || '',
      remarks: chanda.remarks,
      collectedBy: chanda.collectedBy || '',
      donorId: chanda.donorId || null,
    });
    setDonorTab(chanda.donorId ? 'member' : 'thirdParty');
    setDonorQuery('');
    setPhoneSameAsContact(!chanda.phone2 || chanda.phone2 === chanda.phone);
    setEditingId(chanda.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    const target = chandaList.find(c => c.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setChandaList(chandaList.filter(c => c.id !== deleteTarget.id));
    onLog('delete', 'chanda', `${deleteTarget.donorName} — ₹${deleteTarget.amount.toLocaleString()}`, 1, undefined, deleteTarget.donorName);
    setDeleteTarget(null);
    setToastType('success');
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setPhoneSameAsContact(true);
    setShowForm(false);
    setEditingId(null);
  };

  const chandaExportColumns: ExportColumnDef<Chanda>[] = [
    { id: 'donorName', label: t('chanda.csv.donorName'), value: c => c.donorName },
    { id: 'amount', label: t('chanda.csv.amount'), value: c => c.amount },
    { id: 'amount1', label: amount1Label, value: c => c.amount1 ?? '' },
    { id: 'amount2', label: amount2Label, value: c => c.amount2 ?? '' },
    { id: 'paidMethod', label: t('common.paidMethod'), value: c => paidMethodLabel(c.paidMethod || 'notSelected') },
    { id: 'paymentStatus', label: t('chanda.csv.status'), value: c => statusLabel(c.paymentStatus || 'paid') },
    { id: 'partialAmount', label: t('chanda.csv.partialAmount'), value: c => c.paymentStatus === 'partial' ? (c.partialAmount || 0) : '' },
    { id: 'date', label: t('chanda.csv.date'), value: c => c.date },
    { id: 'billNumber', label: t('chanda.csv.billNumber'), value: c => c.billNumber || '' },
    { id: 'phone1', label: t('chanda.csv.phone'), value: c => c.phone },
    { id: 'phone2', label: t('chanda.csv.phone2'), value: c => c.phone2 || '' },
    { id: 'remarks', label: t('chanda.csv.remarks'), value: c => c.remarks },
    { id: 'receiptNumber', label: t('chanda.digitalReceipt'), value: c => c.receiptNumber || '' },
  ];

  const [exportModal, setExportModal] = useState<{ rows: Chanda[]; suffix: string } | null>(null);

  const handleExport = () => {
    setExportModal({ rows: chandaList, suffix: 'all' });
  };

  const handleExportSelected = () => {
    const selected = chandaList.filter(c => selectedIds.has(c.id));
    setExportModal({ rows: selected, suffix: 'selected' });
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

      // Skip a header row if the first cell isn't a positive number (amount column)
      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Chanda[] = [];
      const rowErrors: ImportRowError[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const lineNum = i - firstDataRow + 1;
        const [donorName, amountRaw, amount1Raw, amount2Raw, paidMethodRaw, statusRaw, partialAmountRaw, date, billNumber, phone, phone2, remarks] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!donorName) {
          rowErrors.push({ line: lineNum, reason: 'Donor name is required' });
          continue;
        }
        if (isNaN(amount)) {
          rowErrors.push({ line: lineNum, reason: 'Amount could not be read as a number' });
          continue;
        }

        const paymentStatus = parseStatusInput(statusRaw || '');
        const partialAmount = paymentStatus === 'partial'
          ? parseFloat((partialAmountRaw || '0').replace(/,/g, '')) || 0
          : undefined;
        const amount1 = (amount1Raw || '').trim() !== '' ? parseFloat((amount1Raw || '').replace(/,/g, '')) : undefined;
        const amount2 = (amount2Raw || '').trim() !== '' ? parseFloat((amount2Raw || '').replace(/,/g, '')) : undefined;

        imported.push({
          id: crypto.randomUUID(),
          donorName: donorName.trim(),
          amount,
          amount1,
          amount2,
          paidMethod: parsePaidMethodInput(paidMethodRaw || ''),
          paymentStatus,
          partialAmount,
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          billNumber: (billNumber || '').trim(),
          phone: (phone || '').trim(),
          phone2: (phone2 || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      const { toInsert, toUpdate } = prepareImportUpsert(imported, (row) => row.billNumber, chandaList);
      setImportPreview({ toInsert, toUpdate, errors: rowErrors, totalRows: rows.length - firstDataRow });
    };
    reader.readAsText(file);
  };

  const [importResults, setImportResults] = useState<ImportResultsSummary | null>(null);

  const handleConfirmImport = () => {
    if (!importPreview) return;
    const { toInsert, toUpdate, errors, totalRows } = importPreview;
    const updatedIds = new Set(toUpdate.map(r => r.id));
    const merged = chandaList.map(c => (updatedIds.has(c.id) ? toUpdate.find(u => u.id === c.id)! : c));
    setChandaList([...merged, ...toInsert]);
    const count = toInsert.length + toUpdate.length;
    onLog('bulk_import', 'chanda', `${t('common.importResult')}: ${count} (${toInsert.length} new, ${toUpdate.length} updated)`, count);
    setImportPreview(null);
    setImportResults({ totalRows, importedCount: count, insertedCount: toInsert.length, updatedCount: toUpdate.length, errors });
  };

  const isPartial = formData.paymentStatus === 'partial';

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredChanda = chandaList.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (q && !matches([c.donorName, c.phone, c.phone2, c.remarks, c.billNumber, c.amount, c.receiptNumber], q)) return false;

    const f = appliedFilters;
    if (f.amountMin && c.amount < parseFloat(f.amountMin)) return false;
    if (f.amountMax && c.amount > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && normalizeKey(c.billNumber) !== f.billVoucher.trim().toLowerCase()) return false;
    if (f.status && c.paymentStatus !== f.status) return false;
    if (f.paidMethod && c.paidMethod !== f.paidMethod) return false;
    if (f.designation && c.category !== f.designation) return false;
    if (f.phone && !(c.phone || '').includes(f.phone.trim()) && !(c.phone2 || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && new Date(c.date).getTime() < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo && new Date(c.date).getTime() > new Date(f.dateTo).getTime()) return false;
    return true;
  });

  const chandaColumns: ColumnDef<Chanda>[] = useMemo(() => [
    // Default-visible set confirmed by the user: Donor's Name, Amount,
    // Digital Receipt, Bill Number, Payment Status, Date, Phone Number.
    // Everything else starts hidden (defaultVisible: false), toggleable
    // via the existing column-settings panel.
    { id: 'donorName', label: t('chanda.donorName'), required: true, sortValue: c => c.donorName },
    { id: 'category', label: t('chanda.category'), defaultVisible: false, sortValue: c => chandaCategoryLabel(c.category) },
    { id: 'amount', label: t('common.amount'), align: 'left', sortValue: c => c.amount },
    { id: 'billNumber', label: t('chanda.billNumber'), sortValue: c => c.billNumber || '' },
    { id: 'paidMethod', label: t('common.paidMethod'), defaultVisible: false, sortValue: c => paidMethodLabel(c.paidMethod || 'notSelected') },
    { id: 'paymentStatus', label: t('chanda.paymentStatus'), sortValue: c => c.paymentStatus || 'paid' },
    { id: 'date', label: t('common.date'), sortValue: c => c.date },
    { id: 'receiptNumber', label: t('chanda.digitalReceipt'), sortValue: c => c.receiptNumber || '' },
    { id: 'phone1', label: t('chanda.phone1'), sortValue: c => c.phone || '' },
    { id: 'phone2', label: t('chanda.phone2'), defaultVisible: false, sortValue: c => c.phone2 || '' },
    { id: 'remarks', label: t('common.remarks'), defaultVisible: false, sortValue: c => c.remarks || '' },
    ...((canEdit || canDelete) ? [{ id: 'actions', label: t('common.action'), required: true, sortable: false, align: 'right' as const }] : []),
  ], [t, canEdit, canDelete]);

  const tableCols = useTableColumns<Chanda>({
    tableId: 'chanda',
    columns: chandaColumns,
    defaultSort: { columnId: 'date', direction: 'desc' },
  });

  const sortedChanda = useMemo(() => tableCols.sortItems(filteredChanda), [tableCols, filteredChanda]);
  const pagination = usePagination(sortedChanda);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3 page-actions-row">
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
                onClick={openAddForm}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('chanda.addNew')}
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
                  {canEdit && (
                    <button
                      onClick={() => { setMenuOpen(false); handleExport(); }}
                      className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Download size={16} /> {t('common.export')}
                    </button>
                  )}
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
        {t('chanda.pageTitle')}
      </PageHeading>

      <CollapsibleSearchPanel open={showSearch}>
        <TableSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder={t('chanda.searchPlaceholder')}
          filters={draftFilters}
          onFiltersChange={setDraftFilters}
          onSearch={() => setAppliedFilters(draftFilters)}
          onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
          filtersActive={hasActiveTableFilters(appliedFilters)}
          resultCount={filteredChanda.length}
          totalCount={chandaList.length}
          showAmount
          showBillVoucher
          billVoucherLabel={t('chanda.billNumber')}
          statusOptions={PAYMENT_STATUSES.map(s => ({ value: s.value, label: t(s.labelKey) }))}
          paidMethodOptions={PAID_METHODS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
          designationOptions={CHANDA_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          designationLabel={t('chanda.category')}
          showDateRange
          showPhone
        />
      </CollapsibleSearchPanel>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('chanda.editChanda') : t('chanda.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="chanda-form"
              className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="chanda-form"
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
          <form id="chanda-form" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 flex rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-1 gap-1">
              <button
                type="button"
                onClick={() => { setDonorTab('member'); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${donorTab === 'member' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <UsersIcon size={15} /> {t('chanda.memberTab')}
              </button>
              <button
                type="button"
                onClick={() => { setDonorTab('thirdParty'); setFormData(f => ({ ...f, donorId: null })); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${donorTab === 'thirdParty' ? 'bg-white dark:bg-gray-900 text-orange-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <UserIcon size={15} /> {t('chanda.thirdPartyTab')}
              </button>
            </div>

            {donorTab === 'member' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('committee.pickMember')}</label>
                {formData.donorId && formData.donorName ? (
                  <div className="flex items-start justify-between gap-3 px-4 py-3 border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 rounded-lg">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {formData.donorName.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {pickedDonor?.unitNo ? `${pickedDonor.unitNo} · ` : ''}{formData.donorName}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {[
                            pickedDonor ? (pickedDonor.type === 'owner' ? t('donors.owner') : t('donors.tenant')) : null,
                            pickedDonor?.numPersons !== null && pickedDonor?.numPersons !== undefined ? `${pickedDonor.numPersons} ${t('donors.numPersons')}` : null,
                            formData.phone || null,
                          ].filter(Boolean).map((part, i) => (
                            <span key={i} className="flex items-center gap-1.5">
                              {i > 0 && <span className="text-gray-400 dark:text-gray-600">·</span>}
                              {part}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setFormData(f => ({ ...f, donorId: null, donorName: '', phone: '', phone2: '' }))} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={donorQuery}
                      onChange={(e) => setDonorQuery(e.target.value)}
                      placeholder={t('committee.searchFlatName')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                    {matchingPickablePeople.length > 0 && (
                      <div className="mt-1.5 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        {matchingPickablePeople.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setFormData(f => ({ ...f, donorId: p.id, donorName: p.name, phone: p.phone })); setDonorQuery(''); }}
                            className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left hover:bg-orange-50 dark:hover:bg-orange-500/10"
                          >
                            <span className="text-gray-800 dark:text-gray-200 truncate">{p.name}{p.unit ? ` · ${p.unit}` : ''}</span>
                            <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${p.source === 'donor' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'}`}>
                              {p.source === 'donor' ? t('donationAds.collectedByDonor') : t('donationAds.collectedByMember')}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setQuickAddDonorOpen(true)}
                      className="mt-2 text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5"
                    >
                      <UserIcon size={14} /> {t('chanda.notInListAddMember')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {donorTab === 'thirdParty' && (
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.donorName')}<RequiredMark /></label>
                <input
                  type="text"
                  required
                  value={formData.donorName}
                  onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.donorNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.numPersons')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.numPersons}
                  onChange={(e) => setFormData({ ...formData, numPersons: onlyDigits(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.numPersonsPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.category')}</label>
                <CustomSelect
                  value={formData.category}
                  onChange={(v) => setFormData({ ...formData, category: v as ChandaCategory | '' })}
                  placeholder={t('search.any')}
                  options={CHANDA_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
                />
              </div>
            </div>
            )}

            <div className="md:col-span-2 grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.amountLabel')}<RequiredMark /></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.amountPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{amount1Label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount1}
                  onChange={(e) => handleSubAmountChange('amount1', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.amountPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{amount2Label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.amount2}
                  onChange={(e) => handleSubAmountChange('amount2', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.amountPlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.paidMethod')}<RequiredMark /></label>
              <CustomSelect
                value={formData.paidMethod}
                onChange={(v) => setFormData({ ...formData, paidMethod: v as PaidMethod })}
                options={PAID_METHODS.filter(m => m.value !== 'notSelected').map((m) => ({ value: m.value, label: t(m.labelKey) }))}
                placeholder={t('common.paidMethod.notSelected')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.paymentStatus')}<RequiredMark /></label>
              <CustomSelect
                value={formData.paymentStatus}
                onChange={(v) => setFormData({ ...formData, paymentStatus: v as PaymentStatus })}
                options={PAYMENT_STATUSES.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
              />
            </div>

            {isPartial && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.partialAmountLabel')}<RequiredMark /></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  max={formData.amount || undefined}
                  value={formData.partialAmount}
                  onChange={(e) => setFormData({ ...formData, partialAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.partialAmountPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.date')}<RequiredMark /></label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('chanda.billNumber')}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.billNumber}
                onChange={(e) => setFormData({ ...formData, billNumber: onlyDigits(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.billNumberPlaceholder')}
              />
            </div>
            {donorTab === 'thirdParty' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donors.contact')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: onlyDigits(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            )}
            {donorTab === 'thirdParty' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('donors.whatsapp')}</label>
                <ToggleSwitch checked={phoneSameAsContact} onChange={setPhoneSameAsContact} label={t('donors.sameAsContact')} />
              </div>
              <input
                type="tel"
                value={phoneSameAsContact ? formData.phone : formData.phone2}
                disabled={phoneSameAsContact}
                onChange={(e) => setFormData({ ...formData, phone2: onlyDigits(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:opacity-60"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            )}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('donationAds.collectedBy')}</label>
              <input
                ref={collectedByInputRef}
                type="text"
                autoComplete="off"
                value={formData.collectedBy}
                onChange={(e) => { setFormData({ ...formData, collectedBy: e.target.value }); setCollectedBySuggestOpen(true); }}
                onFocus={() => setCollectedBySuggestOpen(true)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.collectedByPlaceholder')}
              />
              {collectedBySuggestOpen && collectedBySuggestPos && matchingCollectedBy.length > 0 && createPortal(
                <div
                  ref={collectedByListRef}
                  style={{ position: 'fixed', top: collectedBySuggestPos.top, left: collectedBySuggestPos.left, width: collectedBySuggestPos.width }}
                  className="z-[200] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-56 overflow-y-auto">
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
                            : type === 'staff'
                            ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {type === 'member' || type === 'staff' ? <UserIcon size={14} /> : <Gift size={14} />}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">{name}</span>
                        {type && (
                          <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                            type === 'member'
                              ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                              : type === 'staff'
                              ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                              : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                          }`}>
                            {type === 'member' ? t('donationAds.collectedByMember') : type === 'staff' ? t('chanda.collectedByStaff') : t('donationAds.collectedByDonor')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.remarksPlaceholder')}
                rows={2}
              />
            </div>
          </form>
      </FormModal>

      {/* Widgets — grand total + paid/pending/rejected donut, and a merged
          Amount 1 / Amount 2 card each with its own paid-so-far figure.
          Shown/hidden via the page menu's "Hide widgets"/"View widgets"
          toggle, persisted per-page in localStorage. */}
      {widgetsVisible && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
          <DashboardDonut
            title={t('chanda.widget.total')}
            icon={PieChart}
            iconAccent="text-green-600"
            compact
            grandTotal={{ label: t('chanda.widget.grandTotal'), value: grandTotalAmount }}
            slices={[
              { name: t('chanda.widget.paid'), value: totalChanda },
              { name: t('chanda.widget.pending'), value: pendingCollection },
              { name: t('chanda.status.rejected'), value: rejectedAmount },
            ]}
            colors={['#16a34a', '#f59e0b', '#ef4444']}
            emptyMessage={t('chanda.widget.noData')}
          />
          <div className="flex flex-col gap-4 sm:gap-6">
            <AmountMiniDonutCard
              title={amount1Label}
              icon={Sparkles}
              iconAccent="text-orange-500"
              total={totalAmount1}
              paid={paidAmount1}
              paidLabel={t('chanda.widget.paidCollection')}
              remainingLabel={t('chanda.widget.remaining')}
              valueColor="text-orange-600"
              color="#f97316"
              onEditTitle={isAdmin ? () => openAmountLabelEditor('amount1') : undefined}
            />
            <AmountMiniDonutCard
              title={amount2Label}
              icon={Flame}
              iconAccent="text-red-500"
              total={totalAmount2}
              paid={paidAmount2}
              paidLabel={t('chanda.widget.paidCollection')}
              remainingLabel={t('chanda.widget.remaining')}
              valueColor="text-red-600"
              color="#ef4444"
              onEditTitle={isAdmin ? () => openAmountLabelEditor('amount2') : undefined}
            />
          </div>
        </div>
      )}

      {/* Chanda List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
        <DataTableToolbar
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          activeSortLabel={tableCols.activeSortColumn?.label}
          sortDirection={tableCols.sortState.direction}
          onResetSort={tableCols.resetSort}
          columnDropdown={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectMode(m => !m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all shadow-sm ${
                  selectMode
                    ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-400'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750'
                }`}
              >
                {selectMode ? <CheckSquare size={15} className="shrink-0" /> : <Square size={15} className="shrink-0" />}
                <span>{t('table.select')}</span>
              </button>
              {canEdit && selectMode && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleExportSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-orange-300 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all shadow-sm"
                >
                  <Download size={15} className="shrink-0" />
                  <span>{t('table.exportSelected')} ({selectedIds.size})</span>
                </button>
              )}
              <ColumnVisibilityDropdown
                columns={tableCols.columns}
                isColumnVisible={tableCols.isColumnVisible}
                toggleColumn={tableCols.toggleColumn}
                showAllColumns={tableCols.showAllColumns}
                resetColumns={tableCols.resetColumns}
                hasCustomVisibility={tableCols.hasCustomVisibility}
                hiddenCount={tableCols.hiddenCount}
              />
            </div>
          }
        />
        {selectMode && (
          <SelectAllBanner
            pageSelectedCount={pagination.pageItems.filter(c => selectedIds.has(c.id)).length}
            totalSelectedCount={selectedIds.size}
            totalFilteredCount={sortedChanda.length}
            onSelectAllFiltered={() => setSelectedIds(new Set(sortedChanda.map(c => c.id)))}
            onClear={() => setSelectedIds(new Set())}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {selectMode && (
                  <th className="px-4 py-3 w-10 text-left">
                    <input
                      type="checkbox"
                      checked={pagination.pageItems.length > 0 && pagination.pageItems.every(c => selectedIds.has(c.id))}
                      ref={(el) => {
                        if (el) {
                          const someChecked = pagination.pageItems.some(c => selectedIds.has(c.id));
                          const allChecked = pagination.pageItems.length > 0 && pagination.pageItems.every(c => selectedIds.has(c.id));
                          el.indeterminate = someChecked && !allChecked;
                        }
                      }}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) {
                          pagination.pageItems.forEach(c => next.add(c.id));
                        } else {
                          pagination.pageItems.forEach(c => next.delete(c.id));
                        }
                        setSelectedIds(next);
                      }}
                      className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                )}
                {tableCols.isColumnVisible('donorName') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'donorName')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('category') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'category')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('amount') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'amount')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('billNumber') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'billNumber')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paidMethod') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'paidMethod')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('paymentStatus') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'paymentStatus')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('date') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'date')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('receiptNumber') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'receiptNumber')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('phone1') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'phone1')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('phone2') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'phone2')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {tableCols.isColumnVisible('remarks') && (
                  <SortableTh column={chandaColumns.find(c => c.id === 'remarks')!} sortState={tableCols.sortState} onSort={tableCols.toggleSort} />
                )}
                {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                  <th className="sticky right-0 z-10 px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)]">{t('common.action')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((chanda) => {
                const status = chanda.paymentStatus || 'paid';
                return (
                  <tr key={chanda.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    {selectMode && (
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(chanda.id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(chanda.id);
                            else next.delete(chanda.id);
                            setSelectedIds(next);
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-orange-600 focus:ring-orange-500"
                        />
                      </td>
                    )}
                    {tableCols.isColumnVisible('donorName') && (
                      <td className="px-6 py-4 text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => setViewTarget(chanda)}
                          className="text-orange-600 hover:text-orange-700 hover:underline text-left block"
                        >
                          {chanda.donorName}
                        </button>
                        {chanda.numPersons !== undefined && (
                          <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
                            {t('chanda.numPersonsShort').replace('{count}', String(chanda.numPersons))}
                          </span>
                        )}
                      </td>
                    )}
                    {tableCols.isColumnVisible('category') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {chanda.category ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {chandaCategoryLabel(chanda.category)}
                          </span>
                        ) : '-'}
                      </td>
                    )}
                    {tableCols.isColumnVisible('amount') && (
                      <td className={`px-6 py-4 text-sm font-bold ${
                        status === 'rejected'
                          ? 'text-red-600 line-through'
                          : status === 'partial' || status === 'pending'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}>₹{chanda.amount.toLocaleString()}</td>
                    )}
                    {tableCols.isColumnVisible('billNumber') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.billNumber || '-'}</td>
                    )}
                    {tableCols.isColumnVisible('paidMethod') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{paidMethodLabel(chanda.paidMethod || 'notSelected')}</td>
                    )}
                    {tableCols.isColumnVisible('paymentStatus') && (
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                          {statusLabel(status)}
                        </span>
                        {status === 'partial' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ₹{(chanda.partialAmount || 0).toLocaleString()} / ₹{chanda.amount.toLocaleString()}
                          </div>
                        )}
                      </td>
                    )}
                    {tableCols.isColumnVisible('date') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(chanda.date).toLocaleDateString(locale)}
                      </td>
                    )}
                    {tableCols.isColumnVisible('receiptNumber') && (
                      <td className="px-6 py-4 text-sm">
                        {chanda.receiptNumber ? (
                          <button
                            type="button"
                            onClick={() => setReceiptTarget(chanda)}
                            className="text-sm text-orange-600 hover:text-orange-700 hover:underline font-medium"
                          >
                            {chanda.receiptNumber}
                          </button>
                        ) : '-'}
                      </td>
                    )}
                    {tableCols.isColumnVisible('phone1') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.phone || '-'}</td>
                    )}
                    {tableCols.isColumnVisible('phone2') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.phone2 || '-'}</td>
                    )}
                    {tableCols.isColumnVisible('remarks') && (
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{chanda.remarks || '-'}</td>
                    )}
                    {(canEdit || canDelete) && tableCols.isColumnVisible('actions') && (
                      <td className={`sticky right-0 px-6 py-4 text-right bg-white dark:bg-gray-900 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.08)] ${openRowMenuId === chanda.id ? 'z-30' : 'z-10'}`}>
                        <div className="relative inline-block" ref={openRowMenuId === chanda.id ? rowMenuRef : undefined}>
                          <button
                            onClick={(e) => {
                              if (openRowMenuId === chanda.id) { setOpenRowMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setRowMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                              setOpenRowMenuId(chanda.id);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openRowMenuId === chanda.id && rowMenuPos && createPortal(
                            <div ref={rowMenuPortalRef} style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right }} className="w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-[200]">
                              {canEdit && (
                                <button
                                  onClick={() => { setOpenRowMenuId(null); handleEdit(chanda); }}
                                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  <Edit2 size={15} className="text-gray-400" />
                                  Edit Collection
                                </button>
                              )}
                              {chanda.receiptNumber && (
                                <button
                                  onClick={() => { setOpenRowMenuId(null); setReceiptTarget(chanda); }}
                                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                  <ReceiptIndianRupee size={15} className="text-orange-600" />
                                  View Receipt
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => { setOpenRowMenuId(null); handleDelete(chanda.id); }}
                                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 size={15} />
                                  Delete
                                </button>
                              )}
                            </div>,
                            document.body
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {filteredChanda.length > 0 && tableCols.isColumnVisible('amount') && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-950 border-t-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                  <td
                    colSpan={['donorName', 'category'].filter(id => tableCols.isColumnVisible(id)).length + (selectMode ? 1 : 0) || 1}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right"
                  >
                    {t('common.total')}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-green-600">
                    ₹{filteredChanda.reduce((sum, c) => sum + getChandaCreditAmount(c), 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                  <td
                    colSpan={['donorName', 'category'].filter(id => tableCols.isColumnVisible(id)).length + (selectMode ? 1 : 0) || 1}
                    className="px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right"
                  >
                    {t('common.totalPending')}
                  </td>
                  <td className="px-6 py-3 text-sm font-bold text-yellow-600">
                    ₹{filteredChanda.reduce((sum, c) => {
                      if (c.paymentStatus === 'pending') return sum + c.amount;
                      if (c.paymentStatus === 'partial') return sum + Math.max(0, c.amount - (c.partialAmount || 0));
                      return sum;
                    }, 0).toLocaleString()}
                  </td>
                  <td colSpan={100} />
                </tr>
              </tfoot>
            )}
          </table>
          {filteredChanda.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('chanda.empty')}
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

      <ImportResultsModal
        open={!!importResults}
        summary={importResults}
        onClose={() => setImportResults(null)}
      />

      <ExportColumnSelectorModal
        open={!!exportModal}
        columns={chandaExportColumns.map(c => ({ id: c.id, label: c.label }))}
        storageKey="puja_export_cols_chanda"
        onClose={() => setExportModal(null)}
        onExport={orderedIds => {
          if (!exportModal) return;
          const csvContent = buildCsv(exportModal.rows, chandaExportColumns, orderedIds);
          downloadCsv(csvContent, `chanda-collection-${exportModal.suffix}-${new Date().toISOString().split('T')[0]}.csv`);
        }}
      />

      {quickAddDonorOpen && (
        <DonorFormModal
          donor={null}
          onCancel={() => setQuickAddDonorOpen(false)}
          onSave={async (input) => {
            const created = await createDonorRequest(input);
            setDonors([...donors, created]);
            setFormData(f => ({ ...f, donorId: created.id, donorName: donorFullName(created), phone: created.phone || '' }));
            setQuickAddDonorOpen(false);
          }}
        />
      )}

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} type={toastType} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.donorName || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const c = viewTarget; setViewTarget(null); handleEdit(c); } : undefined}
        fields={viewTarget ? [
          { label: t('chanda.donorName'), value: viewTarget.donorName },
          { label: t('chanda.numPersons'), value: viewTarget.numPersons !== undefined ? String(viewTarget.numPersons) : '-' },
          { label: t('chanda.category'), value: chandaCategoryLabel(viewTarget.category) },
          {
            label: t('chanda.amountLabel'),
            value: `₹${viewTarget.amount.toLocaleString()}`,
            valueClassName: `font-bold ${
              (viewTarget.paymentStatus || 'paid') === 'rejected'
                ? 'text-red-600 line-through'
                : (viewTarget.paymentStatus || 'paid') === 'partial' || (viewTarget.paymentStatus || 'paid') === 'pending'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`,
          },
          { label: t('common.paidMethod'), value: paidMethodLabel(viewTarget.paidMethod || 'notSelected') },
          {
            label: t('chanda.paymentStatus'),
            value: (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[viewTarget.paymentStatus || 'paid']}`}>
                {statusLabel(viewTarget.paymentStatus || 'paid')}
              </span>
            ),
          },
          ...(viewTarget.paymentStatus === 'partial' ? [{
            label: t('chanda.partialAmountLabel'),
            value: `₹${(viewTarget.partialAmount || 0).toLocaleString()} / ₹${viewTarget.amount.toLocaleString()}`,
          }] : []),
          { label: t('common.date'), value: new Date(viewTarget.date).toLocaleDateString(locale) },
          { label: t('chanda.billNumber'), value: viewTarget.billNumber || '-' },
          { label: t('chanda.phone1'), value: viewTarget.phone || '-' },
          { label: t('chanda.phone2'), value: viewTarget.phone2 || '-' },
          { label: t('common.remarks'), value: viewTarget.remarks || '-', fullWidth: true },
        ] : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.donorName}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StatusChangeConfirmModal
        open={!!pendingSave}
        itemLabel={pendingSave?.payload.donorName}
        fromStatusLabel={statusLabel('paid')}
        toStatusLabel={pendingSave ? statusLabel(pendingSave.payload.paymentStatus) : ''}
        messageOverride={pendingSave && pendingSave.payload.paymentStatus === 'paid' ? t('statusChange.confirmMessageEditPaid') : undefined}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmStatusChange}
      />

      <FormModal
        open={!!editingAmountLabel}
        title={t('chanda.editAmountLabel')}
        onClose={() => setEditingAmountLabel(null)}
        footer={
          <>
            <FormModalCancelButton onClick={() => setEditingAmountLabel(null)} label={t('common.cancel')} />
            <button
              type="button"
              onClick={saveAmountLabel}
              className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        <input
          type="text"
          autoFocus
          value={amountLabelDraft}
          onChange={(e) => setAmountLabelDraft(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          placeholder={editingAmountLabel === 'amount1' ? t('chanda.widget.amount1') : t('chanda.widget.amount2')}
        />
      </FormModal>

      {receiptTarget && (
        <ReceiptModal
          chanda={receiptTarget}
          committeeInfo={committeeInfo}
          receiptSettings={receiptSettings}
          tenantSlug={tenantSlug}
          onClose={() => setReceiptTarget(null)}
        />
      )}
    </div>
  );
}

// Amount 01/02 widgets: half-height row cards (together matching the Total
// Collection donut's height) with a small paid-vs-remaining donut on the
// right of the value, one per sub-amount.
function AmountMiniDonutCard({
  title, icon: Icon, iconAccent, total, paid, paidLabel, remainingLabel, valueColor, color, onEditTitle,
}: {
  title: string; icon: typeof Sparkles; iconAccent: string; total: number; paid: number; paidLabel: string; remainingLabel: string; valueColor: string; color: string; onEditTitle?: () => void;
}) {
  const remaining = Math.max(0, total - paid);
  const data = [
    { name: paidLabel, value: Math.round(paid) },
    { name: remainingLabel, value: Math.round(remaining) },
  ].filter(d => d.value > 0);

  return (
    <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={iconAccent} size={18} />
        <h3 className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-200">{title}</h3>
        {onEditTitle && (
          <button
            type="button"
            onClick={onEditTitle}
            className="text-gray-400 hover:text-orange-600 dark:text-gray-500 dark:hover:text-orange-400 transition-colors"
            title="Rename"
          >
            <Pencil size={13} />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className={`text-xl sm:text-2xl font-bold ${valueColor}`}>₹{total.toLocaleString()}</p>
        {data.length > 0 && (
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="100%" paddingAngle={2}>
                  <Cell fill={color} />
                  <Cell fill="#e5e7eb" />
                </Pie>
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString()}`} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-1 h-4 rounded shrink-0" style={{ background: color }} />
            <span className="text-gray-600 dark:text-gray-400 truncate">{paidLabel}</span>
          </div>
          <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
            ₹{Math.round(paid).toLocaleString()} <span className="text-gray-400 dark:text-gray-500 font-normal">({total > 0 ? Math.round((paid / total) * 100) : 0}%)</span>
          </span>
        </div>
        {remaining > 0 && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-1 h-4 rounded shrink-0 bg-gray-300 dark:bg-gray-600" />
              <span className="text-gray-600 dark:text-gray-400 truncate">{remainingLabel}</span>
            </div>
            <span className="text-gray-800 dark:text-gray-200 font-semibold shrink-0 ml-2">
              ₹{Math.round(remaining).toLocaleString()} <span className="text-gray-400 dark:text-gray-500 font-normal">({total > 0 ? Math.round((remaining / total) * 100) : 0}%)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
