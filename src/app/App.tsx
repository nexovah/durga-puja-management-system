import { useState, useEffect, useRef, useMemo } from 'react';
import { Menu, LogOut, ChevronDown, Building2, Users as UsersIcon, Languages, Code, PanelLeftClose, Sun, Moon, CreditCard as CreditCardIcon, Compass, Pencil, Check } from 'lucide-react';
import { LoginPage } from './components/LoginPage';
import { setTenantAccessToken } from './lib/supabaseClient';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { LandingPage } from './components/LandingPage';
import { LegalPage } from './components/LegalPage';
import { ReceiptPublicPage } from './components/ReceiptPublicPage';
import { TenantResetPassword } from './components/TenantResetPassword';
import { CheckoutPage, CheckoutDoneUpdates } from './components/CheckoutPage';
import { SuperAdminRoot } from './components/SuperAdminRoot';
import { getPlatformSettingsRequest } from './lib/superAdminDb';
import { Billing } from './components/Billing';
import { HelpSupportPage } from './components/HelpSupportPage';
import { Assets } from './components/Assets';
import { Awards } from './components/Awards';
import { Documents } from './components/Documents';
import { Sidebar } from './components/Sidebar';
import { EventSwitcher } from './components/EventSwitcher';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { Donors } from './components/Donors';
import { Committee } from './components/Committee';
import { ChandaCollection } from './components/ChandaCollection';
import { DonationAdsCollection } from './components/DonationAdsCollection';
import { Expenses } from './components/Expenses';
import { Vendors } from './components/Vendors';
import { Advertisers } from './components/Advertisers';
import { ManageFestivalsPage } from './components/ManageFestivalsPage';
import { Loans } from './components/Loans';
import { Treasury } from './components/Treasury';
import { Report } from './components/Report';
import { Settings, SettingsTab } from './components/Settings';
import { ActivityLog } from './components/ActivityLog';
import { Tasks } from './components/Tasks';
import { EstimationPage } from './components/Estimation';
import { GlobalSearch } from './components/GlobalSearch';
import { ConnectivityPill } from './components/ConnectivityPill';
import { HelpSupportMenu } from './components/HelpSupportMenu';
import { useLanguage } from './i18n/LanguageContext';
import { useTheme, Theme } from './i18n/ThemeContext';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
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
  getMyCurrentEventRequest,
  fetchTenantSlug,
  getReceiptSettingsRequest,
  ReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
  fetchMyTicketActivity,
  Award,
  fromMemberRow,
  fromChandaRow,
  fromDonationAdRow,
  fromExpenseRow,
  fromLoanRow,
  fromTaskRow,
  fromEstimationRow,
  fromAwardRow,
  fromUserRow,
  fromCommitteeRow,
  Donor,
  CommitteeMember,
  listDonorsRequest,
  listCommitteeMembersRequest,
  Vendor,
  Advertiser,
  AppDocument,
  Asset,
  ActivityLogEntry,
  listVendorsRequest,
  listAdvertisersRequest,
  listDocumentsRequest,
  listAssetsRequest,
  fetchActivityLog,
} from './lib/db';
import { CreateFirstEventScreen } from './components/CreateFirstEventScreen';
import { PhoneCaptureScreen } from './components/PhoneCaptureScreen';
import { formatFinancialYear } from './components/EventSwitcher';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string; // optional, from app_users.email — used to attribute Help & Support posts
  phone?: string; // optional, from app_users.phone — missing means the PhoneCaptureScreen gate shows
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
    assets?: boolean;
    documents?: boolean;
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
  districtPS: string; // District
  policeStation: string; // Police Station
  pinCode: string; // Pin code
  mobile1: string; // Primary mobile number
  mobile2?: string; // Secondary mobile number (optional)
  address: string; // Full address (kept for backward compatibility)
  phone: string; // Phone (kept for backward compatibility)
  year: string; // Year (kept for backward compatibility)
  chandaAmount1Label?: string; // Custom name for Chanda's Amount 1 field, admin-editable, tenant-wide
  chandaAmount2Label?: string; // Custom name for Chanda's Amount 2 field, admin-editable, tenant-wide
  hiddenNavKeys?: string[]; // Array of navigation keys hidden from the sidebar by tenant admin
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

export type ChandaCategory = 'owner' | 'tenant' | 'apartment' | 'shop';

