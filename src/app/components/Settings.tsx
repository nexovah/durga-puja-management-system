import { useState } from 'react';
import { Save, Plus, Edit2, Trash2, Building2, Lock, Users, Code, Languages } from 'lucide-react';
import { User, CommitteeInfo } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, TranslationKey } from '../i18n/translations';

interface SettingsProps {
  committeeInfo: CommitteeInfo;
  setCommitteeInfo: (info: CommitteeInfo) => void;
  users: User[];
  setUsers: (users: User[]) => void;
  currentUser: User | null;
  developerInfo: any;
  setDeveloperInfo: (info: any) => void;
}

const PERMISSION_LABEL_KEYS: Record<string, TranslationKey> = {
  members: 'permission.members',
  chanda: 'permission.chanda',
  donationAds: 'permission.donationAds',
  expenses: 'permission.expenses',
  treasury: 'permission.treasury',
  settings: 'permission.settings',
};

export function Settings({
  committeeInfo,
  setCommitteeInfo,
  users,
  setUsers,
  currentUser,
  developerInfo,
  setDeveloperInfo,
}: SettingsProps) {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<'committee' | 'password' | 'users' | 'developer' | 'language'>('committee');
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
      donationAds: true,
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
    setMessage(t('settings.msg.committeeUpdated'));
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

    if (passwordForm.currentPassword !== currentUser.password) {
      setMessage(t('settings.msg.wrongCurrentPassword'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage(t('settings.msg.passwordMismatch'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setMessage(t('settings.msg.passwordTooShort'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUsers(users.map(u =>
      u.id === currentUser.id
        ? { ...u, password: passwordForm.newPassword }
        : u
    ));

    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage(t('settings.msg.passwordChanged'));
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
      setMessage(t('settings.msg.userUpdated'));
    } else {
      // Check if username already exists
      if (users.some(u => u.username === userForm.username)) {
        setMessage(t('settings.msg.usernameExists'));
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
      setMessage(t('settings.msg.userCreated'));
    }

    setUserForm({
      name: '',
      username: '',
      password: '',
      permissions: {
        members: true,
        chanda: true,
        donationAds: true,
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
      setMessage(t('settings.msg.adminCannotDelete'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (confirm(t('settings.confirmDeleteUser'))) {
      setUsers(users.filter(u => u.id !== id));
      setMessage(t('settings.msg.userDeleted'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeveloperSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDeveloperInfo(devForm);
    setMessage(t('settings.msg.developerUpdated'));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleLanguageChange = (lang: typeof language) => {
    setLanguage(lang);
    setMessage(t('settings.msg.languageUpdated'));
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeading>{t('settings.pageTitle')}</PageHeading>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('committee')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'committee'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Building2 size={20} />
            {t('settings.tab.committee')}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'password'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Lock size={20} />
            {t('settings.tab.password')}
          </button>
          {currentUser?.isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === 'users'
                  ? 'border-orange-600 text-orange-600 bg-orange-50'
                  : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
              }`}
            >
              <Users size={20} />
              {t('settings.tab.users')}
            </button>
          )}
          <button
            onClick={() => setActiveTab('language')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'language'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Languages size={20} />
            {t('settings.tab.language')}
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'developer'
                ? 'border-orange-600 text-orange-600 bg-orange-50'
                : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <Code size={20} />
            {t('settings.tab.developer')}
          </button>
        </div>

        <div className="p-6">
          {/* Committee Info Tab */}
          {activeTab === 'committee' && (
            <form onSubmit={handleCommitteeSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.uploadLogo')}</label>
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
                      {t('settings.removeLogo')}
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-1">{t('settings.uploadLogoHint')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.establishedYear')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.established}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, established: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 2019`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.registrationNumber')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.regNumber}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, regNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 80014864`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.associationName')}</label>
                <input
                  type="text"
                  required
                  value={committeeForm.association}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, association: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('settings.associationName')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.post')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.post}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, post: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={t('settings.post')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.pinCode')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.pinCode}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, pinCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 741239`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.districtPS')}</label>
                <input
                  type="text"
                  required
                  value={committeeForm.districtPS}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, districtPS: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('settings.districtPS')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.mobile1')}</label>
                  <input
                    type="tel"
                    required
                    value={committeeForm.mobile1}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 9775767402`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.mobile2')}</label>
                  <input
                    type="tel"
                    value={committeeForm.mobile2 || ''}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 9876543210`}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <Save size={20} />
                {t('common.save')}
              </button>
            </form>
          )}

          {/* Password Change Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.currentPassword')}</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.newPassword')}</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.confirmPassword')}</label>
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
                {t('settings.changePassword')}
              </button>
            </form>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && currentUser?.isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">{t('settings.userManagement')}</h3>
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
                        donationAds: true,
                        expenses: true,
                        treasury: true,
                        settings: false,
                      },
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Plus size={20} />
                  {t('settings.createNewUser')}
                </button>
              </div>

              {showUserForm && (
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4">
                    {editingUserId ? t('settings.editUser') : t('settings.createNewUser')}
                  </h4>
                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.name')} *</label>
                        <input
                          type="text"
                          required
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.username')}</label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.password')}</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-3">{t('settings.permissions')}</label>
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
                              {t(PERMISSION_LABEL_KEYS[key])}
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
                        {editingUserId ? t('common.update') : t('common.add')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserForm(false);
                          setEditingUserId(null);
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        {t('common.cancel')}
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
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('settings.table.name')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('settings.table.username')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('settings.table.type')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('settings.table.permissions')}</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">{t('settings.table.action')}</th>
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
                            {user.isAdmin ? t('header.admin') : t('header.user')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {Object.entries(user.permissions)
                            .filter(([_, value]) => value)
                            .map(([key]) => t(PERMISSION_LABEL_KEYS[key]))
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

          {/* Language Tab */}
          {activeTab === 'language' && (
            <div className="space-y-4 max-w-md">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">{t('settings.language.title')}</h3>
                <p className="text-sm text-gray-500 mb-4">{t('settings.language.description')}</p>
              </div>
              <div className="space-y-3">
                {LANGUAGES.map((opt) => (
                  <label
                    key={opt.code}
                    className={`flex items-center justify-between gap-3 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      language === opt.code
                        ? 'border-orange-600 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="language"
                        checked={language === opt.code}
                        onChange={() => handleLanguageChange(opt.code)}
                        className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="font-medium text-gray-800">{opt.nativeLabel}</span>
                    </div>
                    <span className="text-sm text-gray-500">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Developer Info Tab */}
          {activeTab === 'developer' && (
            <form onSubmit={handleDeveloperSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.developerName')}</label>
                <input
                  type="text"
                  required
                  value={devForm.name}
                  onChange={(e) => setDevForm({ ...devForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.email')}</label>
                <input
                  type="email"
                  required
                  value={devForm.email}
                  onChange={(e) => setDevForm({ ...devForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.phoneNumber')}</label>
                <input
                  type="tel"
                  required
                  value={devForm.phone}
                  onChange={(e) => setDevForm({ ...devForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.appVersion')}</label>
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
                {t('common.save')}
              </button>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2">{t('settings.currentInfo')}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>{t('settings.label.name')}</strong> {developerInfo.name}</p>
                  <p><strong>{t('settings.label.email')}</strong> {developerInfo.email}</p>
                  <p><strong>{t('settings.label.phone')}</strong> {developerInfo.phone}</p>
                  <p><strong>{t('settings.label.version')}</strong> {developerInfo.version}</p>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
