import { useRef, useState } from 'react';
import { Plus, Edit2, Trash2, X, Download, Upload } from 'lucide-react';
import { Chanda } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { parseCSV, csvField } from '../lib/csv';

interface ChandaCollectionProps {
  chandaList: Chanda[];
  setChandaList: (chandaList: Chanda[]) => void;
}

export function ChandaCollection({ chandaList, setChandaList }: ChandaCollectionProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    donorName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    phone: '',
    remarks: '',
  });
  const importInputRef = useRef<HTMLInputElement>(null);

  const totalChanda = chandaList.reduce((sum, chanda) => sum + chanda.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Edit existing chanda
      setChandaList(chandaList.map(c =>
        c.id === editingId
          ? { ...c, ...formData, amount: parseFloat(formData.amount) }
          : c
      ));
    } else {
      // Add new chanda
      const newChanda: Chanda = {
        id: Date.now().toString(),
        donorName: formData.donorName,
        amount: parseFloat(formData.amount),
        date: formData.date,
        phone: formData.phone,
        remarks: formData.remarks,
      };
      setChandaList([...chandaList, newChanda]);
    }

    setFormData({ donorName: '', amount: '', date: new Date().toISOString().split('T')[0], phone: '', remarks: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (chanda: Chanda) => {
    setFormData({
      donorName: chanda.donorName,
      amount: chanda.amount.toString(),
      date: chanda.date,
      phone: chanda.phone,
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
    setFormData({ donorName: '', amount: '', date: new Date().toISOString().split('T')[0], phone: '', remarks: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleExport = () => {
    const csvContent = [
      [t('chanda.csv.donorName'), t('chanda.csv.amount'), t('chanda.csv.date'), t('chanda.csv.phone'), t('chanda.csv.remarks')].map(csvField).join(','),
      ...chandaList.map(c => [c.donorName, c.amount, c.date, c.phone, c.remarks].map(csvField).join(','))
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
        const [donorName, amountRaw, date, phone, remarks] = rows[i];
        const amount = parseFloat((amountRaw || '').replace(/,/g, ''));
        if (!donorName || isNaN(amount)) continue;
        imported.push({
          id: `${Date.now()}-${i}`,
          donorName: donorName.trim(),
          amount,
          date: (date || '').trim() || new Date().toISOString().split('T')[0],
          phone: (phone || '').trim(),
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

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <div className="flex gap-3">
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
              {t('chanda.addNew')}
            </button>
          </div>
        }
      >
        {t('chanda.pageTitle')}: ₹{totalChanda.toLocaleString()}
      </PageHeading>

      {/* Form */}
      {showForm && (
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...chandaList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((chanda) => (
                <tr key={chanda.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{chanda.donorName}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">₹{chanda.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(chanda.date).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{chanda.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{chanda.remarks || '-'}</td>
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
                </tr>
              ))}
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
