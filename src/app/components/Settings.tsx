import { useEffect, useState } from 'react';
import { Save, Plus, Edit2, Trash2, Building2, Lock, Users, Code, Languages, Ban, CheckCircle2 } from 'lucide-react';
import { User, CommitteeInfo } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, TranslationKey } from '../i18n/translations';
import { uploadLogo, DeveloperInfo } from '../lib/db';
import { FormModal } from './FormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface SettingsProps {
  committeeInfo: CommitteeInfo;
  setCommitteeInfo: (info: CommitteeInfo) => void;
  users: User[];
  currentUser: User | null;
  developerInfo: DeveloperInfo;
  setDeveloperInfo: (info: DeveloperInfo) => void;
  onCreateUser: (name: string, username: string, password: string, permissions: User['permissions'], canEdit: boolean, canDelete: boolean, canBulkImport: boolean) => Promise<User>;
  onUpdateUser: (userId: string, name: string, permissions: User['permissions'], canEdit: boolean, canDelete: boolean, canBulkImport: boolean, newPassword?: string) => Promise<User>;
  onDeleteUser: (userId: string) => Promise<boolean>;
  onSetUserActive: (userId: string, isActive: boolean) => Promise<User>;
  onChangeOwnPassword: (userId: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  initialTab?: SettingsTab;
  tabRequestId?: number; // bumped by the caller each time it wants to force-select initialTab, even if it's the same tab as before
}

export type SettingsTab = 'committee' | 'password' | 'users' | 'developer' | 'language';

const PERMISSION_LABEL_KEYS: Record<string, TranslationKey> = {
  members: 'permission.members',
  chanda: 'permission.chanda',
  donationAds: 'permission.donationAds',
  expenses: 'permission.expenses',
  treasury: 'permission.treasury',
  settings: 'permission.settings',
  loans: 'permission.loans',
  vendors: 'permission.vendors',
  tasks: 'permission.tasks',
  estimation: 'permission.estimation',
};

