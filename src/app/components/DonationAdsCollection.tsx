import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload } from 'lucide-react';
import { DonationAd, DonationAdCategory, PaidMethod } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey, translations } from '../i18n/translations';
import { parseCSV, csvField } from '../lib/csv';

interface DonationAdsCollectionProps {
  donationAdsList: DonationAd[];
  setDonationAdsList: (list: DonationAd[]) => void;
  canEdit: boolean;
}

const ADS_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'handBook', labelKey: 'donationAds.adsCategory.handBook' },
  { value: 'souvenir', labelKey: 'donationAds.adsCategory.souvenir' },
  { value: 'bill', labelKey: 'donationAds.adsCategory.bill' },
  { value: 'gate', labelKey: 'donationAds.adsCategory.gate' },
  { value: 'banner', labelKey: 'donationAds.adsCategory.banner' },
  { value: 'others', labelKey: 'donationAds.adsCategory.others' },
];

const PAID_METHODS: { value: PaidMethod; labelKey: TranslationKey }[] = [
  { value: 'notSelected', labelKey: 'common.paidMethod.notSelected' },
  { value: 'cash', labelKey: 'common.paidMethod.cash' },
  { value: 'qrScan', labelKey: 'common.paidMethod.qrScan' },
  { value: 'onlineBanking', labelKey: 'common.paidMethod.onlineBanking' },
  { value: 'check', labelKey: 'common.paidMethod.check' },
];

const emptyForm = {
  category: 'ads' as DonationAdCategory,
  donorName: '',
  companyName: '',
  amount: '',
  paidMethod: 'notSelected' as PaidMethod,
  inKind: '',
  date: new Date().toISOString().split('T')[0],
  voucherNumber: '',
  phone: '',
  phone2: '',
  remarks: '',
};

export function DonationAdsCollection({ donationAdsList, setDonationAdsList, canEdit }: DonationAdsCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const importInputRef = useRef<HTMLInputElement>(null);

  const total = donationAdsList.reduce((sum, item) => sum + item.amount, 0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      category: formData.category,
      donorName: formData.donorName,
      companyName: formData.category === 'ads' ? formData.companyName : '',
      amount: parseFloat(formData.amount) || 0,
      paidMethod: formData.paidMethod,
      inKind: formData.inKind,
      date: formData.date,
      voucherNumber: formData.category === 'donation' ? formData.voucherNumber : '',
      phone: formData.phone,
      phone2: formData.phone2,
      remarks: formData.remarks,
    };

    if (editingId) {
      setDonationAdsList(donationAdsList.map(item =>
        item.id === editingId ? { ...item, ...payload } : item
      ));
    } else {
      const newItem: DonationAd = {
        id: crypto.randomUUID(),
        ...payload,
      };
      setDonationAdsList([...donationAdsList, newItem]);
    }

    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (item: DonationAd) => {
    setFormData({
      category: item.category,
      donorName: item.donorName,
      companyName: item.companyName || '',
      amount: item.amount.toString(),
      paidMethod: item.paidMethod || 'notSelected',
      inKind: item.inKind || '',
      date: item.date,
      voucherNumber: item.voucherNumber || '',
      phone: item.phone,
      phone2: item.phone2 || '',
      remarks: item.remarks,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('donationAds.confirmDelete'))) {
      setDonationAdsList(donationAdsList.filter(item => item.id !== id));
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
      ...donationAdsList.map(item => [
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
    link.download = `donation-ads-collection-${new Date().toISOString().split('T')[0]}.csv`;
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

      if (imported.length > 0) {
        setDonationAdsList([...donationAdsList, ...imported]);
      }
      alert(`${t('common.importResult')}: ${imported.length}`);
    };
    reader.readAsText(file);
  };

  const isDonation = formData.category === 'donation';

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex flex-wrap gap-2 sm:gap-3">
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
                {t('donationAds.addNew')}
              </button>
            )}
          </div>
        }
      >
        {t('donationAds.pageTitle')}: ₹{total.toLocaleString()}
      </PageHeading>

      {/* Form */}
      {canEdit && showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('donationAds.editEntry') : t('donationAds.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.category')} *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as DonationAdCategory, inKind: '', voucherNumber: '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="ads">{t('donationAds.category.ads')}</option>
                <option value="donation">{t('donationAds.category.donation')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('donationAds.donorName')} {isDonation ? '*' : ''}
              </label>
              <input
                type="text"
                required={isDonation}
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.donorNamePlaceholder')}
              />
            </div>

            {!isDonation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.companyName')}</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.companyNamePlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.amountLabel')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.amountPlaceholder')}
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

            {isDonation ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.inKind')}</label>
                <input
                  type="text"
                  value={formData.inKind}
                  onChange={(e) => setFormData({ ...formData, inKind: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.inKindPlaceholder')}
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.adsCategory')}</label>
                <select
                  value={formData.inKind}
                  onChange={(e) => setFormData({ ...formData, inKind: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('donationAds.selectAdsCategory')}</option>
                  {ADS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{t(cat.labelKey)}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.date')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>

            {isDonation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.voucherNumber')}</label>
                <input
                  type="text"
                  value={formData.voucherNumber}
                  onChange={(e) => setFormData({ ...formData, voucherNumber: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('donationAds.voucherNumberPlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone1')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.phonePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone2')}</label>
              <input
                type="tel"
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.phonePlaceholder')}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.remarksPlaceholder')}
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

      {/* List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.donorName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.companyName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.paidMethod')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.category')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.inKindOrAdsCategory')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone1')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                {canEdit && <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...donationAdsList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{item.donorName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.companyName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">₹{item.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{paidMethodLabel(item.paidMethod || 'notSelected')}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.category === 'donation' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {categoryLabel(item.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inKindDisplay(item) || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.date ? new Date(item.date).toLocaleDateString(locale) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.remarks || '-'}</td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {donationAdsList.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('donationAds.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
