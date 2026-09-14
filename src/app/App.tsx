import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { ChandaCollection } from './components/ChandaCollection';
import { DonationAdsCollection } from './components/DonationAdsCollection';
import { Expenses } from './components/Expenses';
import { Treasury } from './components/Treasury';
import { Settings } from './components/Settings';
import { GlobalSearch } from './components/GlobalSearch';
import { useLanguage } from './i18n/LanguageContext';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  fetchAllData,
  syncMembers,
  syncChanda,
  syncDonationAds,
  syncExpenses,
  updateCommitteeInfo,
  updateDeveloperInfo,
  loginRequest,
  createUserRequest,
  updateUserRequest,
  deleteUserRequest,
  changeOwnPasswordRequest,
  DeveloperInfo,
} from './lib/db';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string; // never populated from the database; kept only for local UI state shape
  isAdmin: boolean;
  permissions: {
    members: boolean;
    chanda: boolean;
    donationAds: boolean;
    expenses: boolean;
    treasury: boolean;
    settings: boolean;
  };
}

export interface CommitteeInfo {
  name: string;
  logo: string; // Base64 image data, an http(s) URL (e.g. Supabase Storage), or an emoji
  established: string; // Year of establishment
  regNumber: string; // Registration number
  association: string; // Association/Committee name
  post: string; // Post office
  districtPS: string; // District and Police Station
  pinCode: string; // Pin code
  mobile1: string; // Primary mobile number
  mobile2?: string; // Secondary mobile number (optional)
  address: string; // Full address (kept for backward compatibility)
  phone: string; // Phone (kept for backward compatibility)
  year: string; // Year (kept for backward compatibility)
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  joinDate: string;
}

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'rejected';

export type PaidMethod = 'notSelected' | 'cash' | 'qrScan' | 'onlineBanking' | 'check';

export interface Chanda {
  id: string;
  donorName: string;
  amount: number; // Amount mentioned/committed
  paidMethod: PaidMethod;
  paymentStatus: PaymentStatus;
  partialAmount?: number; // Only meaningful when paymentStatus === 'partial'
  date: string;
  phone: string; // Phone Number 1
  phone2?: string; // Phone Number 2 (optional)
  remarks: string;
}

// The amount actually credited toward total collection, based on payment status:
// paid -> full amount, partial -> the partial amount entered, pending/rejected -> 0.
export function getChandaCreditAmount(chanda: Chanda): number {
  switch (chanda.paymentStatus) {
    case 'paid':
      return chanda.amount;
    case 'partial':
      return chanda.partialAmount || 0;
    case 'pending':
    case 'rejected':
      return 0;
    default:
      // Backward compatibility: records saved before this feature had no status.
      return chanda.amount;
  }
}

export type DonationAdCategory = 'donation' | 'ads';

export interface DonationAd {
  id: string;
  category: DonationAdCategory;
  donorName: string;
  companyName?: string; // Ads only
  amount: number;
  paidMethod: PaidMethod;
  inKind: string; // Donation/Ads in kinds (free text)
  date: string;
  phone: string; // Phone Number 1
  phone2?: string; // Phone Number 2 (optional)
  remarks: string;
}

export type ExpensePaymentStatus = 'paid' | 'partial' | 'cancelled';
export type PaidThrough = 'notSelected' | 'cash' | 'check';

export interface Expense {
  id: string;
  title: string;
  amount: number; // Amount billed/agreed
  paymentStatus: ExpensePaymentStatus;
  // Up to 5 partial payment installments; only meaningful when paymentStatus === 'partial'.
  // The first entry is required when partial, the rest are optional.
  partialAmounts?: (number | undefined)[];
  paidThrough: PaidThrough;
  date: string;
  category: string;
  remarks: string;
}

// The amount actually counted toward total expense, based on payment status:
// paid -> full amount, partial -> sum of entered partial installments, cancelled -> 0.
export function getExpenseCreditAmount(expense: Expense): number {
  switch (expense.paymentStatus) {
    case 'paid':
      return expense.amount;
    case 'partial':
      return (expense.partialAmounts || []).reduce((sum, v) => sum + (v || 0), 0);
    case 'cancelled':
      return 0;
    default:
      // Backward compatibility: records saved before this feature had no status.
      return expense.amount;
  }
}

const EMPTY_COMMITTEE_INFO: CommitteeInfo = {
  name: '',
  logo: '🕉️',
  established: '',
  regNumber: '',
  association: '',
  post: '',
  districtPS: '',
  pinCode: '',
  mobile1: '',
  mobile2: '',
  address: '',
  phone: '',
  year: '',
};

const EMPTY_DEVELOPER_INFO: DeveloperInfo = {
  name: '',
  email: '',
  phone: '',
  version: '',
};

const SESSION_STORAGE_KEY = 'puja-session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

interface StoredSession {
  user: User;
  expiresAt: number;
}

function loadStoredSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (!session.expiresAt || Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session.user;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveSession(user: User) {
  const session: StoredSession = { user, expiresAt: Date.now() + SESSION_DURATION_MS };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export default function App() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(() => loadStoredSession());
  const [isLoggedIn, setIsLoggedIn] = useState(() => loadStoredSession() !== null);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'members' | 'chanda' | 'donationAds' | 'expenses' | 'treasury' | 'settings'>('dashboard');

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [committeeInfo, setCommitteeInfoState] = useState<CommitteeInfo>(EMPTY_COMMITTEE_INFO);
  const [members, setMembersState] = useState<Member[]>([]);
  const [chandaList, setChandaListState] = useState<Chanda[]>([]);
  const [donationAdsList, setDonationAdsListState] = useState<DonationAd[]>([]);
  const [expenses, setExpensesState] = useState<Expense[]>([]);
  const [developerInfo, setDeveloperInfoState] = useState<DeveloperInfo>(EMPTY_DEVELOPER_INFO);

  // Load everything from Supabase on mount.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDataLoading(false);
      setLoadError('not-configured');
      return;
    }
    (async () => {
      try {
        const data = await fetchAllData();
        setMembersState(data.members);
        setChandaListState(data.chandaList);
        setDonationAdsListState(data.donationAdsList);
        setExpensesState(data.expenses);
        setCommitteeInfoState(data.committeeInfo);
        setDeveloperInfoState(data.developerInfo);
        setUsers(data.users);
      } catch (err: any) {
        console.error('Failed to load data from Supabase', err);
        setLoadError(err?.message || 'unknown-error');
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  // --- List setters: keep the exact `setX(wholeNewArray)` signature every
  // page already uses, but sync the diff to Supabase behind the scenes. ---

  const setMembers = async (newList: Member[]) => {
    const previous = members;
    setMembersState(newList);
    try {
      await syncMembers(previous, newList);
    } catch (err) {
      console.error('Failed to save member changes', err);
      alert(t('common.saveError'));
      setMembersState(previous);
    }
  };

  const setChandaList = async (newList: Chanda[]) => {
    const previous = chandaList;
    setChandaListState(newList);
    try {
      await syncChanda(previous, newList);
    } catch (err) {
      console.error('Failed to save chanda changes', err);
      alert(t('common.saveError'));
      setChandaListState(previous);
    }
  };

  const setDonationAdsList = async (newList: DonationAd[]) => {
    const previous = donationAdsList;
    setDonationAdsListState(newList);
    try {
      await syncDonationAds(previous, newList);
    } catch (err) {
      console.error('Failed to save donation/ads changes', err);
      alert(t('common.saveError'));
      setDonationAdsListState(previous);
    }
  };

  const setExpenses = async (newList: Expense[]) => {
    const previous = expenses;
    setExpensesState(newList);
    try {
      await syncExpenses(previous, newList);
    } catch (err) {
      console.error('Failed to save expense changes', err);
      alert(t('common.saveError'));
      setExpensesState(previous);
    }
  };

  const setCommitteeInfo = async (info: CommitteeInfo) => {
    const previous = committeeInfo;
    setCommitteeInfoState(info);
    try {
      await updateCommitteeInfo(info);
    } catch (err) {
      console.error('Failed to save committee info', err);
      alert(t('common.saveError'));
      setCommitteeInfoState(previous);
    }
  };

  const setDeveloperInfo = async (info: DeveloperInfo) => {
    const previous = developerInfo;
    setDeveloperInfoState(info);
    try {
      await updateDeveloperInfo(info);
    } catch (err) {
      console.error('Failed to save developer info', err);
      alert(t('common.saveError'));
      setDeveloperInfoState(previous);
    }
  };

  // --- User management: goes through RPC functions, not direct table writes ---

  const handleCreateUser = async (
    name: string,
    username: string,
    password: string,
    permissions: User['permissions']
  ) => {
    const newUser = await createUserRequest(name, username, password, permissions);
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const handleUpdateUser = async (
    userId: string,
    name: string,
    permissions: User['permissions'],
    newPassword?: string
  ) => {
    const updated = await updateUserRequest(userId, name, permissions, newPassword);
    setUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
    return updated;
  };

  const handleDeleteUser = async (userId: string) => {
    const ok = await deleteUserRequest(userId);
    if (ok) setUsers(prev => prev.filter(u => u.id !== userId));
    return ok;
  };

  const handleChangeOwnPassword = async (userId: string, currentPassword: string, newPassword: string) =>
    changeOwnPasswordRequest(userId, currentPassword, newPassword);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const user = await loginRequest(username, password);
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        saveSession(user);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login failed', err);
      return false;
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
    clearStoredSession();
  };

  if (loadError === 'not-configured') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white rounded-xl shadow-md p-8 border border-red-200">
          <h1 className="text-xl font-bold text-red-700 mb-3">Supabase is not configured</h1>
          <p className="text-gray-700 mb-3">
            Create a <code className="bg-gray-100 px-1 rounded">.env</code> file in the project root (copy{' '}
            <code className="bg-gray-100 px-1 rounded">.env.example</code>) with your Supabase project's URL and
            anon key, then restart the dev server / rebuild the app.
          </p>
          <pre className="bg-gray-100 text-sm p-3 rounded overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white rounded-xl shadow-md p-8 border border-red-200">
          <h1 className="text-xl font-bold text-red-700 mb-3">Couldn't load data</h1>
          <p className="text-gray-700">{loadError}</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage logo={committeeInfo.logo} onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 shadow-lg border-b-4 border-orange-500">
        <div className="container mx-auto px-4 py-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-orange-800">{committeeInfo.association || 'বেনজীন সর্বজনীন দুর্গোৎসব কমিটি'}</h1>
            <div className="text-sm text-gray-700 mt-1 space-y-0.5">
              <p>{t('header.regd')}—{committeeInfo.established} | <strong>{t('header.regdNo')}:—{committeeInfo.regNumber}</strong></p>
              <p>{t('header.post')}:—{committeeInfo.post}, {t('header.ps')}:—{committeeInfo.districtPS}, <strong>{t('header.pin')}:—{committeeInfo.pinCode}</strong></p>
              <p><strong>{t('header.mobNo')}:—{committeeInfo.mobile1}</strong>{committeeInfo.mobile2 && ` | ${committeeInfo.mobile2}`}</p>
            </div>
          </div>
        </div>
      </header>

      {/* User Info Bar */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg overflow-hidden">
                {committeeInfo.logo && (committeeInfo.logo.startsWith('data:') || committeeInfo.logo.startsWith('http')) ? (
                  <img
                    src={committeeInfo.logo}
                    alt="Logo"
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <span className="text-2xl">{committeeInfo.logo || '🕉️'}</span>
                )}
              </div>
              <div className="text-white">
                <p className="font-bold">{t('header.you')}, {currentUser?.name}</p>
                <p className="text-sm opacity-90">{currentUser?.isAdmin ? t('header.admin') : t('header.user')} ({t('header.active')})</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-6 py-2 bg-white text-orange-600 rounded-lg hover:bg-orange-50 transition-colors font-bold shadow-lg"
            >
              {t('header.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 relative">
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 overflow-x-auto">
              <NavButton
                active={currentPage === 'dashboard'}
                onClick={() => setCurrentPage('dashboard')}
              >
                {t('nav.dashboard')}
              </NavButton>
              {currentUser?.permissions.members && (
                <NavButton
                  active={currentPage === 'members'}
                  onClick={() => setCurrentPage('members')}
                >
                  {t('nav.members')}
                </NavButton>
              )}
              {currentUser?.permissions.chanda && (
                <NavButton
                  active={currentPage === 'chanda'}
                  onClick={() => setCurrentPage('chanda')}
                >
                  {t('nav.chanda')}
                </NavButton>
              )}
              {currentUser?.permissions.donationAds && (
                <NavButton
                  active={currentPage === 'donationAds'}
                  onClick={() => setCurrentPage('donationAds')}
                >
                  {t('nav.donationAds')}
                </NavButton>
              )}
              {currentUser?.permissions.expenses && (
                <NavButton
                  active={currentPage === 'expenses'}
                  onClick={() => setCurrentPage('expenses')}
                >
                  {t('nav.expenses')}
                </NavButton>
              )}
              {currentUser?.permissions.treasury && (
                <NavButton
                  active={currentPage === 'treasury'}
                  onClick={() => setCurrentPage('treasury')}
                >
                  {t('nav.treasury')}
                </NavButton>
              )}
              {currentUser?.permissions.settings && (
                <NavButton
                  active={currentPage === 'settings'}
                  onClick={() => setCurrentPage('settings')}
                >
                  {t('nav.settings')}
                </NavButton>
              )}
            </div>
            <GlobalSearch
              members={members}
              chandaList={chandaList}
              donationAdsList={donationAdsList}
              expenses={expenses}
              currentUser={currentUser}
              onNavigate={setCurrentPage}
            />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {currentPage === 'dashboard' && (
          <Dashboard
            members={members}
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
          />
        )}
        {currentPage === 'members' && (
          <Members members={members} setMembers={setMembers} />
        )}
        {currentPage === 'chanda' && (
          <ChandaCollection chandaList={chandaList} setChandaList={setChandaList} />
        )}
        {currentPage === 'donationAds' && (
          <DonationAdsCollection donationAdsList={donationAdsList} setDonationAdsList={setDonationAdsList} />
        )}
        {currentPage === 'expenses' && (
          <Expenses expenses={expenses} setExpenses={setExpenses} />
        )}
        {currentPage === 'treasury' && (
          <Treasury chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} />
        )}
        {currentPage === 'settings' && (
          <Settings
            committeeInfo={committeeInfo}
            setCommitteeInfo={setCommitteeInfo}
            users={users}
            currentUser={currentUser}
            developerInfo={developerInfo}
            setDeveloperInfo={setDeveloperInfo}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser}
            onChangeOwnPassword={handleChangeOwnPassword}
          />
        )}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-bold transition-colors border-b-4 whitespace-nowrap ${
        active
          ? 'border-orange-600 text-orange-600 bg-orange-50'
          : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-orange-50'
      }`}
    >
      {children}
    </button>
  );
}
