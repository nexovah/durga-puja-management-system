import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Download } from 'lucide-react';
import { Chanda } from '../App';
import { PageHeading } from './PageHeading';

interface ChandaCollectionProps {
  chandaList: Chanda[];
  setChandaList: (chandaList: Chanda[]) => void;
}

export function ChandaCollection({ chandaList, setChandaList }: ChandaCollectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    donorName: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    phone: '',
    remarks: '',
  });

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
    if (confirm('আপনি কি নিশ্চিত এই চাঁদা রেকর্ড মুছে ফেলতে চান?')) {
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
      ['দাতার নাম', 'পরিমাণ', 'তারিখ', 'ফোন', 'মন্তব্য'].join(','),
      ...chandaList.map(c => [c.donorName, c.amount, c.date, c.phone, c.remarks].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chanda-collection-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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
              নতুন চাঁদা যোগ করুন
            </button>
          </div>
        }
      >
        চাঁদা সংগ্রহ - মোট: ₹{totalChanda.toLocaleString()}
      </PageHeading>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? 'চাঁদা সম্পাদনা করুন' : 'নতুন চাঁদা যোগ করুন'}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">দাতার নাম *</label>
              <input
                type="text"
                required
                value={formData.donorName}
                onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="দাতার নাম"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">ফোন নম্বর</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="ফোন নম্বর"
              />
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

      {/* Chanda List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">দাতার নাম</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পরিমাণ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">তারিখ</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ফোন</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">মন্তব্য</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[...chandaList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((chanda) => (
                <tr key={chanda.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{chanda.donorName}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold">₹{chanda.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(chanda.date).toLocaleDateString('bn-IN')}
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
              কোনো চাঁদা রেকর্ড নেই। নতুন চাঁদা যোগ করুন।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}