import { useEffect, useState } from 'react';
import { Building2, Lock, Code, Save } from 'lucide-react';
import {
  superAdminChangePasswordRequest,
  getDeveloperInfoRequest,
  updateDeveloperInfoRequest,
  getSelfProfileRequest,
  updateSelfProfileRequest,
  DeveloperInfo,
  SuperAdminProfile,
} from '../lib/superAdminDb';
import { uploadLogo } from '../lib/db';

type Tab = 'profile' | 'password' | 'developer';

const EMPTY_DEV_INFO: DeveloperInfo = { name: '', email: '', phone: '', version: '', changelog: '' };
const EMPTY_PROFILE: SuperAdminProfile = { id: '', name: '', username: '', email: '', phone: '', phone2: '', address: '', logoUrl: '' };

interface SuperAdminSettingsProps {
  onNameChanged?: (name: string) => void;
}

export function SuperAdminSettings({ onNameChanged }: SuperAdminSettingsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('profile');

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
    getDeveloperInfoRequest()
      .then(info => { setDevInfo(info); setDevForm(info); })
      .catch(() => {})
      .finally(() => setDevLoading(false));
    getSelfProfileRequest()
      .then(p => { setProfile(p); setProfileForm(p); })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

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
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
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

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-orange-600 text-orange-600 bg-orange-50 dark:bg-orange-500/10'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Building2 size={20} />
            Profile
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
            Change Password
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
            Developer Info
          </button>
        </div>

        <div className="p-6">
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
                        const url = await uploadLogo(file);
                        setProfileForm(f => ({ ...f, logoUrl: url }));
                      } catch (err: any) {
                        setProfileError(err?.message || 'Failed to upload logo');
                      } finally {
                        setLogoUploading(false);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Address</label>
                  <textarea
                    rows={2}
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number 1</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number 2 (optional)</label>
                    <input
                      type="tel"
                      value={profileForm.phone2}
                      onChange={e => setProfileForm({ ...profileForm, phone2: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={devForm.email}
                    onChange={e => setDevForm({ ...devForm, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone number</label>
                  <input
                    type="tel"
                    required
                    value={devForm.phone}
                    onChange={e => setDevForm({ ...devForm, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App version</label>
                  <input
                    type="text"
                    required
                    value={devForm.version}
                    onChange={e => setDevForm({ ...devForm, version: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none font-mono text-sm"
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