export interface Chanda {
  id: string;
  donorName: string;
  category?: ChandaCategory; // donor type — Owner / Tenant / Apartment or Flat / Shop
  numPersons?: number; // how many people in the donor's household/flat
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
  collectedBy?: string; // who physically collected this — mirrors DonationAd's collectedBy field
  receiptNumber: string | null; // DB-assigned on insert, read-only — see assign_chanda_receipt_number()
  receiptToken: string; // DB-assigned random token, the public receipt link's unique id
  donorId?: string | null; // links to a standing Donor record when picked via the "Member" tab; null for Third-party/free-text entries
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

// The amount credited toward total collection for a Donation/Ads entry:
// paid -> full amount counts, pending/rejected -> 0 (no partial for Donation/Ads).
export function getDonationAdCreditAmount(item: DonationAd): number {
  switch (item.paymentStatus) {
    case 'paid':
      return item.amount;
    case 'pending':
    case 'rejected':
      return 0;
    default:
      // Backward compatibility: records saved before payment_status existed default to paid.
      return item.amount;
  }
}


export interface DonationAd {
  id: string;
  category: DonationAdCategory;
  donorName: string;
  companyName?: string; // Ads only
  amount: number;
  paidMethod: PaidMethod;
  paymentStatus: PaymentStatus;
  inKind: string; // Donation/Ads in kinds (free text)
  date: string;
  voucherNumber?: string; // Donation entries only
  phone: string; // Phone Number 1
  phone2?: string; // Phone Number 2 (optional)
  collectedBy?: string; // Committee member or third party who collected this entry
  remarks: string;
  donorId?: string | null; // links to a standing Donor record when picked via the "Member" tab; null for Third-party/free-text entries
  advertiserId?: string | null; // links to a standing Advertiser record when picked via the Ads-category Third-party tab; null otherwise
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
  vendorContact2?: string;
  vendorId?: string | null; // links to a standing Vendor record when the typed name matches one; null for one-off vendor names
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
  paymentMethod: PaidMethod; // method the loan was received in
  returnMethod?: PaidMethod; // method the repayment (amountPaid) went out through — separate from paymentMethod
  paymentStatus: 'paid'; // loans are always recorded as paid out
  date: string;
  returnDate?: string;
  remarks: string;
  donorId?: string | null; // links to a standing Donor/Committee-member record when picked via search; null for a free-typed lender name
}

// Net contribution of a loan to the committee's balance: what's still held
// from the lender. Received adds credit, repaying it deducts from that same
// credit — fully repaid nets to zero.
export function getLoanNetAmount(loan: Loan): number {
  return loan.amountReceived - (loan.amountPaid || 0);
}

// Unlike Chanda/Expenses there's no pending/partial concept for an award —
// a recorded award represents prize money already received, so it always
// counts in full as committee income.
export function getAwardCreditAmount(award: Award): number {
  return award.prizeMoney || 0;
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
  hiddenNavKeys: [],
};

const EMPTY_DEVELOPER_INFO: DeveloperInfo = {
  name: '',
  email: '',
  phone: '',
  version: '',
};

const SESSION_STORAGE_KEY = 'puja-session';
const CHECKOUT_RESUME_KEY = 'puja-checkout-resume';
const CHECKOUT_RESUME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
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

type PageKey = 'dashboard' | 'members' | 'donors' | 'chanda' | 'donation' | 'ads' | 'expenses' | 'vendors' | 'advertisers' | 'loans' | 'treasury' | 'report' | 'settings' | 'activityLog' | 'assets' | 'documents' | 'tasks' | 'estimation' | 'billing' | 'helpSupport' | 'awards' | 'manageFestivals';

const PAGE_SLUGS: Record<PageKey, string> = {
  dashboard: '/dashboard',
  members: '/members',
  donors: '/donors',
  chanda: '/chanda-collection',
  donation: '/donation-collection',
  ads: '/ads-collection',
  expenses: '/expenses',
  vendors: '/vendors',
  advertisers: '/advertisers',
  loans: '/loans',
  treasury: '/treasury',
  report: '/report',
  settings: '/settings',
  activityLog: '/activity-log',
  assets: '/assets',
  awards: '/awards',
  documents: '/documents',
  tasks: '/tasks',
  estimation: '/estimation',
  billing: '/billing',
  helpSupport: '/help-support',
  manageFestivals: '/manage-festivals',
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
  const [hasUnreadSupportReply, setHasUnreadSupportReply] = useState(false);

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
  // Plan selected on the landing page, carried through signup into
  // checkout — session is established (loginRequest) but `isLoggedIn`
  // stays false until checkout finishes/is skipped, so this whole flow
  // stays inside the logged-out render branch below.
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('plan'));
  const [pendingCheckoutUser, setPendingCheckoutUser] = useState<User | null>(null);

  // Resumes an in-progress checkout after a refresh/backgrounded-tab
  // reload — `pendingCheckoutUser` is pure React state and wouldn't
  // otherwise survive a remount, even though the tenant session itself
  // (the JWT set at enterCheckout time) is still valid.
  useEffect(() => {
    if (loggedOutPath !== '/checkout' || pendingCheckoutUser) return;
    const raw = localStorage.getItem(CHECKOUT_RESUME_KEY);
    if (!raw) return;
    try {
      const { userId, planId, savedAt } = JSON.parse(raw);
      if (!userId || !planId || Date.now() - savedAt > CHECKOUT_RESUME_MAX_AGE_MS) {
        localStorage.removeItem(CHECKOUT_RESUME_KEY);
        return;
      }
      supabase.from('app_users').select('*').eq('id', userId).single().then(({ data, error }) => {
        if (error || !data) {
          localStorage.removeItem(CHECKOUT_RESUME_KEY);
          return;
        }
        setPendingCheckoutUser(fromUserRow(data));
        setCheckoutPlanId(planId);
      });
    } catch {
      localStorage.removeItem(CHECKOUT_RESUME_KEY);
    }
  }, [loggedOutPath, pendingCheckoutUser]);

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

  const [chandaAddRequestId, setChandaAddRequestId] = useState(0);
  const goToAddDonor = () => {
    setChandaAddRequestId(id => id + 1);
    setCurrentPage('chanda');
  };

