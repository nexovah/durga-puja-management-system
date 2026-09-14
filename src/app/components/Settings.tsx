import { useState } from 'react';
import { Save, Plus, Edit2, Trash2, Building2, Lock, Users, Code } from 'lucide-react';
import { User, CommitteeInfo } from '../App';
import { PageHeading } from './PageHeading';

interface SettingsProps {
  committeeInfo: CommitteeInfo;
  setCommitteeInfo: (info: CommitteeInfo) => void;
  users: User[];
  setUsers: (users: User[]) => void;
  currentUser: User | null;
  developerInfo: any;
  setDeveloperInfo: (info: any) => void;
}

export function Settings({
  committeeInfo,
  setCommitteeInfo,
  users,
  setUsers,
  currentUser,
  developerInfo,
  setDeveloperInfo,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'committee' | 'password' | 'users' | 'developer'>('committee');
  const [committeeForm, setCommitteeForm] = useState(committeeInfo);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    permissions: {
      members: true,
      chanda: true,
      expenses: true,
      treasury: true,
      settings: false,
    },
  });
  const [devForm, setDevForm] = useState(developerInfo);
  const [message, setMessage] = useState('');

  const handleCommitteeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommitteeInfo(committeeForm);
    setMessage('কমিটির তথ্য সফলভাবে আপডেট হয়েছে');
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;

    if (passwordForm.currentPassword !== currentUser.password) {
      setMessage('বর্তমান পাসওয়ার্ড ভুল');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage('নতুন পাসওয়ার্ড মিলছে না');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUsers(users.map(u => 
      u.id === currentUser.id 
        ? { ...u, password: passwordForm.newPassword }
        : u
    ));

    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingUserId) {
      // Edit existing user
      setUsers(users.map(u => 
        u.id === editingUserId 
          ? { ...u, ...userForm, isAdmin: false }
          : u
      ));
      setMessage('ইউজার সফলভাবে আপডেট হয়েছে');
    } else {
      // Check if username already exists
      if (users.some(u => u.username === userForm.username)) {
        setMessage('এই ইউজারনেম ইতিমধ্যে ব্যবহৃত হচ্ছে');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      // Add new user
      const newUser: User = {
        id: Date.now().toString(),
        ...userForm,
        isAdmin: false,
      };
      setUsers([...users, newUser]);
      setMessage('নতুন ইউজার সফলভাবে তৈরি হয়েছে');
    }

    setUserForm({
      name: '',
      username: '',
      password: '',
      permissions: {
        members: true,
        chanda: true,
        expenses: true,
        treasury: true,
        settings: false,
      },
    });
    setShowUserForm(false);
    setEditingUserId(null);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEditUser = (user: User) => {
    setUserForm({
      name: user.name,
      username: user.username,
      password: user.password,
      permissions: user.permissions,
    });
    setEditingUserId(user.id);
    setShowUserForm(true);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (user?.isAdmin) {
      setMessage('অ্যাডমিন ইউজার মুছে ফেলা যাবে না');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (confirm('আপনি কি নিশ্চিত এই ইউজার মুছে ফেলতে চান?')) {
      setUsers(users.filter(u => u.id !== id));
      setMessage('ইউজার সফলভাবে মুছে ফেলা হয়েছে');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeveloperSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDeveloperInfo(devForm);
    setMessage('ডেভেলপার তথ্য সফলভাবে আপডেট হয়েছে');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeading>সেটিংস</PageHeading>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('committee')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
              activeTab === 'committee'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Building2 size={20} />
            কমিটির তথ্য
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
              activeTab === 'password'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Lock size={20} />
            পাসওয়ার্ড পরিবর্তন
          </button>
          {currentUser?.isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                activeTab === 'users'
                  ? 'border-orange-600 text-orange-600 bg-orange-50'
                  : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              <Users size={20} />
              ইউজার ম্যানেজমেন্ট
            </button>
          )}
          <button
            onClick={() => setActiveTab('developer')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
              activeTab === 'developer'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Code size={20} />
            ডেভেলপার তথ্য
          </button>
        </div>

        <div className="p-6">
          {/* Committee Info Tab */}
          {activeTab === 'committee' && (
            <form onSubmit={handleCommitteeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">লোগো আপলোড করুন (JPG/PNG)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setCommitteeForm({ ...committeeForm, logo: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
                {committeeForm.logo && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="w-20 h-20 border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                      {committeeForm.logo.startsWith('data:') || committeeForm.logo.startsWith('http') ? (
                        <img 
                          src={committeeForm.logo} 
                          alt="Logo Preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">{committeeForm.logo}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCommitteeForm({ ...committeeForm, logo: '' })}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      লোগো মুছে ফেলুন
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-1">JPG বা PNG ফাইল আপলোড করুন</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">স্থাপিত (বছর) *</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.established}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, established: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: ২০১৯"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">রেজিস্ট্রেশন নম্বর *</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.regNumber}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, regNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: ৮০০১৪৮৬৪"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">সংগঠন/কমিটির নাম *</label>
                <input
                  type="text"
                  required
                  value={committeeForm.association}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, association: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="যেমন: বেনজীন সর্বজনীন দুর্গোৎসব কমিটি"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">পোস্ট *</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.post}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, post: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: পোস্ট"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">পিন কোড *</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.pinCode}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, pinCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: ৭৪১২৩৯"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">জেলা + পুলিশ স্টেশন *</label>
                <input
                  type="text"
                  required
                  value={committeeForm.districtPS}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, districtPS: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder="যেমন: কালিপাড়া পোস্ট, দুর্গা পূজা ময়দান, কালিপাড়া বাজার"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">মোবাইল নম্বর ১ *</label>
                  <input
                    type="tel"
                    required
                    value={committeeForm.mobile1}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: ৯৭৭৫৭৬৭৪০২"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">মোবাইল নম্বর ২ (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    value={committeeForm.mobile2 || ''}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="যেমন: ৯৮৭৬৫৪৩২১০"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save size={20} />
                সংরক্ষণ করুন
              </button>
            </form>
          )}

          {/* Password Change Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">বর্তমান পাসওয়ার্ড *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">নতুন পাসওয়ার্ড *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">পাসওয়ার্ড নিশ্চিত করুন *</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save size={20} />
                পাসওয়ার্ড পরিবর্তন করুন
              </button>
            </form>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && currentUser?.isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">ইউজার ম্যানেজমেন্ট</h3>
                <button
                  onClick={() => {
                    setShowUserForm(true);
                    setEditingUserId(null);
                    setUserForm({
                      name: '',
                      username: '',
                      password: '',
                      permissions: {
                        members: true,
                        chanda: true,
                        expenses: true,
                        treasury: true,
                        settings: false,
                      },
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Plus size={20} />
                  নতুন ইউজার তৈরি করুন
                </button>
              </div>

              {showUserForm && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4">
                    {editingUserId ? 'ইউজার সম্পাদনা করুন' : 'নতুন ইউজার তৈরি করুন'}
                  </h4>
                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">নাম *</label>
                        <input
                          type="text"
                          required
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">ইউজারনেম *</label>
                        <input
                          type="text"
                          required
                          value={userForm.username}
                          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          disabled={!!editingUserId}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">পাসওয়ার্ড *</label>
                        <input
                          type="password"
                          required
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">অনুমতি</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(userForm.permissions).map(([key, value]) => (
                          <label key={key} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => setUserForm({
                                ...userForm,
                                permissions: {
                                  ...userForm.permissions,
                                  [key]: e.target.checked,
                                },
                              })}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="text-sm text-gray-700">
                              {key === 'members' && 'সদস্য'}
                              {key === 'chanda' && 'চাঁদা'}
                              {key === 'expenses' && 'খরচ'}
                              {key === 'treasury' && 'কোষাধ্যক্ষ'}
                              {key === 'settings' && 'সেটিংস'}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        {editingUserId ? 'আপডেট করুন' : 'তৈরি করুন'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserForm(false);
                          setEditingUserId(null);
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        বাতিল করুন
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users List */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">নাম</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ইউজারনেম</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ধরন</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">অনুমতি</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-800 font-medium">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{user.username}</td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.isAdmin ? 'অ্যাডমিন' : 'ইউজার'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {Object.entries(user.permissions)
                            .filter(([_, value]) => value)
                            .map(([key]) => {
                              const labels: any = {
                                members: 'সদস্য',
                                chanda: 'চাঁদা',
                                expenses: 'খরচ',
                                treasury: 'কোষাধ্যক্ষ',
                                settings: 'সেটিংস',
                              };
                              return labels[key];
                            })
                            .join(', ')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!user.isAdmin && (
                              <>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Developer Info Tab */}
          {activeTab === 'developer' && (
            <form onSubmit={handleDeveloperSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ডেভেলপার নাম *</label>
                <input
                  type="text"
                  required
                  value={devForm.name}
                  onChange={(e) => setDevForm({ ...devForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ইমেইল *</label>
                <input
                  type="email"
                  required
                  value={devForm.email}
                  onChange={(e) => setDevForm({ ...devForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ফোন নম্বর *</label>
                <input
                  type="tel"
                  required
                  value={devForm.phone}
                  onChange={(e) => setDevForm({ ...devForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">অ্যাপ ভার্শন *</label>
                <input
                  type="text"
                  required
                  value={devForm.version}
                  onChange={(e) => setDevForm({ ...devForm, version: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save size={20} />
                সংরক্ষণ করুন
              </button>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2">বর্তমান তথ্য</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>নাম:</strong> {developerInfo.name}</p>
                  <p><strong>ইমেইল:</strong> {developerInfo.email}</p>
                  <p><strong>ফোন:</strong> {developerInfo.phone}</p>
                  <p><strong>ভার্শন:</strong> {developerInfo.version}</p>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}