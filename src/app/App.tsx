import { useState, useEffect, useRef } from 'react';
import { Menu, LogOut, ChevronDown, Building2, Lock, Users as UsersIcon, Languages, Code, PanelLeftClose, PanelLeftOpen, Sun, Moon, CreditCard as CreditCardIcon, HelpCircle } from 'lucide-react';
import { LoginPage } from './components/LoginPage';
import { setTenantAccessToken } from './lib/supabaseClient';
import { LandingPage } from './components/LandingPage';
import { LegalPage } from './components/LegalPage';
import { SuperAdminRoot } from './components/SuperAdminRoot';
import { getPlatformSettingsRequest } from './lib/superAdminDb';
import { Billing } from './components/Billing';
import { HelpSupportModal } from './components/HelpSupportModal';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { ChandaCollection } from './components/ChandaCollection';
import { DonationAdsCollection } from './components/DonationAdsCollection';
import { Expenses } from './components/Expenses';
import { Vendors } from './components/Vendors';
import { Loans } from './components/Loans';
import { Treasury } from './components/Treasury';
import { Report } from './components/Report';
import { Settings, SettingsTab } from './components/Settings';
import { ActivityLog } from './components/ActivityLog';
import { Tasks } from './components/Tasks';
import { EstimationPage } from './components/Estimation';
import { GlobalSearch } from './components/GlobalSearch';
import { useLanguage } from './i18n/LanguageContext';
import { useTheme } from './i18n/ThemeContext';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  fetchAllData,
  syncMembers,
  syncChanda,
  syncDonationAds,
  syncExpenses,
  syncLoans,
  syncTasks,
  syncEstimations,
  updateCommitteeInfo,
  updateDeveloperInfo,
  loginRequest,
  fetchTenantSubscriptionExpiry,
  createUserRequest,
  updateUserRequest,
  deleteUserRequest,
  setUserActiveRequest,
  changeOwnPasswordRequest,
  logActivity,
  DeveloperInfo,
  ActivityModule,
  ActivityAction,
  ActivityFieldChange,
  getCmsPageRequest,
  EventInfo,
  fetchEvents,
  fetchActiveEventId,
} from './lib/db';
import { CreateFirstEventScreen } from './components/CreateFirstEventScreen';

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
    // donation/ads used to be one combined permission (donationAds) before
    // the menus were split — kept here, optional, so users saved before
    // that split still carry a value; Sidebar/GlobalSearch fall back to it
    // when donation/ads aren't set yet. New users get donation/ads directly.
    donationAds?: boolean;
    donation?: boolean;
    ads?: boolean;
    expenses: boolean;
    treasury: boolean;
    settings: boolean;
    loans: boolean;
    vendors: boolean;
    tasks: boolean;
    estimation: boolean;
  };
  tenantId?: string; // the committee this user belongs to (multi-tenant)
  accessToken?: string; // per-tenant JWT signed by login(); attached to every
                         // Supabase request after login so RLS can scope by
                         // tenant_id — see src/app/lib/supabaseClient.ts
  subscriptionExpiresAt?: string | null; // null = never granted a subscription yet
}