  // Donors page's detail-modal "Add Collection" button — same bump-and-
  // navigate shape as goToAddDonor, plus the specific donor id to
  // pre-select on arrival (see ChandaCollection's initialDonorId prop).
  const [chandaAddDonorId, setChandaAddDonorId] = useState<string | null>(null);
  const goToAddCollectionForDonor = (donorId: string) => {
    setChandaAddDonorId(donorId);
    setChandaAddRequestId(id => id + 1);
    setCurrentPage('chanda');
  };

  // Same "bump a counter, switch page, the destination page's effect pops
  // its own Add form open" convention as goToAddDonor above — one per
  // Cmd/Ctrl+<letter> quick-add shortcut (GlobalSearch's Actions list).
  const [memberAddRequestId, setMemberAddRequestId] = useState(0);
  const goToAddMember = () => { setMemberAddRequestId(id => id + 1); setCurrentPage('members'); };
  const [donationAddRequestId, setDonationAddRequestId] = useState(0);
  const goToAddDonation = () => { setDonationAddRequestId(id => id + 1); setCurrentPage('donation'); };
  const [adsAddRequestId, setAdsAddRequestId] = useState(0);
  const goToAddSponsorship = () => { setAdsAddRequestId(id => id + 1); setCurrentPage('ads'); };
  const [expenseAddRequestId, setExpenseAddRequestId] = useState(0);
  const goToAddExpense = () => { setExpenseAddRequestId(id => id + 1); setCurrentPage('expenses'); };

