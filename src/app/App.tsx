import { useState, useEffect, useRef } from 'react';
import { MoreVertical, LogOut } from 'lucide-react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { ChandaCollection } from './components/ChandaCollection';
import { DonationAdsCollection } from './components/DonationAdsCollection';
import { Expenses } from './components/Expenses';
import { Vendors } from './components/Vendors';
import { Loans } from './components/Loans';
import { Treasury } from './components/Treasury';
import { Settings } from './components/Settings';
import { ActivityLog } from './components/ActivityLog';
import { Tasks } from './components/Tasks';
import { GlobalSearch } from './components/GlobalSearch';
import { useLanguage } from './i18n/LanguageContext';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  fetchAllData,
  syncMembers,
  syncChanda,
  syncDonationAds,
  syncExpenses,
  syncLoans,
  syncTasks,
  updateCommitteeInfo,
  updateDeveloperInfo,
  loginRequest,
  createUserRequest,
  updateUserRequest,
  deleteUserRequest,
  setUserActiveRequest,
  changeOwnPasswordRequest,
  logActivity,
  DeveloperInfo,
  ActivityModule,
  ActivityAction,
} from './lib/db';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string; // never populated from the database; kept only for local UI state shape
  isAdmin: boolean;
  canEdit: boolean; // false = view-only: can see pages their permissions allow, but no Add/Edit/Import
  canDelete: boolean; // false = can add/edit but not delete records
  canBulkImport: boolean; // false = hides the CSV Import button everywhere
  isActive: boolean; // false = login disabled
  permissions: {
    members: boolean;
    chanda: boolean;
    donationAds: boolean;
    expenses: boolean;
    treasury: boolean;
    settings: boolean;
    loans: boolean;
    vendors: boolean;
    tasks: boolean;
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

export type PaymentStatus = 'paid' | 'pending' | 'partial' | 'rejected';

export type PaidMethod = 'notSelected' | 'cash' | 'qrScan' | 'onlineBanking' | 'check';

export interface Member {
  id: string;
  name: string;
  phone: string;
  address: string;
  role: string;
  joinDate: string;
  // Optional membership payment — a member's own donation/contribution to
  // the committee, recorded via the collapsible "Membership Payment"
  // section on the Add/Edit Member form. Same shape as Chanda so it can
  // reuse the same paid-method/status vocabulary and credit logic.
  membershipAmount?: number;
  membershipPaidMethod?: PaidMethod;
  membershipPaymentStatus?: PaymentStatus;
  membershipPartialAmount?: number; // Only meaningful when membershipPaymentStatus === 'partial'
  membershipDate?: string;
  membershipBillNumber?: string;
  membershipRemarks?: string;
}

// The amount actually credited toward total collection from a member's own
// membership payment, based on its payment status: paid -> full amount,
// partial -> the partial amount entered, pending/rejected/unset -> 0.
export function getMemberCreditAmount(member: Member): number {
  if (!member.membershipAmount) return 0;
  switch (member.membershipPaymentStatus) {
    case 'paid':
      return member.membershipAmount;
    case 'partial':
      return member.membershipPartialAmount || 0;
    case 'pending':
    case 'rejected':
    default:
      return 0;
  }
}

export interface Chanda {
  id: string;
  donorName: string;
  amount: number; // Amount mentioned/committed
  amount1?: number; // Optional split of `amount` — when either amount1/amount2 is set, amount = amount1 + amount2
  amount2?: number;
  paidMethod: PaidMethod;
  paymentStatus: PaymentStatus;
  partialAmount?: number; // Only meaningful when paymentStatus === 'partial'
  date: string;
  billNumber?: string;
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
  voucherNumber?: string; // Donation entries only
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
  voucherNumber?: string;
  vendorName?: string;
  vendorContact?: string;
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

export interface Loan {
  id: string;
  donorName: string;
  amountReceived: number; // received from the lender — credited to the committee's balance
  amountPaid: number; // repaid back to the lender so far — deducted from that credit
  phone: string;
  paymentMethod: PaidMethod;
  paymentStatus: 'paid'; // loans are always recorded as paid out
  date: string;
  returnDate?: string;
  remarks: string;
}

// Net contribution of a loan to the committee's balance: what's still held
// from the lender. Received adds credit, repaying it deducts from that same
// credit — fully repaid nets to zero.
export function getLoanNetAmount(loan: Loan): number {
  return loan.amountReceived - (loan.amountPaid || 0);
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'note' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  createdAt: string; // set once on creation — the "auto date and time" the task was added
  expiryDate: string; // defaults to 15 days after createdAt, adjustable
  assignedMemberIds: string[]; // one or more Member.id — shown on each assigned member's page
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
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'members' | 'chanda' | 'donationAds' | 'expenses' | 'vendors' | 'loans' | 'treasury' | 'settings' | 'activityLog' | 'tasks'>('dashboard');

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [committeeInfo, setCommitteeInfoState] = useState<CommitteeInfo>(EMPTY_COMMITTEE_INFO);
  const [members, setMembersState] = useState<Member[]>([]);
  const [chandaList, setChandaListState] = useState<Chanda[]>([]);
  const [donationAdsList, setDonationAdsListState] = useState<DonationAd[]>([]);
  const [expenses, setExpensesState] = useState<Expense[]>([]);
  const [loansList, setLoansListState] = useState<Loan[]>([]);
  const [tasksList, setTasksListState] = useState<Task[]>([]);
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
        setLoansListState(data.loansList);
        setTasksListState(data.tasksList);
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

  const setLoansList = async (newList: Loan[]) => {
    const previous = loansList;
    setLoansListState(newList);
    try {
      await syncLoans(previous, newList);
    } catch (err) {
      console.error('Failed to save loan changes', err);
      alert(t('common.saveError'));
      setLoansListState(previous);
    }
  };

  const setTasksList = async (newList: Task[]) => {
    const previous = tasksList;
    setTasksListState(newList);
    try {
      await syncTasks(previous, newList);
    } catch (err) {
      console.error('Failed to save task changes', err);
      alert(t('common.saveError'));
      setTasksListState(previous);
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
    permissions: User['permissions'],
    canEdit: boolean,
    canDelete: boolean,
    canBulkImport: boolean
  ) => {
    const newUser = await createUserRequest(name, username, password, permissions, canEdit, canDelete, canBulkImport);
    setUsers(prev => [...prev, newUser]);
    handleLog('create', 'users', `${name} (${username})`);
    return newUser;
  };

  const handleUpdateUser = async (
    userId: string,
    name: string,
    permissions: User['permissions'],
    canEdit: boolean,
    canDelete: boolean,
    canBulkImport: boolean,
    newPassword?: string
  ) => {
    const updated = await updateUserRequest(userId, name, permissions, canEdit, canDelete, canBulkImport, newPassword);
    setUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
    handleLog('update', 'users', `${name} (${updated.username})`);
    return updated;
  };

  const handleDeleteUser = async (userId: string) => {
    const target = users.find(u => u.id === userId);
    const ok = await deleteUserRequest(userId);
    if (ok) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (target) handleLog('delete', 'users', `${target.name} (${target.username})`);
    }
    return ok;
  };

  const handleSetUserActive = async (userId: string, isActive: boolean) => {
    const updated = await setUserActiveRequest(userId, isActive);
    setUsers(prev => prev.map(u => (u.id === userId ? updated : u)));
    handleLog('update', 'users', `${updated.name} (${updated.username}) — ${isActive ? 'enabled' : 'disabled'}`);
    return updated;
  };

  // --- Activity log: every page's create/update/delete/bulk_import calls this ---
  const handleLog = (action: ActivityAction, module: ActivityModule, summary: string, count = 1) => {
    if (!currentUser) return;
    logActivity({
      userId: currentUser.id,
      username: currentUser.username,
      userName: currentUser.name,
      action,
      module,
      summary,
      count,
    }).catch(err => console.error('Failed to write activity log', err));
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
      {/* Header + User Info Bar (combined, compact) */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-md">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-white/20 p-2 rounded-lg overflow-hidden shrink-0">
                {committeeInfo.logo && (committeeInfo.logo.startsWith('data:') || committeeInfo.logo.startsWith('http')) ? (
                  <img
                    src={committeeInfo.logo}
                    alt="Logo"
                    className="w-9 h-9 object-cover rounded"
                  />
                ) : (
                  <span className="text-xl">{committeeInfo.logo || '🕉️'}</span>
                )}
              </div>
              <div className="text-white min-w-0">
                <p className="font-bold text-sm sm:text-base truncate">
                  {committeeInfo.association || 'বেনজীন সর্বজনীন দুর্গোৎসব কমিটি'}
                </p>
                <p className="text-[10px] sm:text-xs opacity-90 leading-snug">
                  {t('header.regd')}—{committeeInfo.established} · {t('header.regdNo')}:—{committeeInfo.regNumber} · {t('header.post')}:—{committeeInfo.post} · {t('header.pin')}:—{committeeInfo.pinCode} · {t('header.mobNo')}:—{committeeInfo.mobile1}{committeeInfo.mobile2 && ` / ${committeeInfo.mobile2}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-white text-right hidden md:block">
                <p className="font-bold text-sm leading-tight">{currentUser?.name}</p>
                <p className="text-xs opacity-90 leading-tight">{currentUser?.isAdmin ? t('header.admin') : t('header.user')} ({t('header.active')})</p>
              </div>
            </div>
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
            </div>
            <div className="flex items-center gap-8 shrink-0">
              <GlobalSearch
                members={members}
                chandaList={chandaList}
                donationAdsList={donationAdsList}
                expenses={expenses}
                currentUser={currentUser}
                onNavigate={setCurrentPage}
              />
              <MoreMenu
                showVendors={!!currentUser?.permissions.vendors}
                showLoans={!!currentUser?.permissions.loans}
                showTasks={!!currentUser?.permissions.tasks}
                showSettings={!!currentUser?.permissions.settings}
                showActivityLog={!!currentUser?.permissions.settings}
                active={currentPage === 'vendors' || currentPage === 'loans' || currentPage === 'tasks' || currentPage === 'settings' || currentPage === 'activityLog'}
                onSelect={setCurrentPage}
                onLogout={handleLogout}
              />
            </div>
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
            loansList={loansList}
          />
        )}
        {currentPage === 'members' && (
          <Members
            members={members}
            setMembers={setMembers}
            tasksList={tasksList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            onLog={handleLog}
          />
        )}
        {currentPage === 'chanda' && (
          <ChandaCollection
            chandaList={chandaList}
            setChandaList={setChandaList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
          />
        )}
        {currentPage === 'donationAds' && (
          <DonationAdsCollection
            donationAdsList={donationAdsList}
            setDonationAdsList={setDonationAdsList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
          />
        )}
        {currentPage === 'expenses' && (
          <Expenses
            expenses={expenses}
            setExpenses={setExpenses}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
          />
        )}
        {currentPage === 'vendors' && (
          <Vendors expenses={expenses} />
        )}
        {currentPage === 'loans' && (
          <Loans
            loansList={loansList}
            setLoansList={setLoansList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
          />
        )}
        {currentPage === 'treasury' && (
          <Treasury chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} />
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
            onSetUserActive={handleSetUserActive}
            onChangeOwnPassword={handleChangeOwnPassword}
          />
        )}
        {currentPage === 'activityLog' && (
          <ActivityLog />
        )}
        {currentPage === 'tasks' && (
          <Tasks
            tasksList={tasksList}
            setTasksList={setTasksList}
            members={members}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            onLog={handleLog}
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

function MoreMenu({
  showVendors,
  showLoans,
  showTasks,
  showSettings,
  showActivityLog,
  active,
  onSelect,
  onLogout,
}: {
  showVendors: boolean;
  showLoans: boolean;
  showTasks: boolean;
  showSettings: boolean;
  showActivityLog: boolean;
  active: boolean;
  onSelect: (page: 'vendors' | 'loans' | 'tasks' | 'settings' | 'activityLog') => void;
  onLogout: () => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className={`px-3 py-3 font-bold transition-colors border-b-4 whitespace-nowrap ${
          active || open
            ? 'border-orange-600 text-orange-600 bg-orange-50'
            : 'border-transparent text-gray-600 hover:text-orange-600 hover:bg-orange-50'
        }`}
        aria-label={t('nav.more')}
      >
        <MoreVertical size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
          {showVendors && (
            <button
              onClick={() => { onSelect('vendors'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              {t('nav.vendors')}
            </button>
          )}
          {showLoans && (
            <button
              onClick={() => { onSelect('loans'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              {t('nav.loans')}
            </button>
          )}
          {showTasks && (
            <button
              onClick={() => { onSelect('tasks'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              {t('nav.tasks')}
            </button>
          )}
          {showSettings && (
            <button
              onClick={() => { onSelect('settings'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              {t('nav.settings')}
            </button>
          )}
          {showActivityLog && (
            <button
              onClick={() => { onSelect('activityLog'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
            >
              {t('nav.activityLog')}
            </button>
          )}
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <LogOut size={16} />
            {t('header.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