export function Settings({
  committeeInfo,
  setCommitteeInfo,
  users,
  currentUser,
  developerInfo,
  setDeveloperInfo,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onSetUserActive,
  onChangeOwnPassword,
  initialTab,
  tabRequestId,
}: SettingsProps) {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'committee');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabRequestId]);
  const [committeeForm, setCommitteeForm] = useState(committeeInfo);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showUserForm, setShowUserForm] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    canEdit: true,
    canDelete: true,
    canBulkImport: true,
    permissions: {
      members: true,
      chanda: true,
      donationAds: true,
      expenses: true,
      treasury: true,
      loans: true,
      vendors: true,
      tasks: true,
      estimation: true,
      settings: false,
    },
  });
  const [message, setMessage] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const handleCommitteeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommitteeInfo(committeeForm);
    setMessage(t('settings.msg.committeeUpdated'));
    setTimeout(() => setMessage(''), 3000);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

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

    const ok = await onChangeOwnPassword(currentUser.id, passwordForm.currentPassword, passwordForm.newPassword);
    if (!ok) {
      setMessage(t('settings.msg.wrongCurrentPassword'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setMessage(t('settings.msg.passwordChanged'));
    setTimeout(() => setMessage(''), 3000);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingUserId) {
        // Edit existing user (password only changes if a new one was typed)
        await onUpdateUser(editingUserId, userForm.name, userForm.permissions, userForm.canEdit, userForm.canDelete, userForm.canBulkImport, userForm.password || undefined);
        setMessage(t('settings.msg.userUpdated'));
      } else {
        // Check if username already exists
        if (users.some(u => u.username === userForm.username)) {
          setMessage(t('settings.msg.usernameExists'));
          setTimeout(() => setMessage(''), 3000);
          return;
        }

        await onCreateUser(userForm.name, userForm.username, userForm.password, userForm.permissions, userForm.canEdit, userForm.canDelete, userForm.canBulkImport);
        setMessage(t('settings.msg.userCreated'));
      }
    } catch (err) {
      console.error('Failed to save user', err);
      setMessage(t('common.saveError'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUserForm({
      name: '',
      username: '',
      password: '',
      canEdit: true,
      canDelete: true,
      canBulkImport: true,
      permissions: {
        members: true,
        chanda: true,
        donationAds: true,
        expenses: true,
        treasury: true,
        loans: true,
        vendors: true,
        tasks: true,
        estimation: true,
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
      password: '', // left blank; only sent if the admin types a new one
      canEdit: user.canEdit !== false,
      canDelete: user.canDelete !== false,
      canBulkImport: user.canBulkImport !== false,
      permissions: { vendors: true, tasks: true, estimation: true, ...user.permissions },
    });
    setEditingUserId(user.id);
    setShowUserForm(true);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (user.isAdmin) {
      setMessage(t('settings.msg.adminCannotDelete'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setDeleteUserTarget(user);
  };

  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    const ok = await onDeleteUser(deleteUserTarget.id);
    setMessage(ok ? t('settings.msg.userDeleted') : t('common.saveError'));
    setTimeout(() => setMessage(''), 3000);
    setDeleteUserTarget(null);
  };

  const handleToggleUserActive = async (user: User) => {
    const nextActive = user.isActive === false;
    if (!nextActive && !confirm(t('settings.confirmDisableUser'))) return;
    try {
      await onSetUserActive(user.id, nextActive);
      setMessage(nextActive ? t('settings.msg.userEnabled') : t('settings.msg.userDisabled'));
    } catch (err) {
      console.error('Failed to change user active state', err);
      setMessage(t('common.saveError'));
    }
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
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('committee')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'committee'
                ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Building2 size={20} />
            {t('settings.tab.committee')}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'password'
                ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                  ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Languages size={20} />
            {t('settings.tab.language')}
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'developer'
                ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
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
            <fieldset disabled={currentUser?.canEdit === false} className="space-y-4 disabled:opacity-60">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.uploadLogo')}</label>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoUploading(true);
                    try {
                      const url = await uploadLogo(file);
                      setCommitteeForm({ ...committeeForm, logo: url });
                    } catch (err) {
                      console.error('Logo upload failed', err);
                      setMessage(t('common.saveError'));
                      setTimeout(() => setMessage(''), 3000);
                    } finally {
                      setLogoUploading(false);
                    }
                  }}
                  disabled={logoUploading}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none disabled:opacity-60"
                />
                {logoUploading && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('settings.uploadingLogo')}</p>}
                {committeeForm.logo && (
                  <div className="mt-3 flex items-center gap-4">
                    <div className="w-20 h-20 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
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
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('settings.uploadLogoHint')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.establishedYear')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.established}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, established: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 2019`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.registrationNumber')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.regNumber}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, regNumber: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 80014864`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.associationName')}</label>
                <input
                  type="text"
                  required
                  value={committeeForm.association}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, association: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('settings.associationName')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.address')}</label>
                <textarea
                  value={committeeForm.address}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('settings.addressPlaceholder')}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.post')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.post}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, post: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={t('settings.post')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.pinCode')}</label>
                  <input
                    type="text"
                    required
                    value={committeeForm.pinCode}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, pinCode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 741239`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.districtPS')}</label>
                <input
                  type="text"
                  required
                  value={committeeForm.districtPS}
                  onChange={(e) => setCommitteeForm({ ...committeeForm, districtPS: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  placeholder={t('settings.districtPS')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.mobile1')}</label>
                  <input
                    type="tel"
                    required
                    value={committeeForm.mobile1}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile1: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={`${t('common.egPrefix')}: 9775767402`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.mobile2')}</label>
                  <input
                    type="tel"
                    value={committeeForm.mobile2 || ''}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, mobile2: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
            </fieldset>
            </form>
          )}

          {/* Password Change Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.currentPassword')}</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.newPassword')}</label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.confirmPassword')}</label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('settings.userManagement')}</h3>
                <button
                  onClick={() => {
                    setShowUserForm(true);
                    setEditingUserId(null);
                    setUserForm({
                      name: '',
                      username: '',
                      password: '',
                      canEdit: true,
                      canDelete: true,
                      canBulkImport: true,
                      permissions: {
                        members: true,
                        chanda: true,
                        donationAds: true,
                        expenses: true,
                        treasury: true,
                        loans: true,
                        vendors: true,
                        tasks: true,
                        estimation: true,
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

              <FormModal
                open={showUserForm}
                title={editingUserId ? t('settings.editUser') : t('settings.createNewUser')}
                onClose={() => { setShowUserForm(false); setEditingUserId(null); }}
                footer={
                  <>
                    <button
                      type="submit"
                      form="user-form"
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                    >
                      {editingUserId ? t('common.update') : t('common.add')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowUserForm(false); setEditingUserId(null); }}
                      className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                    >
                      {t('common.cancel')}
                    </button>
                  </>
                }
              >
                  <form id="user-form" onSubmit={handleUserSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.name')} *</label>
                        <input
                          type="text"
                          required
                          value={userForm.name}
                          onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.username')}</label>
                        <input
                          type="text"
                          required
                          value={userForm.username}
                          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          disabled={!!editingUserId}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.password')} {editingUserId ? `(${t('settings.leaveBlankToKeep')})` : ''}
                        </label>
                        <input
                          type="password"
                          required={!editingUserId}
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settings.permissions')}</label>
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
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {t(PERMISSION_LABEL_KEYS[key])}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settings.accessLevel')}</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label
                          className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            userForm.canEdit && userForm.canDelete ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accessLevel"
                            checked={userForm.canEdit && userForm.canDelete}
                            onChange={() => setUserForm({ ...userForm, canEdit: true, canDelete: true })}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{t('settings.accessLevel.editDelete')}</span>
                        </label>
                        <label
                          className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            userForm.canEdit && !userForm.canDelete ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accessLevel"
                            checked={userForm.canEdit && !userForm.canDelete}
                            onChange={() => setUserForm({ ...userForm, canEdit: true, canDelete: false })}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{t('settings.accessLevel.edit')}</span>
                        </label>
                        <label
                          className={`flex items-center gap-2 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                            !userForm.canEdit ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="accessLevel"
                            checked={!userForm.canEdit}
                            onChange={() => setUserForm({ ...userForm, canEdit: false, canDelete: false })}
                            className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{t('settings.accessLevel.view')}</span>
                        </label>
                      </div>
                    </div>

                    {userForm.canEdit && (
                      <div>
                        <label className="flex items-center gap-3 px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-orange-300 transition-colors">
                          <input
                            type="checkbox"
                            checked={userForm.canBulkImport}
                            onChange={(e) => setUserForm({ ...userForm, canBulkImport: e.target.checked })}
                            className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <span>
                            <span className="block text-sm text-gray-800 dark:text-gray-200 font-medium">{t('settings.bulkImport')}</span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">{t('settings.bulkImport.description')}</span>
                          </span>
                        </label>
                      </div>
                    )}

                  </form>
              </FormModal>

              {/* Users List */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.table.name')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.table.username')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.table.type')}</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.table.permissions')}</th>
                      <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('settings.table.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{user.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{user.username}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {user.isAdmin ? t('header.admin') : t('header.user')}
                            </span>
                            {!user.isAdmin && (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                user.canEdit === false
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                  : user.canDelete === false
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {user.canEdit === false
                                  ? t('settings.accessLevel.view')
                                  : user.canDelete === false
                                  ? t('settings.accessLevel.edit')
                                  : t('settings.accessLevel.editDelete')}
                              </span>
                            )}
                            {!user.isAdmin && user.canEdit !== false && user.canBulkImport === false && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                {t('settings.bulkImport.off')}
                              </span>
                            )}
                            {user.isActive === false && (
                              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                {t('settings.userDisabled')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
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
                                  onClick={() => handleToggleUserActive(user)}
                                  title={user.isActive === false ? t('settings.enableUser') : t('settings.disableUser')}
                                  className={`p-2 rounded-lg transition-colors ${
                                    user.isActive === false
                                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10'
                                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  {user.isActive === false ? <CheckCircle2 size={18} /> : <Ban size={18} />}
                                </button>
                                <button
                                  onClick={() => handleEditUser(user)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{t('settings.language.title')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settings.language.description')}</p>
              </div>
              <div className="space-y-3">
                {LANGUAGES.map((opt) => (
                  <label
                    key={opt.code}
                    className={`flex items-center justify-between gap-3 px-4 py-3 border-2 rounded-lg cursor-pointer transition-colors ${
                      language === opt.code
                        ? 'border-orange-600 bg-orange-50 dark:bg-orange-500/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-orange-300'
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
                      <span className="font-medium text-gray-800 dark:text-gray-200">{opt.nativeLabel}</span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Developer Info Tab — read-only; only the platform Super Admin
              can edit this (it's vendor/software info, not committee data) */}
          {activeTab === 'developer' && (
            <div className="max-w-md">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Managed by the platform administrator.
              </p>
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong>{t('settings.label.name')}</strong> {developerInfo.name}</p>
                  <p><strong>{t('settings.label.email')}</strong> {developerInfo.email}</p>
                  <p><strong>{t('settings.label.phone')}</strong> {developerInfo.phone}</p>
                  <p><strong>{t('settings.label.version')}</strong> {developerInfo.version}</p>
                  {developerInfo.changelog && (
                    <ul className="list-disc pl-5 pt-1 space-y-0.5">
                      {developerInfo.changelog.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        open={!!deleteUserTarget}
        itemLabel={deleteUserTarget?.name}
        onCancel={() => setDeleteUserTarget(null)}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
}
