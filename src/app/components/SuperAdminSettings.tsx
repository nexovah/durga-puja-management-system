import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Building2, Lock, Code, Save } from 'lucide-react';
import {
  superAdminChangePasswordRequest,
  getDeveloperInfoRequest,
  updateDeveloperInfoRequest,
  getSelfProfileRequest,
  updateSelfProfileRequest,
  getPlatformSettingsRequest,
  updatePlatformSettingsRequest,
  isPasswordStrong,
  DeveloperInfo,
  SuperAdminProfile,
  PlatformSettings,
} from '../lib/superAdminDb';
import { uploadLogo } from '../lib/db';

type Tab = 'general' | 'profile' | 'password' | 'developer';

const EMPTY_DEV_INFO: DeveloperInfo = { name: '', email: '', phone: '', version: '', changelog: '' };
const EMPTY_PROFILE: SuperAdminProfile = { id: '', name: '', username: '', email: '', phone: '', phone2: '', address: '', logoUrl: '' };
const EMPTY_PLATFORM: PlatformSettings = {
  logoUrl: '', faviconUrl: '', appTitle: 'Durga CRM',
  showLogoOnSignin: true, showSigninBackground: false, signinBackgroundUrl: '',
};

const NAV_ITEMS: { key: Tab; label: string; icon: typeof SettingsIcon }[] = [
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'profile', label: 'Profile', icon: Building2 },
  { key: 'password', label: 'Change Password', icon: Lock },
  { key: 'developer', label: 'Developer Info', icon: Code },
];

const VALID_TABS: Tab[] = ['general', 'profile', 'password', 'developer'];

// /super-admin/settings/<tab> — see docs/URL_STATE_CONVENTION.md: every
// list/detail/tab view in this app carries its state in the URL so a
// refresh or shared link lands back in the same place.
function getTabFromPath(): Tab {
  const parts = window.location.pathname.replace(/^\/super-admin\/?/, '').split('/');
  const tab = parts[1];
  return (VALID_TABS as string[]).includes(tab) ? (tab as Tab) : 'general';
}

interface SuperAdminSettingsProps {
  onNameChanged?: (name: string) => void;
}

