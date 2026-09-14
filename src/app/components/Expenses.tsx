import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import { Expense } from '../App';
import { PageHeading } from './PageHeading';

const categories = [
  'নির্মাণ',
  'সাজসজ্জা',
  'প্রতিমা',
  'আলোকসজ্জা',
  'খাবার',
  'প্রচার',
  'নিরাপত্তা',
  'পরিবহন',
  'অন্যান্য',
];

export function Expenses({ expenses, setExpenses }: ExpensesProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    remarks: '',
  });

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
    if (confirm('আপনি কি নিশ্চিত এই খরচ রেকর্ড মুছে ফেলতে চান?')) {
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
      ['শিরোনাম', 'পরিমাণ', 'তারিখ', 'বিভাগ', 'মন্তব্য'].join(','),
      ...expenses.map(exp => [exp.title, exp.amount, exp.date, exp.category, exp.remarks].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const categoryTotals = categories.map(cat => ({
    category: cat,
    total: expenses.filter(exp => exp.category === cat).reduce((sum, exp) => sum + exp.amount, 0),
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
              এক্সপোর্ট
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
            >
              <Plus size={20} />
              নতুন খরচ যোগ করুন
            </button>
          </div>
        }
      >
        খরচ - মোট: ₹{totalExpenses.toLocaleString()}
      </PageHeading>

      {/* Category Summary */}
      {categoryTotals.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">বিভাগ অনুযায়ী খরচ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryTotals.map((ct) => (
              <div key={ct.category} className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-gray-600">{ct.category}</p>
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
              {editingId ? 'খরচ সম্পাদনা করুন' : 'নতুন খরচ যোগ করুন'}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">শিরোনাম *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="খরচের শিরোনাম"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">পরিমাণ (₹) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="পরিমাণ"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">তারিখ *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">বিভাগ *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="">বিভাগ নির্বাচন করুন</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">মন্তব্য</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="কোনো মন্তব্য"
                rows={2}
              />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {editingId ? 'আপডেট করুন' : 'যোগ করুন'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                বাতিল করুন
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
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">শিরোনাম</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">তারিখ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">বিভাগ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মন্তব্য</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{expense.title}</td>
                  <td className="px-6 py-4 text-sm text-red-600 font-bold">₹{expense.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(expense.date).toLocaleDateString('bn-IN')}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {expense.category}
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
              কোনো খরচ রেকর্ড নেই। নতুন খরচ যোগ করুন।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}