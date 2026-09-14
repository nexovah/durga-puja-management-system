import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import { DonationAd, DonationAdCategory } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';

interface DonationAdsCollectionProps {
  donationAdsList: DonationAd[];
  setDonationAdsList: (list: DonationAd[]) => void;
}

const emptyForm = {
  category: 'ads' as DonationAdCategory,
  donorName: '',
  companyName: '',
  amount: '',
  inKind: '',
  date: new Date().toISOString().split('T')[0],
  phone: '',
  remarks: '',
};

export function DonationAdsCollection({ donationAdsList, setDonationAdsList }: DonationAdsCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const total = donationAdsList.reduce((sum, item) => sum + item.amount, 0);

  const categoryLabel = (category: DonationAdCategory) =>
    category === 'donation' ? t('donationAds.category.donation') : t('donationAds.category.ads');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      category: formData.category,
      donorName: formData.donorName,
      companyName: formData.category === 'ads' ? formData.companyName : '',
      amount: parseFloat(formData.amount),
      inKind: formData.inKind,
      date: formData.date,
      phone: formData.phone,
      remarks: formData.remarks,
    };

    if (editingId) {
      setDonationAdsList(donationAdsList.map(item =>
        item.id === editingId ? { ...item, ...payload } : item
      ));
    } else {
      const newItem: DonationAd = {
        id: Date.now().toString(),
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
      inKind: item.inKind || '',
      date: item.date,
      phone: item.phone,
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
        t('donationAds.inKind'),
        t('donationAds.csv.date'),
        t('donationAds.csv.phone'),
        t('donationAds.csv.remarks'),
      ].join(','),
      ...donationAdsList.map(item => [
        categoryLabel(item.category),
        item.donorName,
        item.companyName || '',
        item.amount,
        item.inKind,
        item.date,
        item.phone,
        item.remarks,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `donation-ads-collection-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const isDonation = formData.category === 'donation';

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
            >
              <Download size={20} />
              {t('common.export')}
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              {t('donationAds.addNew')}
            </button>
          </div>
        }
      >
        {t('donationAds.pageTitle')}: ₹{total.toLocaleString()}
      </PageHeading>

      {/* Form */}
      {showForm && (
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
                onChange={(e) => setFormData({ ...formData, category: e.target.value as DonationAdCategory })}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('donationAds.amountLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('donationAds.amountPlaceholder')}
              />
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.date')}</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.category')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.donorName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.companyName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('donationAds.inKind')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...donationAdsList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.category === 'donation' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {categoryLabel(item.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{item.donorName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.companyName || '-'}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">₹{item.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.inKind || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {item.date ? new Date(item.date).toLocaleDateString(locale) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.remarks || '-'}</td>
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
