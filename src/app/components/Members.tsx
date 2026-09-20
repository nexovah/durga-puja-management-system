import { useState } from 'react';
import { Plus, Edit2, Trash2, X, ChevronDown, IndianRupee, Users } from 'lucide-react';
import { Member, PaymentStatus, PaidMethod, Task, TaskPriority, getMemberCreditAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { Pagination, usePagination } from './Pagination';
import { FormModal } from './FormModal';
import { Toast } from './Toast';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { StatusChangeConfirmModal } from './StatusChangeConfirmModal';
import { ViewModal } from './ViewModal';
import { TableSearchBar, TableSearchFilters, emptyTableSearchFilters, hasActiveTableFilters } from './TableSearchBar';

interface MembersProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
  tasksList: Task[];
  canEdit: boolean;
  canDelete: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'members', summary: string, count?: number) => void;
}

interface MemberFormPayload {
  name: string;
  phone: string;
  address: string;
  role: string;
  membershipAmount?: number;
  membershipPaidMethod?: PaidMethod;
  membershipPaymentStatus?: PaymentStatus;
  membershipPartialAmount?: number;
  membershipDate?: string;
  membershipBillNumber?: string;
  membershipRemarks?: string;
}

const TASK_PRIORITY_DOT: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
  note: 'bg-purple-500',
};

const ROLES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'president', labelKey: 'members.role.president' },
  { value: 'vicePresident', labelKey: 'members.role.vicePresident' },
  { value: 'secretary', labelKey: 'members.role.secretary' },
  { value: 'assistantSecretary', labelKey: 'members.role.assistantSecretary' },
  { value: 'treasurer', labelKey: 'members.role.treasurer' },
  { value: 'executiveMember', labelKey: 'members.role.executiveMember' },
  { value: 'advisoryPatron', labelKey: 'members.role.advisoryPatron' },
  { value: 'volunteer', labelKey: 'members.role.volunteer' },
];

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

const emptyForm = {
  name: '',
  phone: '',
  address: '',
  role: '',
  membershipAmount: '',
  membershipPaidMethod: 'notSelected' as PaidMethod,
  membershipPaymentStatus: 'paid' as PaymentStatus,
  membershipPartialAmount: '',
  membershipDate: new Date().toISOString().split('T')[0],
  membershipBillNumber: '',
  membershipRemarks: '',
};