export interface CommitteeInfo {
  id?: string; // per-tenant row id (uuid) — absent only before first load
  name: string;
  logo: string; // Base64 image data, an http(s) URL (e.g. Supabase Storage), or an emoji
  established: string; // Year of establishment
  regNumber: string; // Registration number
  association: string; // Association/Committee name
  email: string; // Committee contact email — seeded from Super Admin's tenant creation/edit
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
export type PaidThrough = 'notSelected' | 'cash' | 'check' | 'qrPayment' | 'onlineBanking';

export interface ExpensePartialPayment {
  amount: number;
  voucherNumber?: string;
  date?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number; // Amount billed/agreed
  paymentStatus: ExpensePaymentStatus;
  // Unlimited partial payment installments; only meaningful when
  // paymentStatus === 'partial'. Each installment carries its own voucher
  // number and date — see supabase/045_expenses_partial_payments_unlimited.sql.
  partialPayments?: ExpensePartialPayment[];
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
      return (expense.partialPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
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
  createdBy: string; // app_users.id of the creator — only they (or an admin) can edit/delete
  createdByName: string; // snapshot of the creator's name, so it survives their account being deleted
}

export interface EstimationLineItem {
  id: string;
  title: string;
  customField: string; // free-text field, replacing the old fixed "date" column
  customField2: string; // second free-text field
  amount: number;
}

export interface EstimationColumnLabels {
  serialNo: string;
  title: string;
  customField: string;
  customField2: string;
  amount: string;
}

export interface Estimation {
  id: string;
  title: string;
  lineItems: EstimationLineItem[];
  columnLabels: EstimationColumnLabels; // per-estimation editable table header text
  createdAt: string;
  createdBy: string;
  createdByName: string;
}

const EMPTY_COMMITTEE_INFO: CommitteeInfo = {
  name: '',
  logo: '🕉️',
  established: '',
  regNumber: '',
  association: '',
  email: '',
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

// ---------------------------------------------------------------------------
// URL routing (path-based, via the History API — no react-router): each page
// gets a clean "/slug" URL (no "#") so refresh, back/forward, and
// bookmarking land back on the same page instead of always resetting to
// Dashboard. A hard refresh on a deep link (e.g. /chanda-collection) asks
// the server for that exact path, so the static host must fall back to
// index.html for unknown paths — see public/.htaccess (Apache/Hostinger)
// and DEPLOYMENT.md.
// ---------------------------------------------------------------------------

type PageKey = 'dashboard' | 'members' | 'chanda' | 'donation' | 'ads' | 'expenses' | 'vendors' | 'loans' | 'treasury' | 'report' | 'settings' | 'activityLog' | 'tasks' | 'estimation' | 'billing';

const PAGE_SLUGS: Record<PageKey, string> = {
  dashboard: '/dashboard',
  members: '/members',
  chanda: '/chanda-collection',
  donation: '/donation-collection',
  ads: '/ads-collection',
  expenses: '/expenses',
  vendors: '/vendors',
  loans: '/loans',
  treasury: '/treasury',
  report: '/report',
  settings: '/settings',
  activityLog: '/activity-log',
  tasks: '/tasks',
  estimation: '/estimation',
  billing: '/billing',
};

const SLUG_TO_PAGE: Record<string, PageKey> = Object.fromEntries(
  Object.entries(PAGE_SLUGS).map(([page, slug]) => [slug, page])
) as Record<string, PageKey>;

function getPageFromPath(): PageKey {
  const path = window.location.pathname;
  if (SLUG_TO_PAGE[path]) return SLUG_TO_PAGE[path];
  // Sub-routes (e.g. /report/chanda for Report's own left-nav module —
  // see Report.tsx) still belong to their parent PageKey.
  const prefixMatch = Object.entries(PAGE_SLUGS).find(([, slug]) => path.startsWith(`${slug}/`));
  return prefixMatch ? (prefixMatch[0] as PageKey) : 'dashboard';
}

export default function App() {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = loadStoredSession();
    if (stored) setTenantAccessToken(stored.accessToken || null);
    return stored;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => loadStoredSession() !== null);
  const [currentPage, setCurrentPageState] = useState<PageKey>(() => getPageFromPath());

  // App title/favicon apply site-wide (landing page, every tenant's
  // dashboard, Super Admin) — set once here regardless of which sub-app
  // below actually renders. The logo itself stays scoped to just the
  // landing page + Super Admin login (wired separately in those
  // components) — each tenant's own committee logo in the sidebar is a
  // different, existing per-tenant setting and is untouched by this.
  useEffect(() => {
    getPlatformSettingsRequest().then(settings => {
      if (settings.appTitle) document.title = settings.appTitle;
      if (settings.faviconUrl) {
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = settings.faviconUrl;
      }
    }).catch(() => {});
  }, []);
  // Tracks the raw pathname while logged out (landing vs. login), since
  // those two routes aren't part of the authed PageKey system above.
  const [loggedOutPath, setLoggedOutPath] = useState(() => window.location.pathname);

  // CMS-driven SEO metadata for the public routes (see
  // supabase/055_cms_pages.sql) — title/description/OG tags, only on
  // '/', '/terms', '/privacy', '/refund'. Re-runs on `loggedOutPath`
  // changes (not just mount) so navigating via the footer links, which
  // don't remount the app, still updates the tags. Client-side only
  // (this is a Vite SPA, no SSR), so this reliably reaches crawlers that
  // execute JS (Google) but not ones that don't (Facebook/Twitter link
  // previews) — a known, accepted limitation for now.
  useEffect(() => {
    const slug = { '/': 'home', '/terms': 'terms', '/privacy': 'privacy', '/refund': 'refund' }[loggedOutPath];
    if (!slug) return;
    getCmsPageRequest(slug).then(page => {
      if (!page) return;
      if (page.metaTitle) document.title = page.metaTitle;
      const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
        if (!content) return;
        let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute(attr, key);
          document.head.appendChild(tag);
        }
        tag.content = content;
      };
      setMeta('name', 'description', page.metaDescription);
      setMeta('property', 'og:title', page.metaTitle);
      setMeta('property', 'og:description', page.metaDescription);
      if (page.ogImageUrl) setMeta('property', 'og:image', page.ogImageUrl);
    }).catch(() => {});
  }, [loggedOutPath]);

