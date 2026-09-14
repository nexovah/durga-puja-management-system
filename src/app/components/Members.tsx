import { useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { Member } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';

interface MembersProps {
  members: Member[];
  setMembers: (members: Member[]) => void;
}

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

export function Members({ members, setMembers }: MembersProps) {
  const { t, locale } = useLanguage();
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
        id: crypto.randomUUID(),
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

  const roleLabel = (value: string) => {
    const found = ROLES.find(r => r.value === value);
    return found ? t(found.labelKey) : value;
  };

  const handleDelete = (id: string) => {
    if (confirm(t('members.confirmDelete'))) {
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
            {t('members.addNew')}
          </button>
        }
      >
        {t('members.pageTitle')}
      </PageHeading>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">
              {editingId ? t('members.editMember') : t('members.addNew')}
            </h3>
            <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

      {/* Members List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.name')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.role')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.phone')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.address')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('members.joinDate')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800">{member.name}</td>
                  <td className="px-6 py-4 text-sm text-orange-600 font-medium">{roleLabel(member.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.phone}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{member.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(member.joinDate).toLocaleDateString(locale)}
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
              {t('members.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
