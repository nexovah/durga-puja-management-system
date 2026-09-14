import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import { Expense } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface ExpensesProps {
  expenses: Expense[];
  setExpenses: (expenses: Expense[]) => void;
}

const categories: { value: string; labelKey: TranslationKey }[] = [
  { value: 'construction', labelKey: 'expenses.category.construction' },
  { value: 'decoration', labelKey: 'expenses.category.decoration' },
  { value: 'idol', labelKey: 'expenses.category.idol' },
  { value: 'lighting', labelKey: 'expenses.category.lighting' },
  { value: 'food', labelKey: 'expenses.category.food' },
  { value: 'publicity', labelKey: 'expenses.category.publicity' },
  { value: 'security', labelKey: 'expenses.category.security' },
  { value: 'transport', labelKey: 'expenses.category.transport' },
  { value: 'other', labelKey: 'expenses.category.other' },
];

export function Expenses({ expenses, setExpenses }: ExpensesProps) {
  const { t, locale } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    remarks: '',
  });

  const categoryLabel = (value: string) => {
    const found = categories.find(c => c.value === value);
    return found ? t(found.labelKey) : value;
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Edit existing expense
      setExpenses(expenses.map(exp =>
        exp.id === editingId
          ? { ...exp, ...formData, amount: parseFloat(formData.amount) }
          : exp
      ));
    } else {
      // Add new expense
      const newExpense: Expense = {
        id: Date.now().toString(),
        title: formData.title,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        remarks: formData.remarks,
      };
      setExpenses([...expenses, newExpense]);
    }

    setFormData({ title: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', remarks: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (expense: Expense) => {
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      date: expense.date,
      category: expense.category,
      remarks: expense.remarks,
    });
    setEditingId(expense.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('expenses.confirmDelete'))) {
      setExpenses(expenses.filter(exp => exp.id !== id));
    }
  };

  const handleCancel = () => {
    setFormData({ title: '', amount: '', date: new Date().toISOString().split('T')[0], category: '', remarks: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleExport = () => {
    const csvContent = [
      [t('expenses.csv.title'), t('expenses.csv.amount'), t('expenses.csv.date'), t('expenses.csv.category'), t('expenses.csv.remarks')].join(','),
      ...expenses.map(exp => [exp.title, exp.amount, exp.date, categoryLabel(exp.category), exp.remarks].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const categoryTotals = categories.map(cat => ({
    category: cat.value,
    label: t(cat.labelKey),
    total: expenses.filter(exp => exp.category === cat.value).reduce((sum, exp) => sum + exp.amount, 0),
  })).filter(ct => ct.total > 0);

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
              {t('expenses.addNew')}
            </button>
          </div>
        }
      >
        {t('expenses.pageTitle')}: ₹{totalExpenses.toLocaleString()}
      </PageHeading>

      {/* Category Summary */}
      {categoryTotals.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">{t('expenses.byCategory')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTotals.map((ct) => (
              <div key={ct.category} className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-gray-600">{ct.label}</p>
                <p className="text-xl font-bold text-red-600">₹{ct.total.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('expenses.editExpense') : t('expenses.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.title')} *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.titlePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.amountLabel')} *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.amountPlaceholder')}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('expenses.category')} *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="">{t('expenses.selectCategory')}</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{t(cat.labelKey)}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.remarks')}</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder={t('expenses.remarksPlaceholder')}
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

      {/* Expenses List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.title')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.amount')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.category')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{expense.title}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">₹{expense.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(expense.date).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {categoryLabel(expense.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{expense.remarks || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(expense.id)}
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
          {expenses.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('expenses.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