export function Members({ members, setMembers, tasksList, canEdit, canDelete, onLog }: MembersProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [showMembershipPayment, setShowMembershipPayment] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [viewTarget, setViewTarget] = useState<Member | null>(null);
  const [pendingSave, setPendingSave] = useState<{ payload: MemberFormPayload; saveAndAddNew: boolean } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const saveAndAddNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'andNew';

    const hasMembershipAmount = formData.membershipAmount.trim() !== '';
    const membershipPayload = hasMembershipAmount
      ? {
          membershipAmount: parseFloat(formData.membershipAmount) || 0,
          membershipPaidMethod: formData.membershipPaidMethod,
          membershipPaymentStatus: formData.membershipPaymentStatus,
          membershipPartialAmount: formData.membershipPaymentStatus === 'partial'
            ? parseFloat(formData.membershipPartialAmount || '0')
            : undefined,
          membershipDate: formData.membershipDate,
          membershipBillNumber: formData.membershipBillNumber,
          membershipRemarks: formData.membershipRemarks,
        }
      : {
          membershipAmount: undefined,
          membershipPaidMethod: undefined,
          membershipPaymentStatus: undefined,
          membershipPartialAmount: undefined,
          membershipDate: undefined,
          membershipBillNumber: undefined,
          membershipRemarks: undefined,
        };

    const payload = {
      name: formData.name,
      phone: formData.phone,
      address: formData.address,
      role: formData.role,
      ...membershipPayload,
    };

    if (editingId) {
      const original = members.find(m => m.id === editingId);
      if (original?.membershipPaymentStatus === 'paid' && payload.membershipPaymentStatus !== 'paid') {
        setPendingSave({ payload, saveAndAddNew });
        return;
      }
    }

    commitSave(payload, saveAndAddNew);
  };

  const commitSave = (payload: MemberFormPayload, saveAndAddNew: boolean) => {
    if (editingId) {
      // Edit existing member
      setMembers(members.map(m =>
        m.id === editingId
          ? { ...m, ...payload }
          : m
      ));
      onLog('update', 'members', payload.name);
      setToastMessage(t('common.updatedSuccess'));
    } else {
      // Add new member
      const newMember: Member = {
        id: crypto.randomUUID(),
        ...payload,
        joinDate: new Date().toISOString().split('T')[0],
      };
      setMembers([...members, newMember]);
      onLog('create', 'members', payload.name);
      setToastMessage(t('common.savedSuccess'));
    }

    const wasEditing = editingId;
    setFormData(emptyForm);
    setShowMembershipPayment(false);
    setEditingId(null);
    setShowForm(saveAndAddNew && !wasEditing);
  };

  const confirmStatusChange = () => {
    if (!pendingSave) return;
    commitSave(pendingSave.payload, pendingSave.saveAndAddNew);
    setPendingSave(null);
  };

  const handleEdit = (member: Member) => {
    setFormData({
      name: member.name,
      phone: member.phone,
      address: member.address,
      role: member.role,
      membershipAmount: member.membershipAmount !== undefined ? member.membershipAmount.toString() : '',
      membershipPaidMethod: member.membershipPaidMethod || 'notSelected',
      membershipPaymentStatus: member.membershipPaymentStatus || 'paid',
      membershipPartialAmount: member.membershipPartialAmount !== undefined ? member.membershipPartialAmount.toString() : '',
      membershipDate: member.membershipDate || new Date().toISOString().split('T')[0],
      membershipBillNumber: member.membershipBillNumber || '',
      membershipRemarks: member.membershipRemarks || '',
    });
    setShowMembershipPayment(!!member.membershipAmount);
    setEditingId(member.id);
    setShowForm(true);
  };

  const roleLabel = (value: string) => {
    const found = ROLES.find(r => r.value === value);
    return found ? t(found.labelKey) : value;
  };

  const statusLabel = (status: PaymentStatus) => {
    const found = PAYMENT_STATUSES.find(s => s.value === status);
    return found ? t(found.labelKey) : status;
  };

  const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    partial: 'bg-blue-100 text-blue-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const handleDelete = (id: string) => {
    const target = members.find(m => m.id === id);
    if (target) setDeleteTarget(target);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setMembers(members.filter(m => m.id !== deleteTarget.id));
    onLog('delete', 'members', deleteTarget.name);
    setDeleteTarget(null);
    setToastMessage(t('common.deletedSuccess'));
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowMembershipPayment(false);
    setShowForm(false);
    setEditingId(null);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [draftFilters, setDraftFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<TableSearchFilters>(emptyTableSearchFilters);

  const filteredMembers = members.filter(m => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const inText = [m.name, m.phone, m.address, roleLabel(m.role)]
        .some(p => p !== undefined && p !== null && String(p).toLowerCase().includes(q));
      if (!inText) return false;
    }

    const f = appliedFilters;
    if (f.amountMin && (m.membershipAmount ?? -1) < parseFloat(f.amountMin)) return false;
    if (f.amountMax && (m.membershipAmount ?? Infinity) > parseFloat(f.amountMax)) return false;
    if (f.billVoucher && !(m.membershipBillNumber || '').toLowerCase().includes(f.billVoucher.trim().toLowerCase())) return false;
    if (f.status && m.membershipPaymentStatus !== f.status) return false;
    if (f.paidMethod && m.membershipPaidMethod !== f.paidMethod) return false;
    if (f.phone && !(m.phone || '').includes(f.phone.trim())) return false;
    if (f.dateFrom && (!m.membershipDate || new Date(m.membershipDate).getTime() < new Date(f.dateFrom).getTime())) return false;
    if (f.dateTo && (!m.membershipDate || new Date(m.membershipDate).getTime() > new Date(f.dateTo).getTime())) return false;
    return true;
  });

  const pagination = usePagination(filteredMembers);
  const totalMembershipPayments = members.reduce((sum, m) => sum + getMemberCreditAmount(m), 0);
  const isPartial = formData.membershipPaymentStatus === 'partial';

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          canEdit && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              {t('members.addNew')}
            </button>
          )
        }
      >
        {t('members.pageTitle')}
      </PageHeading>

      <TableSearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        placeholder={t('members.searchPlaceholder')}
        filters={draftFilters}
        onFiltersChange={setDraftFilters}
        onSearch={() => setAppliedFilters(draftFilters)}
        onClear={() => { setSearchQuery(''); setDraftFilters(emptyTableSearchFilters); setAppliedFilters(emptyTableSearchFilters); }}
        filtersActive={hasActiveTableFilters(appliedFilters)}
        resultCount={filteredMembers.length}
        totalCount={members.length}
        showAmount
        showBillVoucher
        billVoucherLabel={t('chanda.billNumber')}
        statusOptions={PAYMENT_STATUSES.map(s => ({ value: s.value, label: t(s.labelKey) }))}
        paidMethodOptions={PAID_METHODS.filter(m => m.value !== 'notSelected').map(m => ({ value: m.value, label: t(m.labelKey) }))}
        showDateRange
        showPhone
      />

      {/* Widgets — Treasury-style summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('members.widget.totalPayments')}</h3>
            <IndianRupee className="text-green-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">₹{totalMembershipPayments.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">{t('members.widget.totalMembers')}</h3>
            <Users className="text-blue-500" size={24} />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">{members.length}</p>
        </div>
      </div>

      {/* Form */}
      <FormModal
        open={canEdit && showForm}
        title={editingId ? t('members.editMember') : t('members.addNew')}
        onClose={handleCancel}
        footer={
          <>
            <button
              type="submit"
              form="members-form"
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
            >
              {editingId ? t('common.update') : t('common.add')}
            </button>
            {!editingId && (
              <button
                type="submit"
                form="members-form"
                value="andNew"
                className="px-6 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium"
              >
                {t('common.saveAndAddNew')}
              </button>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
          </>
        }
      >
          <form id="members-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('members.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone')} *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('members.phonePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.address')} *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('members.addressPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('members.role')} *</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('members.selectRole')}</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Membership Payment — collapsible section */}
            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowMembershipPayment(o => !o)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 font-semibold hover:bg-orange-50 transition-colors"
              >
                {showMembershipPayment ? <ChevronDown size={18} /> : <Plus size={18} />}
                {t('members.membershipPayment')}
              </button>

              {showMembershipPayment && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('members.membershipAmount')}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.membershipAmount}
                      onChange={(e) => setFormData({ ...formData, membershipAmount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder={t('chanda.amountPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.paidMethod')}</label>
                    <select
                      value={formData.membershipPaidMethod}
                      onChange={(e) => setFormData({ ...formData, membershipPaidMethod: e.target.value as PaidMethod })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    >
                      {PAID_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.paymentStatus')}</label>
                    <select
                      value={formData.membershipPaymentStatus}
                      onChange={(e) => setFormData({ ...formData, membershipPaymentStatus: e.target.value as PaymentStatus })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    >
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                  {isPartial && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.partialAmountLabel')}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={formData.membershipAmount || undefined}
                        value={formData.membershipPartialAmount}
                        onChange={(e) => setFormData({ ...formData, membershipPartialAmount: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        placeholder={t('chanda.partialAmountPlaceholder')}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.date')}</label>
                    <input
                      type="date"
                      value={formData.membershipDate}
                      onChange={(e) => setFormData({ ...formData, membershipDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.billNumber')}</label>
                    <input
                      type="text"
                      value={formData.membershipBillNumber}
                      onChange={(e) => setFormData({ ...formData, membershipBillNumber: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      placeholder={t('chanda.billNumberPlaceholder')}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
                    <textarea
                      value={formData.membershipRemarks}
                      onChange={(e) => setFormData({ ...formData, membershipRemarks: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

          </form>
      </FormModal>

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.name')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.role')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.joinDate')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.membershipAmount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('chanda.paymentStatus')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.assignedTasks')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.pageItems.map((member) => {
                const hasPayment = member.membershipAmount !== undefined && member.membershipAmount !== null;
                const status = member.membershipPaymentStatus || 'pending';
                const assignedTasks = tasksList.filter(task => task.assignedMemberIds?.includes(member.id));
                return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <button
                      type="button"
                      onClick={() => setViewTarget(member)}
                      className="text-orange-600 hover:text-orange-700 hover:underline text-left"
                    >
                      {member.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-orange-600 font-medium">{roleLabel(member.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.joinDate).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                    {hasPayment ? `₹${(member.membershipAmount || 0).toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {hasPayment ? (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {statusLabel(status)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {assignedTasks.length === 0 ? '-' : (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {assignedTasks.map(task => (
                          <span
                            key={task.id}
                            title={task.description || task.title}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${TASK_PRIORITY_DOT[task.priority]}`} />
                            {task.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(member)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('members.empty')}
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

      <Toast message={toastMessage} onDone={() => setToastMessage(null)} />
      <ViewModal
        open={!!viewTarget}
        title={viewTarget?.name || ''}
        onClose={() => setViewTarget(null)}
        onEdit={canEdit && viewTarget ? () => { const m = viewTarget; setViewTarget(null); handleEdit(m); } : undefined}
        fields={viewTarget ? [
          { label: t('common.name'), value: viewTarget.name },
          { label: t('members.role'), value: roleLabel(viewTarget.role) },
          { label: t('common.phone'), value: viewTarget.phone },
          { label: t('members.joinDate'), value: new Date(viewTarget.joinDate).toLocaleDateString(locale) },
          { label: t('common.address'), value: viewTarget.address, fullWidth: true },
          { label: t('members.membershipAmount'), value: viewTarget.membershipAmount !== undefined ? `₹${viewTarget.membershipAmount.toLocaleString()}` : '-' },
          { label: t('chanda.paymentStatus'), value: viewTarget.membershipPaymentStatus ? statusLabel(viewTarget.membershipPaymentStatus) : '-' },
          { label: t('common.paidMethod'), value: viewTarget.membershipPaidMethod ? t(PAID_METHODS.find(m => m.value === viewTarget.membershipPaidMethod)?.labelKey || 'common.paidMethod.notSelected') : '-' },
          { label: t('chanda.billNumber'), value: viewTarget.membershipBillNumber || '-' },
          { label: t('common.remarks'), value: viewTarget.membershipRemarks || '-', fullWidth: true },
        ] : []}
      />
      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.name}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <StatusChangeConfirmModal
        open={!!pendingSave}
        itemLabel={pendingSave?.payload.name}
        fromStatusLabel={statusLabel('paid')}
        toStatusLabel={pendingSave?.payload.membershipPaymentStatus ? statusLabel(pendingSave.payload.membershipPaymentStatus) : ''}
        onCancel={() => setPendingSave(null)}
        onConfirm={confirmStatusChange}
      />
    </div>
  );
}
