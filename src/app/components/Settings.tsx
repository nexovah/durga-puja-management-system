import { useEffect, useState, useRef } from 'react';
import { Save, Plus, Edit2, Trash2, Building2, Lock, Users, Code, Languages, Ban, CheckCircle2, Eye, EyeOff, RefreshCw, Copy, Check, ReceiptIndianRupee, MoreVertical, Compass, CreditCard } from 'lucide-react';
import { User, CommitteeInfo } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { LANGUAGES, TranslationKey } from '../i18n/translations';
import { uploadLogo, generatePassword, DeveloperInfo, ReceiptSettings, updateReceiptSettingsRequest } from '../lib/db';
import { NAVIGATION_GROUPS } from '../lib/navigationConfig';
import { Billing } from './Billing';
import { FormModal, FormModalCancelButton } from './FormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ToggleSwitch } from './ToggleSwitch';
import { ReceiptCard, ReceiptCardData } from './ReceiptCard';
import { Toast } from './Toast';

interface SettingsProps {
  committeeInfo: CommitteeInfo;
  setCommitteeInfo: (info: CommitteeInfo) => void;
  receiptSettings: ReceiptSettings;
  setReceiptSettings: (settings: ReceiptSettings) => void;
  users: User[];
  currentUser: User | null;
  developerInfo: DeveloperInfo;
  setDeveloperInfo: (info: DeveloperInfo) => void;
  onCreateUser: (name: string, username: string, password: string, permissions: User['permissions'], canEdit: boolean, canDelete: boolean, canBulkImport: boolean, email?: string) => Promise<User>;
  onUpdateUser: (userId: string, name: string, permissions: User['permissions'], canEdit: boolean, canDelete: boolean, canBulkImport: boolean, newPassword?: string, email?: string) => Promise<User>;
  onDeleteUser: (userId: string) => Promise<boolean>;
  onSetUserActive: (userId: string, isActive: boolean) => Promise<User>;
  onChangeOwnPassword: (userId: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  initialTab?: SettingsTab;
  tabRequestId?: number; // bumped by the caller each time it wants to force-select initialTab, even if it's the same tab as before
  onSubscriptionExtended?: () => void | Promise<void>;
}

export type SettingsTab = 'committee' | 'receipts' | 'navigation' | 'billing' | 'password' | 'users' | 'developer' | 'language';

const VALID_SETTINGS_TABS: SettingsTab[] = ['committee', 'receipts', 'navigation', 'billing', 'password', 'users', 'developer', 'language'];

// /settings/<tab> — refreshing or sharing a link lands back on that tab
// instead of always resetting to 'committee'. Mirrors SuperAdminSettings.tsx's
// getTabFromPath()/pushState/popstate pattern.
function getSettingsTabFromPath(): SettingsTab | null {
  const match = window.location.pathname.match(/^\/settings\/([^/]+)/);
  const tab = match?.[1];
  return tab && (VALID_SETTINGS_TABS as string[]).includes(tab) ? (tab as SettingsTab) : null;
}

const PERMISSION_LABEL_KEYS: Record<string, TranslationKey> = {
  members: 'permission.members',
  chanda: 'permission.chanda',
  // 'donationAds' is legacy (pre menu-split) — kept only so a user saved
  // before the split still renders a label instead of crashing; every new
  // user form uses 'donation'/'ads' below instead.
  donationAds: 'permission.donationAds',
  donation: 'permission.donation',
  ads: 'permission.ads',
  expenses: 'permission.expenses',
  treasury: 'permission.treasury',
  settings: 'permission.settings',
  loans: 'permission.loans',
  vendors: 'permission.vendors',
  tasks: 'permission.tasks',
  estimation: 'permission.estimation',
  assets: 'permission.assets',
  documents: 'permission.documents',
};

export function Settings({
  committeeInfo,
  setCommitteeInfo,
  receiptSettings,
  setReceiptSettings,
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
  onSubscriptionExtended,
}: SettingsProps) {
  const { t, language, setLanguage } = useLanguage();
  const [activeTab, setActiveTabState] = useState<SettingsTab>(() => getSettingsTabFromPath() || initialTab || 'committee');

  const setActiveTab = (tab: SettingsTab) => {
    setActiveTabState(tab);
    window.history.pushState(null, '', `/settings/${tab}`);
  };

  const skipFirstTabRequest = useRef(true);
  useEffect(() => {
    // Skip on mount — tabRequestId's initial value would otherwise force
    // initialTab (defaults to 'committee' in App.tsx) over whatever tab the
    // URL itself resolved to on load. Only react to a later bump, i.e. an
    // explicit deep-link from elsewhere in the app (onGoToSettingsTab).
    if (skipFirstTabRequest.current) {
      skipFirstTabRequest.current = false;
      return;
    }
    if (initialTab) setActiveTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabRequestId]);

  useEffect(() => {
    const onPopState = () => {
      const tab = getSettingsTabFromPath();
      if (tab) setActiveTabState(tab);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const path = `/settings/${activeTab}`;
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [committeeForm, setCommitteeForm] = useState(committeeInfo);
  const [receiptForm, setReceiptForm] = useState(receiptSettings);
  const [openUserMenuId, setOpenUserMenuId] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCommitteeForm(committeeInfo);
  }, [committeeInfo]);

  const handleToggleNav = async (key: string, visible: boolean) => {
    const currentHidden = committeeInfo.hiddenNavKeys || [];
    const nextHidden = visible
      ? currentHidden.filter(k => k !== key)
      : (currentHidden.includes(key) ? currentHidden : [...currentHidden, key]);

    const updated = { ...committeeInfo, hiddenNavKeys: nextHidden };
    setCommitteeForm(updated);
    try {
      await setCommitteeInfo(updated);
      setMessage(t('settings.nav.saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to update navigation visibility', err);
      setMessage(t('common.saveError'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleShowAllNav = async () => {
    const updated = { ...committeeInfo, hiddenNavKeys: [] };
    setCommitteeForm(updated);
    try {
      await setCommitteeInfo(updated);
      setMessage(t('settings.nav.saved'));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to reset navigation visibility', err);
      setMessage(t('common.saveError'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setOpenUserMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [savingReceiptSettings, setSavingReceiptSettings] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [headerLogoUploading, setHeaderLogoUploading] = useState(false);
  const [bandImageUploading, setBandImageUploading] = useState(false);

  const handleReceiptSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReceiptSettings(true);
    try {
      const updated = await updateReceiptSettingsRequest(receiptForm);
      setReceiptForm(updated);
      setReceiptSettings(updated);
      try { localStorage.setItem('puja_receipt_designed', 'true'); } catch {}
      setMessage(t('settings.msg.receiptSettingsUpdated'));
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Failed to save receipt settings', err);
      setMessage(t('common.saveError'));
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSavingReceiptSettings(false);
    }
  };

  const receiptPreviewData: ReceiptCardData = {
    committeeName: committeeInfo.name || 'Your Committee',
    committeeAddress: committeeInfo.address || null,
    committeeEmail: committeeInfo.email || null,
    committeePhone: committeeInfo.mobile1 || committeeInfo.phone || null,
    committeeLogo: committeeInfo.logo || null,
    committeeRegNo: committeeInfo.regNumber || null,
    receiptNumber: `${receiptForm.prefix}${String(receiptForm.startNumber).padStart(receiptForm.digits, '0')}`,
    donorName: 'Rohan Kulkarni',
    phone: '98765 43210',
    billNumber: '101',
    numPersons: 4,
    amount: 2100,
    paidMethod: 'qrScan',
    date: new Date().toISOString().slice(0, 10),
    collectedBy: null,
    colorTheme: receiptForm.colorTheme,
    customColorHex: receiptForm.customColorHex || null,
    headerSymbol: receiptForm.headerSymbol,
    blessingLine: receiptForm.blessingLine,
    receiptLanguage: receiptForm.receiptLanguage,
    showAmountWords: receiptForm.showAmountWords,
    showPersons: receiptForm.showPersons,
    showPaymentMethod: receiptForm.showPaymentMethod,
    showCollectedBy: receiptForm.showCollectedBy,
    showLogo: receiptForm.showLogo,
    showAddress: receiptForm.showAddress,
    showContact: receiptForm.showContact,
    showRegNo: receiptForm.showRegNo,
    showUpiId: receiptForm.showUpiId,
    upiId: receiptForm.upiId || null,
    signatoryLabel: receiptForm.signatoryLabel,
    signatureUrl: receiptForm.signatureUrl || null,
    show80g: receiptForm.show80g,
    reg80g: receiptForm.reg80g || null,
    pan: receiptForm.pan || null,
    declarationText: receiptForm.declarationText || null,
    paperSize: receiptForm.paperSize,
    orientation: receiptForm.orientation,
    headerLogoUrl: receiptForm.headerLogoUrl || null,
    headerLogoSize: receiptForm.headerLogoSize,
    headerTitle: receiptForm.headerTitle || null,
    headerSubtitle1: receiptForm.headerSubtitle1 || null,
    headerSubtitle2: receiptForm.headerSubtitle2 || null,
    headerBandTitle: receiptForm.headerBandTitle || null,
    bandMode: receiptForm.bandMode,
    bandImageUrl: receiptForm.bandImageUrl || null,
  };
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showUserForm, setShowUserForm] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<User | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userPasswordCopied, setUserPasswordCopied] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    canEdit: true,
    canDelete: true,
    canBulkImport: true,
    permissions: {
      members: true,
      chanda: true,
      donation: true,
      ads: true,
      expenses: true,
      treasury: true,
      loans: true,
      vendors: true,
      tasks: true,
      estimation: true,
      assets: true,
      documents: true,
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

    if (!userForm.email.trim()) {
      setMessage(t('settings.msg.emailRequired'));
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      if (editingUserId) {
        // Edit existing user (password only changes if a new one was typed)
        await onUpdateUser(editingUserId, userForm.name, userForm.permissions, userForm.canEdit, userForm.canDelete, userForm.canBulkImport, userForm.password || undefined, userForm.email.trim());
        setMessage(t('settings.msg.userUpdated'));
      } else {
        // Check if username already exists
        if (users.some(u => u.username === userForm.username)) {
          setMessage(t('settings.msg.usernameExists'));
          setTimeout(() => setMessage(''), 3000);
          return;
        }

        await onCreateUser(userForm.name, userForm.username, userForm.password, userForm.permissions, userForm.canEdit, userForm.canDelete, userForm.canBulkImport, userForm.email.trim());
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
      email: '',
      password: '',
      canEdit: true,
      canDelete: true,
      canBulkImport: true,
      permissions: {
        members: true,
        chanda: true,
        donation: true,
        ads: true,
        expenses: true,
        treasury: true,
        loans: true,
        vendors: true,
        tasks: true,
        estimation: true,
        assets: true,
        documents: true,
        settings: false,
      },
    });
    setShowUserForm(false);
    setEditingUserId(null);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleEditUser = (user: User) => {
    // Users saved before donation/ads were split only have a combined
    // 'donationAds' key — migrate it into 'donation'/'ads' here (both
    // inherit its value) and drop it, so the checkbox grid doesn't render
    // a stray extra "Donation/Advertisement" box alongside the new ones.
    const { donationAds: legacyDonationAds, ...restPermissions } = user.permissions as User['permissions'] & { donationAds?: boolean };
    setUserForm({
      name: user.name,
      username: user.username,
      email: user.email || '',
      password: '', // left blank; only sent if the admin types a new one
      canEdit: user.canEdit !== false,
      canDelete: user.canDelete !== false,
      canBulkImport: user.canBulkImport !== false,
      permissions: {
        vendors: true, tasks: true, estimation: true,
        // New menus added after this user's permissions were last saved
        // should default to granted (no Settings access) rather than
        // silently missing, so existing users aren't locked out of them.
        assets: true, documents: true,
        donation: legacyDonationAds ?? true,
        ads: legacyDonationAds ?? true,
        ...restPermissions,
      },
    });
    setEditingUserId(user.id);
    setShowUserForm(true);
    setShowUserPassword(false);
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

      <Toast message={message || null} onDone={() => setMessage('')} />

      {/* Left-nav settings shell — matches Super Admin's Settings layout */}
      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-56 shrink-0 sm:sticky sm:top-20 sm:self-start">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex sm:flex-col gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('committee')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'committee'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Building2 size={18} />
              {t('settings.tab.committee')}
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'receipts'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <ReceiptIndianRupee size={18} />
              {t('settings.tab.receipts')}
            </button>
            <button
              onClick={() => setActiveTab('navigation')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'navigation'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Compass size={18} />
              {t('settings.tab.navigation')}
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab('billing')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'billing'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <CreditCard size={18} />
                {t('settings.tab.billing')}
              </button>
            )}
            <button
              onClick={() => setActiveTab('password')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'password'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Lock size={18} />
              {t('settings.tab.password')}
            </button>
            {currentUser?.isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === 'users'
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Users size={18} />
                {t('settings.tab.users')}
              </button>
            )}
            <button
              onClick={() => setActiveTab('language')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'language'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Languages size={18} />
              {t('settings.tab.language')}
            </button>
            <button
              onClick={() => setActiveTab('developer')}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === 'developer'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Code size={18} />
              {t('settings.tab.developer')}
            </button>
          </div>
        </nav>

        <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {/* Committee Info Tab */}
          {activeTab === 'committee' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('settings.tab.committee')}</h3>
              <form onSubmit={handleCommitteeSubmit} className="space-y-4">
              <fieldset disabled={currentUser?.canEdit === false} className="space-y-4 disabled:opacity-60">
              <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  disabled={logoUploading || currentUser?.canEdit === false}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoUploading(true);
                    try {
                      const url = await uploadLogo(file, committeeForm.logo);
                      setCommitteeForm({ ...committeeForm, logo: url });
                    } catch (err) {
                      console.error('Logo upload failed', err);
                      setMessage(t('common.saveError'));
                      setTimeout(() => setMessage(''), 3000);
                    } finally {
                      setLogoUploading(false);
                      if (logoInputRef.current) logoInputRef.current.value = '';
                    }
                  }}
                />

                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  {t('settings.uploadLogo')}
                </label>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                  {/* Left: Avatar/Logo preview */}
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                    {committeeForm.logo ? (
                      committeeForm.logo.startsWith('data:') || committeeForm.logo.startsWith('http') ? (
                        <img
                          src={committeeForm.logo}
                          alt="Committee Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl leading-none">{committeeForm.logo}</span>
                      )
                    ) : (
                      <Building2 className="text-gray-400 dark:text-gray-500" size={36} />
                    )}
                    {logoUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                        <RefreshCw size={22} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* Right: Actions and helper text */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={logoUploading || currentUser?.canEdit === false}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {logoUploading ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            <span>{t('settings.uploadingLogo')}</span>
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            <span>{committeeForm.logo ? t('settings.uploadNewLogo') : t('settings.uploadNewLogo')}</span>
                          </>
                        )}
                      </button>

                      {committeeForm.logo && (
                        <button
                          type="button"
                          onClick={() => setCommitteeForm({ ...committeeForm, logo: '' })}
                          disabled={logoUploading || currentUser?.canEdit === false}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 size={15} className="text-gray-500 dark:text-gray-400" />
                          <span>{t('settings.removeLogo')}</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('settings.uploadLogoHint')}
                    </p>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.email')}</label>
                  <input
                    type="email"
                    value={committeeForm.email}
                    onChange={(e) => setCommitteeForm({ ...committeeForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={t('settings.email')}
                  />
                </div>
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
            </div>
          )}

          {/* Receipt Settings Tab */}
          {activeTab === 'receipts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('settings.tab.receipts')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  How your committee's digital receipts look and are numbered, for every Chanda collection.
                </p>
              </div>
              <div className="flex flex-col lg:flex-row lg:gap-16">
                <form onSubmit={handleReceiptSettingsSubmit} className="space-y-6 flex-1 min-w-0 max-w-xl">

                  {/* Receipt style */}
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Receipt style</h4>
                    <div className="inline-flex p-1 rounded-lg bg-orange-50/80 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/40">
                      <button
                        type="button"
                        onClick={() => setReceiptForm({ ...receiptForm, receiptStyle: 'designed' })}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                          receiptForm.receiptStyle === 'designed'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400'
                        }`}
                      >
                        Design a receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptForm({ ...receiptForm, receiptStyle: 'printed' })}
                        className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                          receiptForm.receiptStyle === 'printed'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400'
                        }`}
                      >
                        Use my printed receipt
                      </button>
                    </div>
                  </div>

                  {receiptForm.receiptStyle === 'printed' ? (
                    <div className="border-t border-gray-100 dark:border-gray-800 pt-10 pb-6 text-center">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Coming soon</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                        Uploading your own printed receipt design isn't available yet. Switch back to "Design a receipt" to configure and use the digital receipt.
                      </p>
                    </div>
                  ) : (
                  <>

                  {/* Receipt language */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Receipt language <span className="text-xs font-normal text-orange-500">(every label on the receipt)</span>
                    </h4>
                    <div className="flex gap-2 mt-2">
                      {LANGUAGES.map(l => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => setReceiptForm({ ...receiptForm, receiptLanguage: l.code as ReceiptSettings['receiptLanguage'] })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                            receiptForm.receiptLanguage === l.code
                              ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Society identity */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Society identity (printed on receipts)</h4>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 mb-4">
                      <ToggleSwitch checked={receiptForm.showLogo} onChange={v => setReceiptForm({ ...receiptForm, showLogo: v })} label="Show logo" />
                      <ToggleSwitch checked={receiptForm.showAddress} onChange={v => setReceiptForm({ ...receiptForm, showAddress: v })} label="Show address" />
                      <ToggleSwitch checked={receiptForm.showContact} onChange={v => setReceiptForm({ ...receiptForm, showContact: v })} label="Show contact" />
                      <ToggleSwitch checked={receiptForm.showRegNo} onChange={v => setReceiptForm({ ...receiptForm, showRegNo: v })} label="Show reg. no." />
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                      These use your logo, address, contact and registration number already set in Settings → {t('settings.tab.committee')}.
                    </p>
                    <ToggleSwitch checked={receiptForm.showUpiId} onChange={v => setReceiptForm({ ...receiptForm, showUpiId: v })} label="Show UPI ID" />
                    {receiptForm.showUpiId && (
                      <input
                        value={receiptForm.upiId}
                        onChange={e => setReceiptForm({ ...receiptForm, upiId: e.target.value })}
                        placeholder="e.g. committee@upi"
                        className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    )}
                  </div>

                  {/* Header — full customization of the top identity block
                      + the gradient band below it. Every field here
                      overrides the matching Committee Info value (logo/
                      title/address/email); left blank, it falls back to
                      Committee Info automatically. */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Header</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                      Overrides the logo, title and text shown at the top of the receipt. Leave any field blank to fall back to Settings → {t('settings.tab.committee')}.
                    </p>

                    <div className="mb-4">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Header logo</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          disabled={headerLogoUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setHeaderLogoUploading(true);
                            try {
                              const url = await uploadLogo(file, receiptForm.headerLogoUrl);
                              setReceiptForm({ ...receiptForm, headerLogoUrl: url });
                            } catch (err) {
                              console.error('Header logo upload failed', err);
                            } finally {
                              setHeaderLogoUploading(false);
                            }
                          }}
                          className="flex-1 text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:text-sm file:font-medium"
                        />
                        {receiptForm.headerLogoUrl && <img src={receiptForm.headerLogoUrl} alt="" className="w-9 h-9 rounded-full object-cover" />}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Leave blank to use your Committee Info logo.</p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Logo size</label>
                      <div className="flex gap-2">
                        {(['small', 'medium', 'large'] as const).map(sz => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setReceiptForm({ ...receiptForm, headerLogoSize: sz })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border-2 transition-colors ${
                              receiptForm.headerLogoSize === sz
                                ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
                        <input
                          value={receiptForm.headerTitle}
                          onChange={e => setReceiptForm({ ...receiptForm, headerTitle: e.target.value })}
                          placeholder={committeeInfo.name || 'Committee name'}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      {receiptForm.bandMode === 'default' && (
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Banner title</label>
                          <input
                            value={receiptForm.headerBandTitle}
                            onChange={e => setReceiptForm({ ...receiptForm, headerBandTitle: e.target.value })}
                            placeholder={committeeInfo.name || 'e.g. Ganesh Utsav 2025'}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Banner band</label>
                        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setReceiptForm({ ...receiptForm, bandMode: 'default' })}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              receiptForm.bandMode === 'default'
                                ? 'bg-orange-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            Text &amp; icon
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceiptForm({ ...receiptForm, bandMode: 'image' })}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                              receiptForm.bandMode === 'image'
                                ? 'bg-orange-600 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            Custom image
                          </button>
                        </div>
                      </div>
                      {receiptForm.bandMode === 'default' ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          Shows the colour gradient, header symbol and banner title below. Switch to Custom image to upload your own designed banner instead.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                            Uploads your own designed banner for this band — it replaces the colour/symbol/title entirely.
                            Recommended size <span className="font-medium">752 × 256px</span> (about 3:1), PNG or JPEG, under <span className="font-medium">150 KB</span>.
                          </p>
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            disabled={bandImageUploading}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setBandImageUploading(true);
                              try {
                                const url = await uploadLogo(file, receiptForm.bandImageUrl);
                                setReceiptForm({ ...receiptForm, bandImageUrl: url });
                              } catch (err) {
                                console.error('Banner image upload failed', err);
                              } finally {
                                setBandImageUploading(false);
                              }
                            }}
                            className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:text-sm file:font-medium"
                          />
                          {receiptForm.bandImageUrl && (
                            <img src={receiptForm.bandImageUrl} alt="" className="w-full mt-2 rounded-lg border border-gray-200 dark:border-gray-700" />
                          )}
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Subtitle 1 (address line)</label>
                        <input
                          value={receiptForm.headerSubtitle1}
                          onChange={e => setReceiptForm({ ...receiptForm, headerSubtitle1: e.target.value })}
                          placeholder={committeeInfo.address || 'Address'}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Subtitle 2 (contact line)</label>
                        <input
                          value={receiptForm.headerSubtitle2}
                          onChange={e => setReceiptForm({ ...receiptForm, headerSubtitle2: e.target.value })}
                          placeholder={committeeInfo.email || 'Email'}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Look */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Look</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Paper size</label>
                        <div className="flex gap-2">
                          {([['a5', 'A5 sheet'], ['thermal80mm', '80mm thermal']] as const).map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setReceiptForm({ ...receiptForm, paperSize: v })}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                                receiptForm.paperSize === v ? 'border-orange-600 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Orientation</label>
                        <div className="flex gap-2">
                          {([['portrait', 'Portrait'], ['landscape', 'Landscape']] as const).map(([v, label]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setReceiptForm({ ...receiptForm, orientation: v })}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                                receiptForm.orientation === v ? 'border-orange-600 text-orange-700 dark:text-orange-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {receiptForm.bandMode === 'default' && (
                      <div className="mb-4">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Header symbol (one glyph/emoji)</label>
                        <input
                          value={receiptForm.headerSymbol}
                          onChange={e => setReceiptForm({ ...receiptForm, headerSymbol: e.target.value })}
                          className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Colour theme</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {(['saffron', 'rose', 'emerald', 'indigo'] as const).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setReceiptForm({ ...receiptForm, colorTheme: c })}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border-2 transition-colors ${
                              receiptForm.colorTheme === c
                                ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setReceiptForm({ ...receiptForm, colorTheme: 'custom' })}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                            receiptForm.colorTheme === 'custom'
                              ? 'border-orange-600 text-orange-700 dark:text-orange-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          Custom
                          {receiptForm.colorTheme === 'custom' && (
                            <input
                              type="color"
                              value={receiptForm.customColorHex}
                              onChange={e => setReceiptForm({ ...receiptForm, customColorHex: e.target.value })}
                              className="w-5 h-5 rounded border-0 p-0 cursor-pointer"
                            />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Blessing line */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Blessing / thank-you line</label>
                    <input
                      value={receiptForm.blessingLine}
                      onChange={e => setReceiptForm({ ...receiptForm, blessingLine: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>

                  {/* Details shown */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Details shown</h4>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      <ToggleSwitch
                        checked={receiptForm.showAmountWords}
                        onChange={v => setReceiptForm({ ...receiptForm, showAmountWords: v })}
                        label="Amount in words"
                      />
                      <ToggleSwitch
                        checked={receiptForm.showPersons}
                        onChange={v => setReceiptForm({ ...receiptForm, showPersons: v })}
                        label="No. of persons"
                      />
                      <ToggleSwitch
                        checked={receiptForm.showPaymentMethod}
                        onChange={v => setReceiptForm({ ...receiptForm, showPaymentMethod: v })}
                        label="Payment method"
                      />
                    </div>
                  </div>

                  {/* Signatory & seal */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Signatory & seal</h4>
                    <div className="mb-4">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Signatory label</label>
                      <input
                        value={receiptForm.signatoryLabel}
                        onChange={e => setReceiptForm({ ...receiptForm, signatoryLabel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Signature &amp; stamp</label>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                        Upload the signature and stamp together, already combined into one image — this shows right-aligned above the signatory line on the receipt.
                      </p>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        disabled={signatureUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setSignatureUploading(true);
                          try {
                            const url = await uploadLogo(file, receiptForm.signatureUrl);
                            setReceiptForm({ ...receiptForm, signatureUrl: url });
                          } catch (err) {
                            console.error('Signature upload failed', err);
                          } finally {
                            setSignatureUploading(false);
                          }
                        }}
                        className="w-full text-xs text-gray-500 dark:text-gray-400 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:text-sm file:font-medium"
                      />
                      {receiptForm.signatureUrl && <img src={receiptForm.signatureUrl} alt="" className="h-14 mt-2 ml-auto object-contain object-right" />}
                    </div>
                  </div>

                  {/* Tax / 80G */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Tax / 80G receipt</h4>
                      <ToggleSwitch checked={receiptForm.show80g} onChange={v => setReceiptForm({ ...receiptForm, show80g: v })} />
                    </div>
                    {receiptForm.show80g && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">80G registration no.</label>
                            <input
                              value={receiptForm.reg80g}
                              onChange={e => setReceiptForm({ ...receiptForm, reg80g: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">PAN</label>
                            <input
                              value={receiptForm.pan}
                              onChange={e => setReceiptForm({ ...receiptForm, pan: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Declaration text</label>
                          <textarea
                            rows={2}
                            value={receiptForm.declarationText}
                            onChange={e => setReceiptForm({ ...receiptForm, declarationText: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Receipt numbering */}
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Receipt numbering</h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
                      Continue your printed receipt-book serials. First contribution receipt will read {receiptForm.prefix}{String(receiptForm.startNumber).padStart(receiptForm.digits, '0')}.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Prefix</label>
                        <input
                          value={receiptForm.prefix}
                          onChange={e => setReceiptForm({ ...receiptForm, prefix: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start number</label>
                        <input
                          type="number"
                          min={1}
                          value={receiptForm.startNumber}
                          onChange={e => setReceiptForm({ ...receiptForm, startNumber: parseInt(e.target.value, 10) || 1 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Digits</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={receiptForm.digits}
                          onChange={e => setReceiptForm({ ...receiptForm, digits: parseInt(e.target.value, 10) || 4 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                      A collection with its own Bill Number already uses that instead, prefixed the same way.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingReceiptSettings}
                    className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors cursor-pointer"
                  >
                    <Save size={20} />
                    {savingReceiptSettings ? 'Saving…' : t('common.save')}
                  </button>
                  </>
                  )}
                </form>

                <div className="lg:w-[420px] shrink-0 mt-8 lg:mt-0 lg:ml-auto lg:sticky lg:top-24 lg:self-start">
                  <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-wide font-medium">Live preview</p>
                    <ReceiptCard data={receiptPreviewData} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tab */}
          {activeTab === 'navigation' && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600">
                      <Compass size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('settings.nav.title')}</h2>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                    {t('settings.nav.desc')}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleShowAllNav}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                  >
                    {t('settings.nav.showAll')}
                  </button>
                  <button
                    type="button"
                    onClick={handleShowAllNav}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    {t('settings.nav.reset')}
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {NAVIGATION_GROUPS.map((group) => {
                  const currentHidden = committeeInfo.hiddenNavKeys || [];
                  const activeCount = group.items.filter(item => !currentHidden.includes(item.key)).length;
                  return (
                    <div key={group.id} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                          {t(group.labelKey)}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          {t('settings.nav.activeCount').replace('{active}', String(activeCount)).replace('{total}', String(group.items.length))}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          const isHidden = currentHidden.includes(item.key);
                          const isVisible = !isHidden;
                          return (
                            <div
                              key={item.key}
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                                isVisible
                                  ? 'bg-gray-50/60 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 hover:border-orange-300 dark:hover:border-orange-500/40 shadow-xs'
                                  : 'bg-gray-100/60 dark:bg-gray-900/60 border-dashed border-gray-300 dark:border-gray-700 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-3">
                                <div
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                    isVisible
                                      ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                                      : 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                                  }`}
                                >
                                  <Icon size={18} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {t(item.labelKey)}
                                  </p>
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                                      isVisible
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                    }`}
                                  >
                                    {isVisible ? (
                                      <>
                                        <CheckCircle2 size={11} /> {t('settings.nav.visible')}
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff size={11} /> {t('settings.nav.hidden')}
                                      </>
                                    )}
                                  </span>
                                </div>
                              </div>

                              <ToggleSwitch
                                checked={isVisible}
                                onChange={(checked) => handleToggleNav(item.key, checked)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 flex items-start gap-2.5 text-xs text-orange-800 dark:text-orange-300">
                <Compass size={16} className="shrink-0 mt-0.5 text-orange-600" />
                <span>{t('settings.nav.settingsAlwaysAccessible')}</span>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && currentUser?.isAdmin && (
            <div className="space-y-6">
              <Billing
                currentUser={currentUser}
                committeeName={committeeInfo.association || committeeInfo.name}
                onSubscriptionExtended={onSubscriptionExtended || (() => {})}
              />
            </div>
          )}

          {/* Password Change Tab */}
          {activeTab === 'password' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('settings.tab.password')}</h3>
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
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && currentUser?.isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{t('settings.userManagement')}</h3>
                <button
                  onClick={() => {
                    setShowUserForm(true);
                    setEditingUserId(null);
                    setShowUserPassword(false);
                    setUserForm({
                      name: '',
                      username: '',
                      email: '',
                      password: '',
                      canEdit: true,
                      canDelete: true,
                      canBulkImport: true,
                      permissions: {
                        members: true,
                        chanda: true,
                        donation: true,
        ads: true,
                        expenses: true,
                        treasury: true,
                        loans: true,
                        vendors: true,
                        tasks: true,
                        estimation: true,
                        assets: true,
                        documents: true,
                        settings: false,
                      },
                    });
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors whitespace-nowrap w-full sm:w-auto"
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
                      className="flex-1 min-w-0 px-2 sm:px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {editingUserId ? t('common.update') : t('common.add')}
                    </button>
                    <FormModalCancelButton onClick={() => { setShowUserForm(false); setEditingUserId(null); }} label={t('common.cancel')} />
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('common.email')} *</label>
                        <input
                          type="email"
                          required
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          placeholder="Required — for password reset & login alerts"
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('settings.password')} {editingUserId ? `(${t('settings.leaveBlankToKeep')})` : ''}
                        </label>
                        <div className="relative">
                          <input
                            type={showUserPassword ? 'text' : 'password'}
                            required={!editingUserId}
                            value={userForm.password}
                            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                            className="w-full pl-4 pr-20 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          />
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {userForm.password && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(userForm.password).then(() => {
                                    setUserPasswordCopied(true);
                                    setTimeout(() => setUserPasswordCopied(false), 2000);
                                  });
                                }}
                                title="Copy password"
                                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                              >
                                {userPasswordCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => { setUserForm({ ...userForm, password: generatePassword() }); setShowUserPassword(true); }}
                              title="Generate password"
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowUserPassword(s => !s)}
                              title={showUserPassword ? 'Hide' : 'Show'}
                              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              {showUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
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

              {/* Users List — cards on mobile, table on sm+ (a 5-column
                  table with badges/actions doesn't fit a phone width). */}
              <div className="sm:hidden space-y-3">
                {users.map((user) => (
                  <div key={user.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.username}</p>
                      </div>
                      {!user.isAdmin && (
                        <div className="relative shrink-0" ref={openUserMenuId === user.id ? userMenuRef : undefined}>
                          <button
                            onClick={() => setOpenUserMenuId(o => (o === user.id ? null : user.id))}
                            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openUserMenuId === user.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                              <button onClick={() => { setOpenUserMenuId(null); handleToggleUserActive(user); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                {user.isActive === false ? <CheckCircle2 size={14} className="text-green-600" /> : <Ban size={14} className="text-gray-500" />}
                                {user.isActive === false ? t('settings.enableUser') : t('settings.disableUser')}
                              </button>
                              <button onClick={() => { setOpenUserMenuId(null); handleEditUser(user); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Edit2 size={14} className="text-blue-600" /> Edit
                              </button>
                              <button onClick={() => { setOpenUserMenuId(null); handleDeleteUser(user.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

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

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.entries(user.permissions)
                        .filter(([_, value]) => value)
                        .map(([key]) => t(PERMISSION_LABEL_KEYS[key]))
                        .join(', ')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="hidden sm:block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
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
                          {!user.isAdmin && (
                            <div className="relative inline-block" ref={openUserMenuId === user.id ? userMenuRef : undefined}>
                              <button
                                onClick={() => setOpenUserMenuId(o => (o === user.id ? null : user.id))}
                                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                <MoreVertical size={18} />
                              </button>
                              {openUserMenuId === user.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                                  <button onClick={() => { setOpenUserMenuId(null); handleToggleUserActive(user); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    {user.isActive === false ? <CheckCircle2 size={14} className="text-green-600" /> : <Ban size={14} className="text-gray-500" />}
                                    {user.isActive === false ? t('settings.enableUser') : t('settings.disableUser')}
                                  </button>
                                  <button onClick={() => { setOpenUserMenuId(null); handleEditUser(user); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                                    <Edit2 size={14} className="text-blue-600" /> Edit
                                  </button>
                                  <button onClick={() => { setOpenUserMenuId(null); handleDeleteUser(user.id); }} className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
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
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">{t('settings.tab.developer')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Managed by the platform administrator.
              </p>
              <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-700">
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