export function SuperAdminSettings({ onNameChanged }: SuperAdminSettingsProps) {
  const [activeTab, setActiveTabState] = useState<Tab>(() => getTabFromPath());

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab);
    window.history.pushState(null, '', `/super-admin/settings/${tab}`);
  };

  useEffect(() => {
    const onPopState = () => setActiveTabState(getTabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const path = `/super-admin/settings/${activeTab}`;
    if (window.location.pathname !== path) window.history.replaceState(null, '', path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [platform, setPlatform] = useState<PlatformSettings>(EMPTY_PLATFORM);
  const [platformForm, setPlatformForm] = useState<PlatformSettings>(EMPTY_PLATFORM);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [platformMessage, setPlatformMessage] = useState('');
  const [platformError, setPlatformError] = useState('');
  const [logoFileUploading, setLogoFileUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);

  const [profile, setProfile] = useState<SuperAdminProfile>(EMPTY_PROFILE);
  const [profileForm, setProfileForm] = useState<SuperAdminProfile>(EMPTY_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [devInfo, setDevInfo] = useState<DeveloperInfo>(EMPTY_DEV_INFO);
  const [devForm, setDevForm] = useState<DeveloperInfo>(EMPTY_DEV_INFO);
  const [devLoading, setDevLoading] = useState(true);
  const [savingDev, setSavingDev] = useState(false);
  const [devMessage, setDevMessage] = useState('');
  const [devError, setDevError] = useState('');

  useEffect(() => {
    getPlatformSettingsRequest()
      .then(p => { setPlatform(p); setPlatformForm(p); })
      .catch(() => {})
      .finally(() => setPlatformLoading(false));
    getDeveloperInfoRequest()
      .then(info => { setDevInfo(info); setDevForm(info); })
      .catch(() => {})
      .finally(() => setDevLoading(false));
    getSelfProfileRequest()
      .then(p => { setProfile(p); setProfileForm(p); })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const handlePlatformSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlatformError('');
    setPlatformMessage('');
    setSavingPlatform(true);
    try {
      const updated = await updatePlatformSettingsRequest(platformForm);
      setPlatform(updated);
      setPlatformForm(updated);
      setPlatformMessage('Saved — live on the landing page and Super Admin login now.');
    } catch (err: any) {
      setPlatformError(err?.message || 'Failed to save');
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);
    try {
      const updated = await updateSelfProfileRequest(profileForm);
      setProfile(updated);
      setProfileForm(updated);
      setProfileMessage('Profile updated.');
      onNameChanged?.(updated.name);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to save');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    if (!isPasswordStrong(newPassword)) {
      setPasswordError('New password must be at least 8 characters and include a letter and a digit.');
      return;
    }
    setSavingPassword(true);
    try {
      const ok = await superAdminChangePasswordRequest(currentPassword, newPassword);
      if (ok) {
        setPasswordMessage('Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError('Current password is incorrect.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDevSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevError('');
    setDevMessage('');
    setSavingDev(true);
    try {
      const updated = await updateDeveloperInfoRequest(devForm);
      setDevInfo(updated);
      setDevForm(updated);
      setDevMessage('Developer info updated — visible to every tenant now.');
    } catch (err: any) {
      setDevError(err?.message || 'Failed to save');
    } finally {
      setSavingDev(false);
    }
  };

  const inputClass = "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";

  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">Settings</h1>

      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-56 shrink-0">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-2 flex sm:flex-col gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === key
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 min-w-0 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          {activeTab === 'general' && (
            platformLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : (
              <form onSubmit={handlePlatformSubmit} className="space-y-5 max-w-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Shown on the public marketing landing page and the Super Admin login screen.
                  Title and favicon apply site-wide, including every tenant's dashboard.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Logo</label>
                  <div className="flex items-center gap-3">
                    {platformForm.logoUrl && (
                      <img src={platformForm.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLogoFileUploading(true);
                        try {
                          const url = await uploadLogo(file, platformForm.logoUrl);
                          setPlatformForm(f => ({ ...f, logoUrl: url }));
                        } catch (err: any) {
                          setPlatformError(err?.message || 'Failed to upload logo');
                        } finally {
                          setLogoFileUploading(false);
                        }
                      }}
                      className={inputClass}
                    />
                  </div>
                  {logoFileUploading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading…</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Favicon</label>
                  <div className="flex items-center gap-3">
                    {platformForm.faviconUrl && (
                      <img src={platformForm.faviconUrl} alt="Favicon" className="w-8 h-8 rounded object-cover border border-gray-200 dark:border-gray-700" />
                    )}
                    <input
                      type="file"
                      accept="image/x-icon,image/png"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFaviconUploading(true);
                        try {
                          const url = await uploadLogo(file, platformForm.faviconUrl);
                          setPlatformForm(f => ({ ...f, faviconUrl: url }));
                        } catch (err: any) {
                          setPlatformError(err?.message || 'Failed to upload favicon');
                        } finally {
                          setFaviconUploading(false);
                        }
                      }}
                      className={inputClass}
                    />
                  </div>
                  {faviconUploading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading…</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App Title</label>
                  <input
                    type="text"
                    value={platformForm.appTitle}
                    onChange={e => setPlatformForm({ ...platformForm, appTitle: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show logo on sign-in page</label>
                  <select
                    value={platformForm.showLogoOnSignin ? 'yes' : 'no'}
                    onChange={e => setPlatformForm({ ...platformForm, showLogoOnSignin: e.target.value === 'yes' })}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show background image on sign-in page</label>
                  <select
                    value={platformForm.showSigninBackground ? 'yes' : 'no'}
                    onChange={e => setPlatformForm({ ...platformForm, showSigninBackground: e.target.value === 'yes' })}
                    className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                {platformForm.showSigninBackground && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sign-in page background</label>
                    <div className="flex items-center gap-3">
                      {platformForm.signinBackgroundUrl && (
                        <img src={platformForm.signinBackgroundUrl} alt="Background" className="w-16 h-10 rounded object-cover border border-gray-200 dark:border-gray-700" />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setBgUploading(true);
                          try {
                            const url = await uploadLogo(file, platformForm.signinBackgroundUrl);
                            setPlatformForm(f => ({ ...f, signinBackgroundUrl: url }));
                          } catch (err: any) {
                            setPlatformError(err?.message || 'Failed to upload background');
                          } finally {
                            setBgUploading(false);
                          }
                        }}
                        className={inputClass}
                      />
                    </div>
                    {bgUploading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading…</p>}
                  </div>
                )}

                {platformError && <p className="text-sm text-red-600 dark:text-red-400">{platformError}</p>}
                {platformMessage && <p className="text-sm text-green-600 dark:text-green-400">{platformMessage}</p>}
                <button
                  type="submit"
                  disabled={savingPlatform}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
                >
                  <Save size={20} />
                  {savingPlatform ? 'Saving…' : 'Save'}
                </button>
              </form>
            )
          )}

          {activeTab === 'profile' && (
            profileLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : (
              <form onSubmit={handleProfileSubmit} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Logo (JPG/PNG)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoUploading(true);
                      try {
                        const url = await uploadLogo(file, profileForm.logoUrl);
                        setProfileForm(f => ({ ...f, logoUrl: url }));
                      } catch (err: any) {
                        setProfileError(err?.message || 'Failed to upload logo');
                      } finally {
                        setLogoUploading(false);
                      }
                    }}
                    className={inputClass}
                  />
                  {logoUploading && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Uploading…</p>}
                  {profileForm.logoUrl && (
                    <div className="flex items-center gap-3 mt-3">
                      <img src={profileForm.logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                      <button
                        type="button"
                        onClick={() => setProfileForm(f => ({ ...f, logoUrl: '' }))}
                        className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      >
                        Remove Logo
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number 1</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number 2 (optional)</label>
                    <input
                      type="tel"
                      value={profileForm.phone2}
                      onChange={e => setProfileForm({ ...profileForm, phone2: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
                {profileError && <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>}
                {profileMessage && <p className="text-sm text-green-600 dark:text-green-400">{profileMessage}</p>}
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
                >
                  <Save size={20} />
                  {savingProfile ? 'Saving…' : 'Save'}
                </button>
              </form>
            )
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              {passwordError && <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>}
              {passwordMessage && <p className="text-sm text-green-600 dark:text-green-400">{passwordMessage}</p>}
              <button
                type="submit"
                disabled={savingPassword}
                className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
              >
                <Save size={20} />
                {savingPassword ? 'Saving…' : 'Change password'}
              </button>
            </form>
          )}

          {activeTab === 'developer' && (
            devLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : (
              <form onSubmit={handleDevSubmit} className="space-y-4 max-w-md">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Shown read-only in every tenant's Settings → Developer Info tab.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Developer name</label>
                  <input
                    type="text"
                    required
                    value={devForm.name}
                    onChange={e => setDevForm({ ...devForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={devForm.email}
                    onChange={e => setDevForm({ ...devForm, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone number</label>
                  <input
                    type="tel"
                    required
                    value={devForm.phone}
                    onChange={e => setDevForm({ ...devForm, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App version</label>
                  <input
                    type="text"
                    required
                    value={devForm.version}
                    onChange={e => setDevForm({ ...devForm, version: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App version update details</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    One point per line — shown as a bullet list to every tenant. Kept current whenever the app version changes.
                  </p>
                  <textarea
                    rows={6}
                    value={devForm.changelog}
                    onChange={e => setDevForm({ ...devForm, changelog: e.target.value })}
                    placeholder={'Added: XYZ feature\nFixed: ABC bug\nImproved: performance on the dashboard'}
                    className={`${inputClass} font-mono text-sm`}
                  />
                </div>
                {devError && <p className="text-sm text-red-600 dark:text-red-400">{devError}</p>}
                {devMessage && <p className="text-sm text-green-600 dark:text-green-400">{devMessage}</p>}
                <button
                  type="submit"
                  disabled={savingDev}
                  className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
                >
                  <Save size={20} />
                  {savingDev ? 'Saving…' : 'Save'}
                </button>

                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">Currently live</h4>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Name:</strong> {devInfo.name}</p>
                    <p><strong>Email:</strong> {devInfo.email}</p>
                    <p><strong>Phone:</strong> {devInfo.phone}</p>
                    <p><strong>Version:</strong> {devInfo.version}</p>
                    {devInfo.changelog && (
                      <ul className="list-disc pl-5 pt-1 space-y-0.5">
                        {devInfo.changelog.split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    )}
                  </div>
                </div>
              </form>
            )
          )}
        </div>
      </div>
    </div>
  );
}
