import { useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { Member } from '../App';
import { PageHeading } from './PageHeading';

interface MembersProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
}

export function Members({ members, setMembers }: MembersProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    role: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
      // Edit existing member
      setMembers(members.map(m => 
        m.id === editingId 
          ? { ...m, ...formData }
          : m
      ));
    } else {
      // Add new member
      const newMember: Member = {
        id: Date.now().toString(),
        ...formData,
        joinDate: new Date().toISOString().split('T')[0],
      };
      setMembers([...members, newMember]);
    }

    setFormData({ name: '', phone: '', address: '', role: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (member: Member) => {
    setFormData({
      name: member.name,
      phone: member.phone,
      address: member.address,
      role: member.role,
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('আপনি কি নিশ্চিত এই সদস্য মুছে ফেলতে চান?')) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', phone: '', address: '', role: '' });
    setShowForm(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-bold"
          >
            <Plus size={20} />
            নতুন সদস্য যোগ করুন
          </button>
        }
      >
        কমিটির সদস্য
      </PageHeading>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? 'সদস্য সম্পাদনা করুন' : 'নতুন সদস্য যোগ করুন'}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">নাম *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="সদস্যের নাম"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ফোন নম্বর *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="ফোন নম্বর"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ঠিকানা *</label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="ঠিকানা"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">পদবী *</label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                placeholder="যেমন: সভাপতি, সম্পাদক"
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

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">পদবী</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ফোন</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ঠিকানা</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">যোগদানের তারিখ</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{member.name}</td>
                  <td className="px-6 py-4 text-sm text-orange-600 font-medium">{member.role}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.joinDate).toLocaleDateString('bn-IN')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
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
          {members.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              কোনো সদস্য নেই। নতুন সদস্য যোগ করুন।
            </div>
          )}
        </div>
      </div>
    </div>
  );
}