  // Global quick-add shortcuts — Cmd/Ctrl+M/C/D/S/E — mirrored in
  // GlobalSearch's "Actions" list (⌘ badges) so the keys shown there
  // actually do something from anywhere in the app, not just that menu.
  // Each one switches to its page (if not already there) and pops that
  // page's Add form open via the initialAddRequestId counter convention,
  // gated by the same permission check as the corresponding nav item/
  // GlobalSearch action row.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      const perms = currentUser?.permissions;
      if (key === 'm' && perms?.members) {
        e.preventDefault();
        goToAddMember();
      } else if (key === 'b' && perms?.chanda) {
        e.preventDefault();
        goToAddDonor();
      } else if (key === 'd' && (perms?.donation ?? perms?.donationAds)) {
        e.preventDefault();
        goToAddDonation();
      } else if (key === 's' && (perms?.ads ?? perms?.donationAds)) {
        e.preventDefault();
        goToAddSponsorship();
      } else if (key === 'e' && perms?.expenses) {
        e.preventDefault();
        goToAddExpense();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [committeeInfo, setCommitteeInfoState] = useState<CommitteeInfo>(EMPTY_COMMITTEE_INFO);
  const [members, setMembersState] = useState<Member[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [chandaList, setChandaListState] = useState<Chanda[]>([]);
  const [donationAdsList, setDonationAdsListState] = useState<DonationAd[]>([]);
  const [expenses, setExpensesState] = useState<Expense[]>([]);
  const [loansList, setLoansListState] = useState<Loan[]>([]);
  const [tasksList, setTasksListState] = useState<Task[]>([]);
  const [estimationsList, setEstimationsListState] = useState<Estimation[]>([]);
  const [awardsList, setAwardsListState] = useState<Award[]>([]);
  // Lifted to App.tsx (instead of a local useEffect fetch in each page) so
  // these 5 lists survive navigation/offline the same way members/chandaList/
  // etc. above do — App.tsx never unmounts while switching pages, so data
  // fetched once here stays available even if the device goes offline and
  // the user navigates away from and back to Vendors/Advertisers/Documents/
  // Assets/ActivityLog. See listVendorsRequest()/listDonorsRequest() comment.
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  // Live cross-session sync — once the socket is authorized with this
  // tenant's JWT (setTenantAccessToken -> supabase.realtime.setAuth, see
  // supabaseClient.ts), RLS scopes postgres_changes the same way it scopes
  // every REST call, so another logged-in user's add/edit/delete shows up
  // here within a second or two, no refresh/polling needed.
  const realtimeEnabled = isLoggedIn && !!currentUser?.tenantId;
  useRealtimeSync(realtimeEnabled, 'members', setMembersState, fromMemberRow);
  useRealtimeSync(realtimeEnabled, 'chanda', setChandaListState, fromChandaRow);
  useRealtimeSync(realtimeEnabled, 'donation_ads', setDonationAdsListState, fromDonationAdRow);
  useRealtimeSync(realtimeEnabled, 'expenses', setExpensesState, fromExpenseRow);
  useRealtimeSync(realtimeEnabled, 'loans', setLoansListState, fromLoanRow);
  useRealtimeSync(realtimeEnabled, 'tasks', setTasksListState, fromTaskRow);
  useRealtimeSync(realtimeEnabled, 'estimations', setEstimationsListState, fromEstimationRow);
  useRealtimeSync(realtimeEnabled, 'awards', setAwardsListState, fromAwardRow);
  useRealtimeSync(realtimeEnabled, 'app_users', setUsers, fromUserRow);
  // vendors/advertisers/documents/assets/activity_log are NOT synced here —
  // each of those pages already runs its own local useRealtimeSync (same
  // precedent as donors/committeeMembers below, which are also fetched
  // centrally but synced locally). A second central subscription here
  // duplicated each page's existing one — two simultaneous Supabase
  // Realtime channels sharing the same topic name — which crashed those
  // pages to a blank screen on mount. Do not re-add these.
  useEffect(() => {
    if (!realtimeEnabled) return;
    const channel = supabase
      .channel('sync:committee_info')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'committee_info' }, (payload) => {
        if (payload.eventType === 'DELETE') return;
        setCommitteeInfoState(fromCommitteeRow(payload.new));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realtimeEnabled]);
  const [developerInfo, setDeveloperInfoState] = useState<DeveloperInfo>(EMPTY_DEVELOPER_INFO);
  const [events, setEvents] = useState<EventInfo[]>([]);
  // `activeEventId` = THIS user's own current-event selection
  // (app_users.current_event_id) — a tenant can now have multiple
  // `events[i].isActive` festivals at once; `activeEvents` below is that
  // admin-managed pool, `activeEventId` is which one of them this
  // particular user is personally viewing right now.
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const activeEvents = useMemo(() => events.filter(e => e.isActive), [events]);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(DEFAULT_RECEIPT_SETTINGS);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

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
        setAwardsListState(data.awardsList);
        setCommitteeInfoState(data.committeeInfo);
        setDeveloperInfoState(data.developerInfo);
        setUsers(data.users);
        // Tenant-wide (not event-scoped), same permanence as vendors — fetched
        // once here so the Chanda/DonationAds "Member" tab donor-picker is
        // populated even for a session that never visits the Donors/Committee
        // pages directly (those pages also self-fetch on mount, which is fine
        // and idempotent, but must not be the only place this loads).
        Promise.all([listDonorsRequest(), listCommitteeMembersRequest()])
          .then(([donorsList, committeeList]) => { setDonors(donorsList); setCommitteeMembers(committeeList); })
          .catch(err => console.error('Failed to load donors/committee members', err));
        // Same reasoning as donors/committeeMembers above — Vendors,
        // Advertisers, Documents, Assets and ActivityLog used to fetch their
        // own data in a local useEffect on mount, which meant the data was
        // destroyed on every navigation away from the page (since App.tsx
        // conditionally unmounts them) and silently failed to reload while
        // offline, leaving the page blank. Loading them once here instead
        // keeps them populated across navigation/offline the same way every
        // other centrally-loaded list already is.
        Promise.all([
          listVendorsRequest(),
          listAdvertisersRequest(),
          listDocumentsRequest(),
          listAssetsRequest(),
          fetchActivityLog(),
        ])
          .then(([vendorsList, advertisersList, documentsList, assetsList, activityLogList]) => {
            setVendors(vendorsList);
            setAdvertisers(advertisersList);
            setDocuments(documentsList);
            setAssets(assetsList);
            setActivityLog(activityLogList);
          })
          .catch(err => console.error('Failed to load vendors/advertisers/documents/assets/activity log', err));
        // Non-fatal — the Help & Support notification dot just stays off if this fails.
        fetchMyTicketActivity().then(rows => setHasUnreadSupportReply(rows.some(r => r.hasUnreadAdminReply))).catch(() => {});
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
        const [eventsList, myEventId] = await Promise.all([fetchEvents(), getMyCurrentEventRequest()]);
        setEvents(eventsList);
        setActiveEventId(myEventId);
        setEventsLoadError(null);
      } catch (err: any) {
        console.error('Failed to load events', err);
        setEventsLoadError(err?.message || 'unknown-error');
      } finally {
        setDataLoading(false);
      }
    })();
  }, [isLoggedIn]);

  // The 8 event-scoped tables are RLS-filtered live by current_event_id() —
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

  // Refetch the 8 event-scoped lists on demand — used by the event-switch
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
    setAwardsListState(data.awardsList);
  };

  useEffect(() => {
    if (!isLoggedIn || !currentUser?.tenantId) return;
    fetchTenantSlug(currentUser.tenantId).then(setTenantSlug).catch(() => {});
    getReceiptSettingsRequest().then(setReceiptSettings).catch(() => {});
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
      alert(t('common.saveError') + (err && (err as any).message ? '\n\n' + (err as any).message : ''));
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
    canBulkImport: boolean,
    email?: string
  ) => {
    const newUser = await createUserRequest(name, username, password, permissions, canEdit, canDelete, canBulkImport, email);
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
    newPassword?: string,
    email?: string
  ) => {
    const updated = await updateUserRequest(userId, name, permissions, canEdit, canDelete, canBulkImport, newPassword, email);
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

  // Handles both steps of the Google login/signup flow (see
  // src/app/components/LoginPage.tsx and api/auth/google-verify.js):
  // single round trip — either logs an existing Google-linked user straight
  // in, or (no account found) creates the tenant (auto-derived placeholder
  // name, no second "pick a committee name" screen) and logs that new
  // account straight in too. Same session-establishing steps as
  // handleLogin, except the access token/row came back from this route
  // rather than directly from supabase.rpc('login', ...).
  // Shared by both the manual and Google new-signup paths: establishes
  // the pending-checkout state and persists just enough to localStorage
  // ({ userId, planId, savedAt }) so a mid-payment refresh/backgrounded
  // tab doesn't strand the user — see the resume effect below.
  const enterCheckout = (user: User, planId: string) => {
    setPendingCheckoutUser(user);
    setCheckoutPlanId(planId);
    localStorage.setItem(CHECKOUT_RESUME_KEY, JSON.stringify({ userId: user.id, planId, savedAt: Date.now() }));
    window.history.pushState(null, '', `/checkout?plan=${planId}`);
    setLoggedOutPath('/checkout');
  };

  const handleGoogleAuth = async (idToken: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/google-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: body?.error || 'Google sign-in failed' };
      }
      const row = body.user;
      setTenantAccessToken(row.access_token || null);
      const user = fromUserRow(row);
      if (body.isNewSignup && checkoutPlanId) {
        // Stays in the !isLoggedIn branch (deliberately no setIsLoggedIn
        // here) so the /checkout render block above picks this up next
        // render, same as the manual-signup handoff.
        enterCheckout(user, checkoutPlanId);
        return { success: true };
      }
      setCurrentUser(user);
      setIsLoggedIn(true);
      saveSession(user);
      return { success: true };
    } catch (err: any) {
      console.error('Google auth failed', err);
      return { success: false, error: err?.message || 'Google sign-in failed' };
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

  // Public digital receipt — /<tenant-slug>/receipt/<token>, no auth, no
  // tenant RLS (fetched via the token-gated get_chanda_receipt_public()
  // RPC). Must be checked before every other gate since it works fully
  // logged-out, for any tenant, from a link shared with a donor.
  const receiptMatch = window.location.pathname.match(/^\/([^/]+)\/receipt\/([0-9a-f-]+)$/i);
  if (receiptMatch) {
    return <ReceiptPublicPage tenantSlug={receiptMatch[1]} token={receiptMatch[2]} />;
  }

  if (loadError === 'not-configured') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-red-200 dark:border-red-500/30">
          <h1 className="text-xl font-bold text-red-700 mb-3">Couldn't load data</h1>
          <p className="text-gray-700 dark:text-gray-300">{loadError}</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
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
          onGoToSignup={planId => {
            const path = planId ? `/signup?plan=${planId}` : '/signup';
            setCheckoutPlanId(planId ?? null);
            window.history.pushState(null, '', path);
            setLoggedOutPath('/signup');
          }}
          onGoToLegal={slug => {
            window.history.pushState(null, '', `/${slug}`);
            setLoggedOutPath(`/${slug}`);
          }}
        />
      );
    }
    if (loggedOutPath === '/checkout' && pendingCheckoutUser && checkoutPlanId) {
      const finishCheckout = (updates: CheckoutDoneUpdates) => {
        const finalUser: User = {
          ...pendingCheckoutUser,
          ...(updates.phone ? { phone: updates.phone } : {}),
          ...(updates.subscriptionExpiresAt ? { subscriptionExpiresAt: updates.subscriptionExpiresAt } : {}),
        };
        setCurrentUser(finalUser);
        setIsLoggedIn(true);
        saveSession(finalUser);
        setPendingCheckoutUser(null);
        setCheckoutPlanId(null);
        localStorage.removeItem(CHECKOUT_RESUME_KEY);
      };
      return (
        <CheckoutPage
          planId={checkoutPlanId}
          userId={pendingCheckoutUser.id}
          tenantId={pendingCheckoutUser.tenantId || ''}
          committeeName={pendingCheckoutUser.name || ''}
          email={pendingCheckoutUser.email || ''}
          phone={pendingCheckoutUser.phone || ''}
          onDone={finishCheckout}
        />
      );
    }
    if (loggedOutPath === '/reset-password') {
      return (
        <TenantResetPassword
          onDone={() => {
            window.history.pushState(null, '', '/login');
            setLoggedOutPath('/login');
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
    return (
      <LoginPage
        logo={committeeInfo.logo}
        onLogin={handleLogin}
        onGoogleAuth={handleGoogleAuth}
        preselectedPlanId={checkoutPlanId}
        onSignupPendingCheckout={enterCheckout}
        initialMode={loggedOutPath === '/signup' ? 'signup' : 'login'}
        onModeChange={newMode => {
          const newPath = newMode === 'signup' ? '/signup' : '/login';
          if (window.location.pathname !== newPath) {
            window.history.pushState(null, '', newPath);
          }
          setLoggedOutPath(newPath);
        }}
        onBackHome={() => {
          window.history.pushState(null, '', '/');
          setLoggedOutPath('/');
        }}
      />
    );
  }

  const subscriptionExpired =
    currentUser?.subscriptionExpiresAt != null &&
    new Date(currentUser.subscriptionExpiresAt).getTime() < Date.now();

  // No active subscription (free trial or paid period lapsed) no longer
  // hard-blocks the app — the tenant can still log in and see everything
  // already recorded. Every mutating action (Add/Edit/Delete/Import/
  // Export) is blocked instead via dataCanEdit/dataCanDelete/
  // dataCanBulkImport below (ANDed into the same canEdit/canDelete/
  // canBulkImport props every data page already consumes), with a
  // persistent banner in the top bar (see the sticky top bar JSX below)
  // pointing them to Billing/Settings to renew.
  const dataCanEdit = currentUser?.canEdit !== false && !subscriptionExpired;
  const dataCanDelete = currentUser?.canDelete !== false && !subscriptionExpired;
  const dataCanBulkImport = currentUser?.canBulkImport !== false && !subscriptionExpired;

  // Hard gate, same pattern as the "no active event yet" gate below — a
  // tenant admin with no phone on file (every self-serve signup before
  // this feature, plus any Google signup, which never gets one from
  // Google) must provide one before reaching the rest of the app. Only
  // admins are gated — the phone that matters for business outreach is
  // the committee's own admin contact, not every staff login.
  if (currentUser?.isAdmin && !currentUser.phone) {
    return (
      <PhoneCaptureScreen
        currentUserId={currentUser.id}
        onCompleted={phone => {
          const updated = { ...currentUser, phone };
          setCurrentUser(updated);
          saveSession(updated);
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (eventsLoadError) {
    // Distinct from "no event exists yet" below — this means the check
    // itself failed (e.g. a missing DB grant), so don't wrongly tell an
    // admin with real events to go create one.
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-md p-8 border border-red-200 dark:border-red-500/30">
          <h1 className="text-xl font-bold text-red-700 mb-3">Couldn't check your active 'Puja, Festival or Event'</h1>
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
          // CreateFirstEventScreen already called setEventActiveRequest(id,
          // true) server-side — reflect that locally too, since the row
          // createEventRequest() returns predates that call (isActive: false).
          setEvents(prev => [...prev, { ...event, isActive: true }]);
          setActiveEventId(event.id);
        }}
        onLogout={handleLogout}
        pickableEvents={activeEvents}
        onPicked={(eventId) => setActiveEventId(eventId)}
      />
    );
  }

  return (
    <div className="min-h-screen outer-bg-gradient flex">
      <Sidebar
        logo={committeeInfo.logo}
        association={committeeInfo.association || committeeInfo.name}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        permissions={currentUser?.permissions}
        hiddenNavKeys={committeeInfo.hiddenNavKeys}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onToggleCollapse={toggleSidebarCollapsed}
        activeEvents={activeEvents}
        currentEventId={activeEventId}
        isAdmin={!!currentUser?.isAdmin}
        currentUserId={currentUser?.id || ''}
        onCurrentEventChanged={(eventId) => setActiveEventId(eventId)}
        onManageFestivals={() => {
          if (window.location.pathname !== '/manage-festivals') {
            window.history.pushState(null, '', '/manage-festivals');
          }
          setCurrentPage('manageFestivals');
        }}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar — flat, blends into the page background (no border/shadow) */}
        <div className="sticky top-0 z-20 outer-bg-gradient">
          <div className="px-3 sm:px-4 lg:px-6 py-3 flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1.5 shrink-0"
              aria-label={t('sidebar.openMenu')}
            >
              <Menu size={22} />
            </button>
            {!sidebarCollapsed && (
              <button
                onClick={toggleSidebarCollapsed}
                className="hidden lg:flex text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg p-1.5 shrink-0 transition-colors"
                aria-label={t('sidebar.collapse')}
              >
                <PanelLeftClose size={20} strokeWidth={1.5} />
              </button>
            )}

            {/* Topbar EventSwitcher is desktop-only — on mobile it's shown
                inside the nav drawer instead (Sidebar.tsx), freeing up the
                cramped header row for search + icons. */}
            <div className="hidden lg:block">
              <EventSwitcher
                variant="topbar"
                collapsed={false}
                activeEvents={activeEvents}
                currentEventId={activeEventId}
                isAdmin={!!currentUser?.isAdmin}
                currentUserId={currentUser?.id || ''}
                onCurrentEventChanged={(eventId) => setActiveEventId(eventId)}
                onManageFestivals={() => {
                  if (window.location.pathname !== '/manage-festivals') {
                    window.history.pushState(null, '', '/manage-festivals');
                  }
                  setCurrentPage('manageFestivals');
                }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <GlobalSearch
                members={members}
                chandaList={chandaList}
                donationAdsList={donationAdsList}
                expenses={expenses}
                currentUser={currentUser}
                onNavigate={setCurrentPage}
                onQuickAdd={(page) => {
                  if (page === 'members') goToAddMember();
                  else if (page === 'chanda') goToAddDonor();
                  else if (page === 'donation') goToAddDonation();
                  else if (page === 'ads') goToAddSponsorship();
                  else if (page === 'expenses') goToAddExpense();
                }}
              />
            </div>

            <ConnectivityPill />

            <HelpSupportMenu
              hasUnreadSupportReply={hasUnreadSupportReply}
              onOpenSupportTicket={() => {
                if (window.location.pathname !== '/help-support') {
                  window.history.pushState(null, '', '/help-support');
                }
                setCurrentPage('helpSupport');
              }}
            />

            <ProfileMenu
              currentUser={currentUser}
              logo={committeeInfo.logo}
              onLogout={handleLogout}
              onGoToSettingsTab={goToSettingsTab}
              onGoToBilling={() => goToSettingsTab('billing')}
              showSettings={!!currentUser?.permissions.settings}
              theme={theme}
              toggleTheme={toggleTheme}
              onNameUpdated={(name) => {
                if (!currentUser) return;
                const updated = { ...currentUser, name };
                setCurrentUser(updated);
                saveSession(updated);
              }}
            />
          </div>
          {subscriptionExpired && (
            <div className="px-3 sm:px-4 lg:px-6 pb-3 flex flex-wrap items-center justify-center gap-2 text-center">
              <div className="w-full sm:w-auto px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium flex flex-wrap items-center justify-center gap-2">
                <span>
                  {currentUser?.isAdmin
                    ? "Your subscription has expired — you can still view your committee's data, but adding, editing, deleting, importing and exporting are disabled until you renew."
                    : "Your committee's subscription has expired — contact your committee admin to renew. You can still view existing data."}
                </span>
                {currentUser?.isAdmin && (
                  <button
                    onClick={() => goToSettingsTab('billing')}
                    className="px-3 py-1 rounded-md bg-white text-red-600 text-xs font-bold hover:bg-red-50 transition-colors whitespace-nowrap"
                  >
                    Renew now →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content — a rounded card inset from the edges, in a gray
            slightly lighter than the sidebar/top bar so the white widget
            and table cards inside it still stand out; content itself
            stays centered/max-width so it doesn't stretch edge to edge
            on very wide screens */}
        <main className="flex-1 px-3 sm:px-4 lg:px-6 pb-4 sm:pb-6">
        <div className="mesh-bg-light rounded-2xl p-4 sm:p-6 min-h-[calc(100vh-5.5rem)]">
        <div className="container mx-auto">
        {currentPage === 'dashboard' && (
          <Dashboard
            members={members}
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
            loansList={loansList}
            awardsList={awardsList}
            tasksList={tasksList}
            activeEvent={events.find(e => e.id === activeEventId) || null}
            receiptSettings={receiptSettings}
            onNavigateToReceiptSettings={() => goToSettingsTab('receipt')}
            onNavigateToAddDonor={goToAddDonor}
            onNavigateToCollection={() => setCurrentPage('chanda')}
          />
        )}
        {currentPage === 'donors' && (
          <Donors
            donors={donors}
            setDonors={setDonors}
            committeeMembers={committeeMembers}
            setCommitteeMembers={setCommitteeMembers}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            events={events}
            onAddCollectionForDonor={goToAddCollectionForDonor}
          />
        )}
        {currentPage === 'members' && (
          <Committee
            donors={donors}
            committeeMembers={committeeMembers}
            setCommitteeMembers={setCommitteeMembers}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            initialAddRequestId={memberAddRequestId}
          />
        )}
        {currentPage === 'chanda' && (
          <ChandaCollection
            chandaList={chandaList}
            setChandaList={setChandaList}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            committeeInfo={committeeInfo}
            onUpdateCommitteeInfo={setCommitteeInfo}
            isAdmin={currentUser?.isAdmin === true}
            receiptSettings={receiptSettings}
            tenantSlug={tenantSlug}
            members={members}
            donationAdsList={donationAdsList}
            initialAddRequestId={chandaAddRequestId}
            initialDonorId={chandaAddDonorId}
            donors={donors}
            setDonors={setDonors}
            committeeMembers={committeeMembers}
            currentUser={currentUser}
            users={users}
          />
        )}
        {currentPage === 'donation' && (
          <DonationAdsCollection
            donationAdsList={donationAdsList}
            setDonationAdsList={setDonationAdsList}
            members={members}
            chandaList={chandaList}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            fixedCategory="donation"
            donors={donors}
            setDonors={setDonors}
            committeeMembers={committeeMembers}
            currentUser={currentUser}
            users={users}
            initialAddRequestId={donationAddRequestId}
          />
        )}
        {currentPage === 'ads' && (
          <DonationAdsCollection
            donationAdsList={donationAdsList}
            setDonationAdsList={setDonationAdsList}
            members={members}
            chandaList={chandaList}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            fixedCategory="ads"
            donors={donors}
            setDonors={setDonors}
            committeeMembers={committeeMembers}
            currentUser={currentUser}
            users={users}
            initialAddRequestId={adsAddRequestId}
          />
        )}
        {currentPage === 'expenses' && (
          <Expenses
            expenses={expenses}
            setExpenses={setExpenses}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
            initialAddRequestId={expenseAddRequestId}
          />
        )}
        {currentPage === 'vendors' && (
          <Vendors
            expenses={expenses}
            vendors={vendors}
            setVendors={setVendors}
            documents={documents}
            setDocuments={setDocuments}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            currentUser={currentUser}
            onLog={handleLog}
          />
        )}
        {currentPage === 'advertisers' && (
          <Advertisers
            donationAds={donationAdsList}
            advertisers={advertisers}
            setAdvertisers={setAdvertisers}
            documents={documents}
            setDocuments={setDocuments}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            currentUser={currentUser}
            onLog={handleLog}
          />
        )}
        {currentPage === 'loans' && (
          <Loans
            loansList={loansList}
            setLoansList={setLoansList}
            members={members}
            donors={donors}
            setDonors={setDonors}
            committeeMembers={committeeMembers}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            canBulkImport={dataCanBulkImport}
            onLog={handleLog}
          />
        )}
        {currentPage === 'treasury' && (
          <Treasury
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
            loansList={loansList}
            members={members}
            awardsList={awardsList}
            committeeAssociation={committeeInfo.association || committeeInfo.name}
            committeeLogo={committeeInfo.logo}
            activeEvent={events.find(e => e.id === activeEventId) || null}
            currentUser={currentUser}
            onLog={handleLog}
          />
        )}
        {currentPage === 'report' && (
          <Report
            chandaList={chandaList}
            donationAdsList={donationAdsList}
            expenses={expenses}
            members={members}
            loansList={loansList}
            awardsList={awardsList}
            estimationsList={estimationsList}
            committeeInfo={committeeInfo}
            committeeAssociation={committeeInfo.association || committeeInfo.name}
            committeeLogo={committeeInfo.logo}
            activeEventLabel={(() => {
              const e = events.find(ev => ev.id === activeEventId);
              return e ? `${e.name} — ${formatFinancialYear(e.year)}` : '';
            })()}
            activeEvent={events.find(e => e.id === activeEventId) || null}
            onRefreshData={refreshCoreData}
          />
        )}
        {currentPage === 'settings' && (
          <Settings
            committeeInfo={committeeInfo}
            setCommitteeInfo={setCommitteeInfo}
            receiptSettings={receiptSettings}
            setReceiptSettings={setReceiptSettings}
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
            onSubscriptionExtended={handleSubscriptionExtended}
            subscriptionExpired={subscriptionExpired}
          />
        )}
        {currentPage === 'activityLog' && (
          <ActivityLog activityLog={activityLog} setActivityLog={setActivityLog} />
        )}
        {currentPage === 'assets' && (
          <Assets
            assets={assets}
            setAssets={setAssets}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            onLog={handleLog}
            companyName={committeeInfo.association || committeeInfo.name}
            companyLogo={committeeInfo.logo}
          />
        )}
        {currentPage === 'awards' && (
          <Awards
            awardsList={awardsList}
            onAwardsChanged={setAwardsListState}
            committeeMembers={committeeMembers}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            onLog={handleLog}
          />
        )}
        {currentPage === 'documents' && (
          <Documents
            documents={documents}
            setDocuments={setDocuments}
            currentUser={currentUser}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
            eventLabel={(() => {
              const e = events.find(ev => ev.id === activeEventId);
              return e ? `${e.name} — ${formatFinancialYear(e.year)}` : '';
            })()}
            onLog={handleLog}
          />
        )}
        {currentPage === 'tasks' && (
          <Tasks
            tasksList={tasksList}
            setTasksList={setTasksList}
            members={members}
            committeeMembers={committeeMembers}
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
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
            canEdit={dataCanEdit}
            canDelete={dataCanDelete}
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
            committeeInfo={committeeInfo}
            developerInfo={developerInfo}
            onSubscriptionExtended={handleSubscriptionExtended}
          />
        )}
        {currentPage === 'helpSupport' && (
          <HelpSupportPage
            currentUser={currentUser}
            committeeName={committeeInfo.association || committeeInfo.name}
            onUnreadChange={setHasUnreadSupportReply}
          />
        )}
        {currentPage === 'manageFestivals' && (
          <ManageFestivalsPage
            events={events}
            currentEventId={activeEventId}
            isAdmin={!!currentUser?.isAdmin}
            currentUserId={currentUser?.id || ''}
            companyName={committeeInfo.association || committeeInfo.name}
            companyLogo={committeeInfo.logo}
            onEventCreated={(event) => setEvents(prev => [...prev, event])}
            onEventUpdated={(event) => setEvents(prev => prev.map(e => e.id === event.id ? event : e))}
            onCurrentEventChanged={(eventId) => setActiveEventId(eventId)}
          />
        )}
        </div>
        </div>
        </main>
      </div>
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
  theme,
  toggleTheme,
  onNameUpdated,
}: {
  currentUser: User | null;
  logo: string;
  onLogout: () => void;
  onGoToSettingsTab: (tab: SettingsTab) => void;
  onGoToBilling: () => void;
  showSettings: boolean;
  theme: Theme;
  toggleTheme: () => void;
  onNameUpdated: (name: string) => void;
}) {
  // No per-user profile photo exists in this schema — reuse the committee
  // logo as the avatar image when one's been uploaded, same as mobile's
  // ProfileScreen; fall back to the name-initial circle otherwise.
  const isLogoUrl = !!logo && (logo.startsWith('data:') || logo.startsWith('http'));
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

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

  const startEditingName = () => {
    setNameInput(currentUser?.name || '');
    setEditingName(true);
  };

  const saveName = async () => {
    if (!currentUser || !nameInput.trim() || savingName) return;
    setSavingName(true);
    try {
      await updateUserRequest(
        currentUser.id, nameInput.trim(), currentUser.permissions,
        currentUser.canEdit, currentUser.canDelete, currentUser.canBulkImport,
        undefined, currentUser.email,
      );
      onNameUpdated(nameInput.trim());
      setEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
    } finally {
      setSavingName(false);
    }
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
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="min-w-0 flex-1 px-2 py-1 text-sm font-bold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName || !nameInput.trim()}
                    className="shrink-0 text-orange-600 hover:text-orange-700 disabled:opacity-50"
                    aria-label={t('common.save')}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{currentUser?.name}</p>
                  <button
                    onClick={startEditingName}
                    className="shrink-0 text-gray-400 hover:text-orange-600 dark:hover:text-orange-400"
                    aria-label={t('common.edit')}
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {/* Email only — username is a synthetic, never-meant-to-be-
                    shown value for Google-signup accounts (see
                    supabase/109_tenant_signup.sql's signup_tenant_google). */}
                {currentUser?.email || currentUser?.username}
              </p>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide mt-1 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {currentUser?.isAdmin ? t('header.admin') : t('header.user')}
              </span>
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
                  onClick={() => goTo('navigation')}
                  className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  <Compass size={18} />
                  {t('settings.tab.navigation')}
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
                    {t('nav.billing')}
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
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">{t('theme.label')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { if (theme !== 'light') toggleTheme(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  theme === 'light'
                    ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Sun size={15} /> {t('theme.light')}
              </button>
              <button
                onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  theme === 'dark'
                    ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Moon size={15} /> {t('theme.dark')}
              </button>
            </div>
          </div>
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