  // Keep the URL path in sync whenever the page changes from within the app.
  // Pages with their own sub-route (Report's /report/<module>, Settings'
  // /settings/<tab>, ...) manage that deeper path themselves — this only
  // steps in when the current path isn't already inside this page at all
  // (e.g. sidebar nav from a different page), so it doesn't clobber a
  // sub-route back to the bare slug on every mount/reload.
  useEffect(() => {
    if (!isLoggedIn) return;
    const newPath = PAGE_SLUGS[currentPage];
    const pathname = window.location.pathname;
    if (pathname !== newPath && !pathname.startsWith(`${newPath}/`)) {
      window.history.pushState(null, '', newPath);
    }
  }, [currentPage, isLoggedIn]);

  // Back/forward navigation should update the app too.
  useEffect(() => {
    const onPopState = () => {
      const page = getPageFromPath();
      setCurrentPageState(prev => (prev === page ? prev : page));
      setLoggedOutPath(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setCurrentPage = (page: PageKey) => setCurrentPageState(page);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('puja-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('puja-sidebar-collapsed', next ? '1' : '0');
      } catch {
        // ignore — collapse preference is a nice-to-have, not critical
      }
      return next;
    });
  };
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [helpSupportOpen, setHelpSupportOpen] = useState(false);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [currentPage]);

