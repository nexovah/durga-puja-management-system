import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload } from 'lucide-react';
import { Loan, PaidMethod, getLoanNetAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField } from '../lib/csv';
import { Pagination, usePagination } from './Pagination';

interface LoansProps {
  loansList: Loan[];
  setLoansList: (loans: Loan[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  canBulkImport: boolean;
  onLog: (action: 'create' | 'update' | 'delete' | 'bulk_import', module: 'loans', summary: string, count?: number) => void;
}

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const emptyForm = {
  donorName: '',
  amountReceived: '',
  amountPaid: '',
  phone: '',
  paymentMethod: 'notSelected' as PaidMethod,
  date: new Date().toISOString().split('T')[0],
  returnDate: '',
  remarks: '',
};

export function Loans({ loansList, setLoansList, canEdit, canDelete, canBulkImport, onLog }: LoansProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);

  const totalLoans = loansList.reduce((sum, loan) => sum + getLoanNetAmount(loan), 0);

  const paidMethodLabel = (method: PaidMethod) => {
    const found = PAID_METHODS.find(m => m.value === method);
    return found ? t(found.labelKey) : method;
  };

  const normalize = (s: string) => s.trim().toLowerCase();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      donorName: formData.donorName,
      amountReceived: parseFloat(formData.amountReceived) || 0,
      amountPaid: parseFloat(formData.amountPaid) || 0,
      phone: formData.phone,
      paymentMethod: formData.paymentMethod,
      paymentStatus: 'paid' as const,
      date: formData.date,
      returnDate: formData.returnDate,
      remarks: formData.remarks,
    };

    if (editingId) {
      setLoansList(loansList.map(l => (l.id === editingId ? { ...l, ...payload } : l)));
      onLog('update', 'loans', `${payload.donorName} — ₹${payload.amountReceived.toLocaleString()}`);
    } else {
      const newLoan: Loan = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setLoansList([...loansList, newLoan]);
      onLog('create', 'loans', `${payload.donorName} — ₹${payload.amountReceived.toLocaleString()}`);
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (loan: Loan) => {
    setFormData({
      donorName: loan.donorName,
      amountReceived: loan.amountReceived.toString(),
      amountPaid: (loan.amountPaid || 0).toString(),
      phone: loan.phone,
      paymentMethod: loan.paymentMethod || 'notSelected',
      date: loan.date,
      returnDate: loan.returnDate || '',
      remarks: loan.remarks,
    });
    setEditingId(loan.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('loans.confirmDelete'))) {
      const target = loansList.find(l => l.id === id);
      setLoansList(loansList.filter(l => l.id !== id));
      if (target) onLog('delete', 'loans', `${target.donorName} — ₹${target.amountReceived.toLocaleString()}`);
    }
  };

  const handleCancel = () => {
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleExport = () => {
    const csvContent = [
      [
        t('loans.csv.donorName'),
        t('loans.csv.amountReceived'),
        t('loans.csv.amountPaid'),
        t('loans.paymentMethod'),
        t('loans.csv.date'),
        t('loans.csv.returnDate'),
        t('loans.csv.phone'),
        t('loans.csv.remarks'),
      ].map(csvField).join(','),
      ...loansList.map(l => [
        l.donorName,
        l.amountReceived,
        l.amountPaid || 0,
        paidMethodLabel(l.paymentMethod || 'notSelected'),
        l.date,
        l.returnDate || '',
        l.phone,
        l.remarks,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `loans-${new Date().toISOString().split('T')[0]}.csv`;
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

      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Loan[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const [donorName, amountReceivedRaw, amountPaidRaw, paidMethodRaw, date, returnDate, phone, remarks] = rows[i];
        const amountReceived = parseFloat((amountReceivedRaw || '').replace(/,/g, ''));
        if (!donorName || isNaN(amountReceived)) continue;

        imported.push({
          id: crypto.randomUUID(),
          donorName: donorName.trim(),
          amountReceived,
          amountPaid: parseFloat((amountPaidRaw || '0').replace(/,/g, '')) || 0,
          phone: (phone || '').trim(),
          paymentMethod: parsePaidMethodInput(paidMethodRaw || ''),
          paymentStatus: 'paid',
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          returnDate: (returnDate || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      if (imported.length > 0) {
        setLoansList([...loansList, ...imported]);
        onLog('bulk_import', 'loans', `${t('common.importResult')}: ${imported.length}`, imported.length);
      }
      alert(`${t('common.importResult')}: ${imported.length}`);
    };
    reader.readAsText(file);
  };

  const sortedLoans = [...loansList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const pagination = usePagination(sortedLoans);

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {canEdit && canBulkImport && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 text-white rounded-lg transition-opacity hover:opacity-90 font-bold text-sm sm:text-base whitespace-nowrap"
                  style={{ backgroundColor: '#383737' }}
                >
                  <Upload size={20} />
                  {t('common.import')}
                </button>
              </>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
            >
              <Download size={20} />
              {t('common.export')}
            </button>
            {canEdit && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold text-sm sm:text-base whitespace-nowrap"
              >
                <Plus size={20} />
                {t('loans.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('loans.pageTitle')}: ₹{totalLoans.toLocaleString()}
      </PageHeading>

      {canEdit && showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('loans.editLoan') : t('loans.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('loans.donorName')} *</label>
              <input
                type="text"
                required
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.donorNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('loans.amountReceivedLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amountReceived}
                onChange={(e) => setFormData({ ...formData, amountReceived: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.amountPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('loans.amountPaidLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amountPaid}
                onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.amountPlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.phonePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('loans.paymentMethod')}</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaidMethod })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.date')} *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('loans.returnDate')}</label>
              <input
                type="date"
                value={formData.returnDate}
                onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('loans.remarksPlaceholder')}
                rows={2}
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {editingId ? t('common.update') : t('common.add')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('loans.donorName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('loans.amountReceivedLabel')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('loans.amountPaidLabel')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('loans.paymentMethod')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('loans.returnDate')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                {(canEdit || canDelete) && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.pageItems.map((loan) => (
                <tr key={loan.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{loan.donorName}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">₹{loan.amountReceived.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">₹{(loan.amountPaid || 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{paidMethodLabel(loan.paymentMethod || 'notSelected')}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(loan.date).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString(locale) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{loan.remarks || '-'}</td>
                  {(canEdit || canDelete) && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                        <button
                          onClick={() => handleEdit(loan)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        )}
                        {canDelete && (
                        <button
                          onClick={() => handleDelete(loan.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {loansList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('loans.empty')}
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
    </div>
  );
}
