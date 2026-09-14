import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload } from 'lucide-react';
import { Chanda, PaymentStatus, PaidMethod, getChandaCreditAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField } from '../lib/csv';

interface ChandaCollectionProps {
  chandaList: Chanda[];
  setChandaList: (chandaList: Chanda[]) => void;
  canEdit: boolean;
}

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

const STATUS_BADGE_CLASS: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
};

const emptyForm = {
  donorName: '',
  amount: '',
  paidMethod: 'notSelected' as PaidMethod,
  paymentStatus: 'paid' as PaymentStatus,
  partialAmount: '',
  date: new Date().toISOString().split('T')[0],
  phone: '',
  phone2: '',
  remarks: '',
};

export function ChandaCollection({ chandaList, setChandaList, canEdit }: ChandaCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);

  const totalChanda = chandaList.reduce((sum, chanda) => sum + getChandaCreditAmount(chanda), 0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      donorName: formData.donorName,
      amount: parseFloat(formData.amount),
      paidMethod: formData.paidMethod,
      paymentStatus: formData.paymentStatus,
      partialAmount: formData.paymentStatus === 'partial' ? parseFloat(formData.partialAmount || '0') : undefined,
      date: formData.date,
      phone: formData.phone,
      phone2: formData.phone2,
      remarks: formData.remarks,
    };

    if (editingId) {
      // Edit existing chanda
      setChandaList(chandaList.map(c =>
        c.id === editingId
          ? { ...c, ...payload }
          : c
      ));
    } else {
      // Add new chanda
      const newChanda: Chanda = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setChandaList([...chandaList, newChanda]);
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (chanda: Chanda) => {
    setFormData({
      donorName: chanda.donorName,
      amount: chanda.amount.toString(),
      paidMethod: chanda.paidMethod || 'notSelected',
      paymentStatus: chanda.paymentStatus || 'paid',
      partialAmount: chanda.partialAmount !== undefined ? chanda.partialAmount.toString() : '',
      date: chanda.date,
      phone: chanda.phone,
      phone2: chanda.phone2 || '',
      remarks: chanda.remarks,
    });
    setEditingId(chanda.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('chanda.confirmDelete'))) {
      setChandaList(chandaList.filter(c => c.id !== id));
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
        t('chanda.csv.donorName'),
        t('chanda.csv.amount'),
        t('common.paidMethod'),
        t('chanda.csv.status'),
        t('chanda.csv.partialAmount'),
        t('chanda.csv.date'),
        t('chanda.csv.phone'),
        t('chanda.csv.phone2'),
        t('chanda.csv.remarks'),
      ].map(csvField).join(','),
      ...chandaList.map(c => [
        c.donorName,
        c.amount,
        paidMethodLabel(c.paidMethod || 'notSelected'),
        statusLabel(c.paymentStatus || 'paid'),
        c.paymentStatus === 'partial' ? (c.partialAmount || 0) : '',
        c.date,
        c.phone,
        c.phone2 || '',
        c.remarks,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chanda-collection-${new Date().toISOString().split('T')[0]}.csv`;
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

      // Skip a header row if the first cell isn't a positive number (amount column)
      const firstDataRow = /^\s*-?\d+(\.\d+)?\s*$/.test(rows[0][1] || '') ? 0 : 1;

      const imported: Chanda[] = [];
      for (let i = firstDataRow; i < rows.length; i++) {
        const [donorName, amountRaw, paidMethodRaw, statusRaw, partialAmountRaw, date, phone, phone2, remarks] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!donorName || isNaN(amount)) continue;

        const paymentStatus = parseStatusInput(statusRaw || '');
        const partialAmount = paymentStatus === 'partial'
          ? parseFloat((partialAmountRaw || '0').replace(/,/g, '')) || 0
          : undefined;

        imported.push({
          id: crypto.randomUUID(),
          donorName: donorName.trim(),
          amount,
          paidMethod: parsePaidMethodInput(paidMethodRaw || ''),
          paymentStatus,
          partialAmount,
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          phone: (phone || '').trim(),
          phone2: (phone2 || '').trim(),
          remarks: (remarks || '').trim(),
        });
      }

      if (imported.length > 0) {
        setChandaList([...chandaList, ...imported]);
      }
      alert(`${t('common.importResult')}: ${imported.length}`);
    };
    reader.readAsText(file);
  };

  const isPartial = formData.paymentStatus === 'partial';

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex gap-3">
            {canEdit && (
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
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-opacity hover:opacity-90 font-bold"
                  style={{ backgroundColor: '#383737' }}
                >
                  <Upload size={20} />
                  {t('common.import')}
                </button>
              </>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              <Download size={20} />
              {t('common.export')}
            </button>
            {canEdit && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
              >
                <Plus size={20} />
                {t('chanda.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('chanda.pageTitle')}: ₹{totalChanda.toLocaleString()}
      </PageHeading>

      {/* Form */}
      {canEdit && showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('chanda.editChanda') : t('chanda.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.donorName')} *</label>
              <input
                type="text"
                required
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.donorNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.amountLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.amountPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.paidMethod')}</label>
              <select
                value={formData.paidMethod}
                onChange={(e) => setFormData({ ...formData, paidMethod: e.target.value as PaidMethod })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.paymentStatus')} *</label>
              <select
                required
                value={formData.paymentStatus}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
              </select>
            </div>

            {isPartial && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('chanda.partialAmountLabel')} *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  max={formData.amount || undefined}
                  value={formData.partialAmount}
                  onChange={(e) => setFormData({ ...formData, partialAmount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('chanda.partialAmountPlaceholder')}
                />
              </div>
            )}

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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone1')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone2')}</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.phonePlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('chanda.remarksPlaceholder')}
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

      {/* Chanda List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('chanda.donorName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.paidMethod')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('chanda.paymentStatus')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone1')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone2')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                {canEdit && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...chandaList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((chanda) => {
                const status = chanda.paymentStatus || 'paid';
                return (
                  <tr key={chanda.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-800 font-medium">{chanda.donorName}</td>
                    <td className={`px-6 py-4 text-sm font-bold ${
                      status === 'rejected'
                        ? 'text-red-600 line-through'
                        : status === 'partial'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}>₹{chanda.amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{paidMethodLabel(chanda.paidMethod || 'notSelected')}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}>
                        {statusLabel(status)}
                      </span>
                      {status === 'partial' && (
                        <div className="text-xs text-gray-500 mt-1">
                          ₹{(chanda.partialAmount || 0).toLocaleString()} / ₹{chanda.amount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(chanda.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{chanda.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{chanda.phone2 || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{chanda.remarks || '-'}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(chanda)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(chanda.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {chandaList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('chanda.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