  const [settingsTab, setSettingsTab] = useState<SettingsTab>('committee');
  const [settingsTabRequestId, setSettingsTabRequestId] = useState(0);
  const goToSettingsTab = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setSettingsTabRequestId(id => id + 1);
    setCurrentPage('settings');
  };

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
  const [estimationsList, setEstimationsListState] = useState<Estimation[]>([]);
  const [developerInfo, setDeveloperInfoState] = useState<DeveloperInfo>(EMPTY_DEVELOPER_INFO);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);

  // Load everything from Supabase once the user is logged in. Pre-login,
  // RLS has no tenant token to scope by (see supabase/020_multi_tenant.sql)
  // and returns nothing for every tenant-scoped table, so there's nothing
  // to fetch until then — the landing/login screens don't need this data.
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setDataLoading(false);
      setLoadError('not-configured');
      return;
    }
    if (!isLoggedIn) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    (async () => {
      try {
        const data = await fetchAllData();
        setMembersState(data.members);
        setChandaListState(data.chandaList);
        setDonationAdsListState(data.donationAdsList);
        setExpensesState(data.expenses);
        setLoansListState(data.loansList);
        setTasksListState(data.tasksList);
        setEstimationsListState(data.estimationsList);
        setCommitteeInfoState(data.committeeInfo);
        setDeveloperInfoState(data.developerInfo);
        setUsers(data.users);
      } catch (err: any) {
        console.error('Failed to load data from Supabase', err);
        setLoadError(err?.message || 'unknown-error');
        setDataLoading(false);
        return;
      }
      // Kept out of the try/catch above on purpose: a failure here (e.g. a
      // missing grant on tenants — see supabase/066_tenants_self_select.sql)
      // must not take down the entire CRM's data load. Worst case, the
      // event-switcher widget/gate is blank/stuck loading while every other
      // page still works normally.
      try {
        const [eventsList, activeId] = await Promise.all([fetchEvents(), currentUser?.tenantId ? fetchActiveEventId(currentUser.tenantId) : Promise.resolve(null)]);
        setEvents(eventsList);
        setActiveEventId(activeId);
        setEventsLoadError(null);
      } catch (err: any) {
        console.error('Failed to load events', err);
        setEventsLoadError(err?.message || 'unknown-error');
      } finally {
        setDataLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // The 7 event-scoped tables are RLS-filtered live by current_event_id() —
  // once the active event actually changes (an admin switched it, here or
  // for a teammate mid-session, picked up by the polling/route-change
  // refetch below), the in-memory lists must be reloaded so the UI reflects
  // the new event's data instead of stale rows from the old one.
  const previousActiveEventId = useRef<string | null>(null);
  useEffect(() => {
    if (!isLoggedIn || !activeEventId) return;
    if (previousActiveEventId.current === null) {
      previousActiveEventId.current = activeEventId;
      return;
    }
    if (previousActiveEventId.current === activeEventId) return;
    previousActiveEventId.current = activeEventId;
    refreshCoreData().catch(err => console.error('Failed to reload data after event switch', err));
  }, [activeEventId, isLoggedIn]);

  // Refetch the 7 event-scoped lists on demand — used by the event-switch
  // reload above, and exposed to the Report page's Balance Sheet refresh
  // button, so it always reflects the latest entry in every module without
  // requiring a full page reload.
  const refreshCoreData = async () => {
    const data = await fetchAllData();
    setMembersState(data.members);
    setChandaListState(data.chandaList);
    setDonationAdsListState(data.donationAdsList);
    setExpensesState(data.expenses);
    setLoansListState(data.loansList);
    setTasksListState(data.tasksList);
    setEstimationsListState(data.estimationsList);
  };

  // Keep the active-event display fresh: if a teammate's admin switches
  // events mid-session, RLS makes their *data* correct instantly, but the
  // *displayed* name is just client state unless refetched — refetch on
  // every route change plus a light poll so it can never drift far.
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.tenantId) return;
    fetchActiveEventId(currentUser.tenantId).then(setActiveEventId).catch(() => {});
  }, [isLoggedIn, currentPage, currentUser?.tenantId]);

  useEffect(() => {
    if (!isLoggedIn || !currentUser?.tenantId) return;
    const tenantId = currentUser.tenantId;
    const interval = setInterval(() => {
      fetchActiveEventId(tenantId).then(setActiveEventId).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, currentUser?.tenantId]);

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

  const setEstimationsList = async (newList: Estimation[]) => {
    const previous = estimationsList;
    setEstimationsListState(newList);
    try {
      await syncEstimations(previous, newList);
    } catch (err) {
      console.error('Failed to save estimation changes', err);
      alert(t('common.saveError'));
      setEstimationsListState(previous);
    }
  };

  const setCommitteeInfo = async (info: CommitteeInfo) => {
    const previous = committeeInfo;
    setCommitteeInfoState(info);
    try {
      const saved = await updateCommitteeInfo(info);
      if (saved.id !== info.id) setCommitteeInfoState(saved);
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
  const handleLog = (
    action: ActivityAction,
    module: ActivityModule,
    summary: string,
    count = 1,
    changes?: ActivityFieldChange[],
    recordLabel?: string
  ) => {
    if (!currentUser) return;
    logActivity({
      userId: currentUser.id,
      username: currentUser.username,
      userName: currentUser.name,
      action,
      module,
      summary,
      count,
      device: 'web',
      changes,
      recordLabel,
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

  const handleSubscriptionExtended = async () => {
    if (!currentUser?.tenantId) return;
    try {
      const expiresAt = await fetchTenantSubscriptionExpiry(currentUser.tenantId);
      const updated = { ...currentUser, subscriptionExpiresAt: expiresAt };
      setCurrentUser(updated);
      saveSession(updated);
    } catch (err) {
      console.error('Failed to refresh subscription status', err);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
    clearStoredSession();
    setTenantAccessToken(null);
    // The URL sync effect only runs while isLoggedIn, so it won't clean up
    // whatever authed page's URL was showing (e.g. /chanda-collection) —
    // reset it to /login explicitly so the address bar matches the login
    // screen that's about to render.
    window.history.pushState(null, '', '/login');
    setLoggedOutPath('/login');
  };

  // Platform-admin route — entirely separate app/session, mounted before
  // any of the committee-app gates below (not-configured/loadError/
  // dataLoading/isLoggedIn all belong to the committee flow only).
  if (window.location.pathname.startsWith('/super-admin')) {
    return <SuperAdminRoot />;
  }

  if (loadError === 'not-configured') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-red-200 dark:border-red-500/30">
          <h1 className="text-xl font-bold text-red-700 mb-3">Supabase is not configured</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Create a <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env</code> file in the project root (copy{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.env.example</code>) with your Supabase project's URL and
            anon key, then restart the dev server / rebuild the app.
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 text-sm p-3 rounded overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
          </pre>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-red-200 dark:border-red-500/30">
          <h1 className="text-xl font-bold text-red-700 mb-3">Couldn't load data</h1>
          <p className="text-gray-700 dark:text-gray-300">{loadError}</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading…
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (loggedOutPath === '/') {
      return (
        <LandingPage
          onGoToLogin={() => {
            window.history.pushState(null, '', '/login');
            setLoggedOutPath('/login');
          }}
          onGoToLegal={slug => {
            window.history.pushState(null, '', `/${slug}`);
            setLoggedOutPath(`/${slug}`);
          }}
        />
      );
    }
    if (loggedOutPath === '/terms' || loggedOutPath === '/privacy' || loggedOutPath === '/refund') {
      return (
        <LegalPage
          slug={loggedOutPath.slice(1)}
          onBack={() => {
            window.history.pushState(null, '', '/');
            setLoggedOutPath('/');
          }}
        />
      );
    }
    return <LoginPage logo={committeeInfo.logo} onLogin={handleLogin} />;
  }

  const subscriptionExpired =
    currentUser?.subscriptionExpiresAt != null &&
    new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now();

  if (subscriptionExpired) {
    // Admins can still reach a standalone Billing screen to renew — they're
    // the only ones who could pay anyway (Billing is admin-only). Everyone
    // else just sees the block; they can't act on it, only their admin can.
    if (currentUser?.isAdmin) {
      return (
        <div className="min-h-screen bg-[#eceef1] dark:bg-gray-950 p-4 sm:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Durga CRM</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition"
              >
                Log out
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 sm:p-6">
              <Billing
                currentUser={currentUser}
                committeeName={committeeInfo.association || committeeInfo.name}
                onSubscriptionExtended={handleSubscriptionExtended}
              />
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-orange-200 dark:border-orange-500/30">
          <div className="w-14 h-14 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-4 text-2xl">⏳</div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">You are out of subscription</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Your committee's subscription has expired. Contact your committee admin to renew.
          </p>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  if (eventsLoadError) {
    // Distinct from "no event exists yet" below — this means the check
    // itself failed (e.g. a missing DB grant), so don't wrongly tell an
    // admin with real events to go create one.
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-red-200 dark:border-red-500/30">
          <h1 className="text-xl font-bold text-red-700 mb-3">Couldn't check your active Puja / Festival</h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">{eventsLoadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!activeEventId) {
    return (
      <CreateFirstEventScreen
        isAdmin={!!currentUser?.isAdmin}
        currentUserId={currentUser?.id || ''}
        onCreated={(event) => {
          setEvents(prev => [...prev, event]);
          setActiveEventId(event.id);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#eceef1] dark:bg-gray-950 flex">
      <Sidebar
        logo={committeeInfo.logo}
        association={committeeInfo.association || committeeInfo.name}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        permissions={currentUser?.permissions}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        events={events}
        activeEventId={activeEventId}
        isAdmin={!!currentUser?.isAdmin}
        currentUserId={currentUser?.id || ''}
        onEventCreated={(event) => setEvents(prev => [...prev, event])}
        onEventUpdated={(event) => setEvents(prev => prev.map(e => e.id === event.id ? event : e))}
        onEventSwitched={(eventId) => setActiveEventId(eventId)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — flat, blends into the page background (no border/shadow) */}
        <div className="sticky top-0 z-20 bg-[#eceef1] dark:bg-gray-950">
          <div className="px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 shrink-0"
              aria-label={t('sidebar.openMenu')}
            >
              <Menu size={22} />
            </button>
            <button
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label={sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>

            <div className="flex-1 min-w-0">
              <GlobalSearch
                members={members}
                chandaList={chandaList}
                donationAdsList={donationAdsList}
                expenses={expenses}
                currentUser={currentUser}
                onNavigate={setCurrentPage}
              />
            </div>

            <button
              onClick={toggleTheme}
              className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button
              onClick={() => setHelpSupportOpen(true)}
              className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
              aria-label="Help & Support"
              title="Help & Support"
            >
              <HelpCircle size={20} />
            </button>

            <ProfileMenu
              currentUser={currentUser}
              logo={committeeInfo.logo}
              onLogout={handleLogout}
              onGoToSettingsTab={goToSettingsTab}
              onGoToBilling={() => setCurrentPage('billing')}
              showSettings={!!currentUser?.permissions.settings}
            />
          </div>
        </div>

        {/* Main Content — a rounded card inset from the edges, in a gray
            slightly lighter than the sidebar/top bar so the white widget
            and table cards inside it still stand out; content itself
            stays centered/max-width so it doesn't stretch edge to edge
            on very wide screens */}
        <main className="flex-1 px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
        <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 sm:p-6 min-h-[calc(100vh-5.5rem)]">
        <div className="container mx-auto">
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
        {currentPage === 'donation' && (
          <DonationAdsCollection
            donationAdsList={donationAdsList}
            setDonationAdsList={setDonationAdsList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
            fixedCategory="donation"
          />
        )}
        {currentPage === 'ads' && (
          <DonationAdsCollection
            donationAdsList={donationAdsList}
            setDonationAdsList={setDonationAdsList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            canBulkImport={currentUser?.canBulkImport !== false}
            onLog={handleLog}
            fixedCategory="ads"
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
          <Treasury chandaList={chandaList} donationAdsList={donationAdsList} expenses={expenses} loansList={loansList} members={members} committeeAssociation={committeeInfo.association || committeeInfo.name} committeeLogo={committeeInfo.logo} />
        )}
        {currentPage === 'report' && (
          <Report
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
            members={members}
            loansList={loansList}
            estimationsList={estimationsList}
            committeeAssociation={committeeInfo.association || committeeInfo.name}
            committeeLogo={committeeInfo.logo}
            activeEventLabel={(() => {
              const e = events.find(ev => ev.id === activeEventId);
              return e ? `${e.name} ${e.year}` : '';
            })()}
            onRefreshData={refreshCoreData}
          />
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
            initialTab={settingsTab}
            tabRequestId={settingsTabRequestId}
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
            currentUserId={currentUser?.id || ''}
            currentUserName={currentUser?.name || ''}
            isAdmin={!!currentUser?.isAdmin}
            onLog={handleLog}
          />
        )}
        {currentPage === 'estimation' && (
          <EstimationPage
            estimationsList={estimationsList}
            setEstimationsList={setEstimationsList}
            canEdit={currentUser?.canEdit !== false}
            canDelete={currentUser?.canDelete !== false}
            currentUserId={currentUser?.id || ''}
            currentUserName={currentUser?.name || ''}
            committeeAssociation={committeeInfo.association}
            onLog={handleLog}
          />
        )}
        {currentPage === 'billing' && (
          <Billing
            currentUser={currentUser}
            committeeName={committeeInfo.association || committeeInfo.name}
            onSubscriptionExtended={handleSubscriptionExtended}
          />
        )}
        </div>
        </div>
        </main>
      </div>
      <HelpSupportModal open={helpSupportOpen} onClose={() => setHelpSupportOpen(false)} currentUser={currentUser} />
    </div>
  );
}

function ProfileMenu({
  currentUser,
  logo,
  onLogout,
  onGoToSettingsTab,
  onGoToBilling,
  showSettings,
}: {
  currentUser: User | null;
  logo: string;
  onLogout: () => void;
  onGoToSettingsTab: (tab: SettingsTab) => void;
  onGoToBilling: () => void;
  showSettings: boolean;
}) {
  // No per-user profile photo exists in this schema — reuse the committee
  // logo as the avatar image when one's been uploaded, same as mobile's
  // ProfileScreen; fall back to the name-initial circle otherwise.
  const isLogoUrl = !!logo && (logo.startsWith('data:') || logo.startsWith('http'));
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

  const goTo = (tab: SettingsTab) => {
    onGoToSettingsTab(tab);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
          {isLogoUrl ? (
            <img src={logo} alt="" className="w-full h-full object-cover" />
          ) : (
            (currentUser?.name || '?').charAt(0).toUpperCase()
          )}
        </div>
        <div className="text-left hidden sm:block">
          <p className="font-bold text-sm leading-tight text-gray-800 dark:text-gray-200">{currentUser?.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{currentUser?.isAdmin ? t('header.admin') : t('header.user')} ({t('header.active')})</p>
        </div>
        <ChevronDown size={16} className="text-gray-400 dark:text-gray-500 hidden sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 border border-gray-300 dark:border-gray-600 flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
              {isLogoUrl ? (
                <img src={logo} alt="" className="w-full h-full object-cover" />
              ) : (
                (currentUser?.name || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{currentUser?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentUser?.username ? `@${currentUser.username} · ` : ''}{currentUser?.isAdmin ? t('header.admin') : t('header.user')}
              </p>
            </div>
          </div>

          {showSettings && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-800" />
              <div className="py-1">
                <button
                  onClick={() => goTo('committee')}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Building2 size={18} />
                  {t('settings.tab.committee')}
                </button>
                <button
                  onClick={() => goTo('password')}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Lock size={18} />
                  {t('settings.tab.password')}
                </button>
                {currentUser?.isAdmin && (
                  <button
                    onClick={() => goTo('users')}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    <UsersIcon size={18} />
                    {t('settings.tab.users')}
                  </button>
                )}
                {currentUser?.isAdmin && (
                  <button
                    onClick={() => { onGoToBilling(); setOpen(false); }}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    <CreditCardIcon size={18} />
                    Billing
                  </button>
                )}
                <button
                  onClick={() => goTo('language')}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Languages size={18} />
                  {t('settings.tab.language')}
                </button>
                {currentUser?.isAdmin && (
                  <button
                    onClick={() => goTo('developer')}
                    className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                  >
                    <Code size={18} />
                    {t('settings.tab.developer')}
                  </button>
                )}
              </div>
            </>
          )}

          <div className="border-t border-gray-100 dark:border-gray-800" />
          <button
            onClick={() => { onLogout(); setOpen(false); }}
            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-3"
          >
            <LogOut size={18} />
            {t('header.logout')}
          </button>
        </div>
      )}
    </div>
  );
}

