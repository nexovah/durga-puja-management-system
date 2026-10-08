import {
  LayoutDashboard, Users, HandCoins, Gift, Megaphone, TrendingDown, Wallet,
  Truck, Landmark, CheckSquare, Settings as SettingsIcon, ScrollText,
  FileBarChart, Calculator, Package, FolderOpen, Trophy, UserPlus, UsersRound,
  Handshake,
} from 'lucide-react';
import { TranslationKey } from '../i18n/translations';

export type NavPageKey =
  | 'dashboard'
  | 'chanda'
  | 'donation'
  | 'ads'
  | 'expenses'
  | 'vendors'
  | 'advertisers'
  | 'donors'
  | 'members'
  | 'treasury'
  | 'report'
  | 'loans'
  | 'estimation'
  | 'tasks'
  | 'documents'
  | 'assets'
  | 'awards'
  | 'activityLog'
  | 'settings';

export interface NavItemConfig {
  key: NavPageKey;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelKey: TranslationKey;
  checkPermission: (permissions?: any) => boolean;
}

export interface NavGroupConfig {
  id: string;
  labelKey: TranslationKey;
  items: NavItemConfig[];
}

export const NAVIGATION_GROUPS: NavGroupConfig[] = [
  {
    id: 'main',
    labelKey: 'sidebar.groupMain',
    items: [
      { key: 'dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard', checkPermission: () => true },
      { key: 'chanda', icon: HandCoins, labelKey: 'nav.chanda', checkPermission: (p) => !!p?.chanda },
      { key: 'donation', icon: Gift, labelKey: 'nav.donation', checkPermission: (p) => !!(p?.donation ?? p?.donationAds) },
      { key: 'ads', icon: Megaphone, labelKey: 'nav.ads', checkPermission: (p) => !!(p?.ads ?? p?.donationAds) },
      { key: 'expenses', icon: TrendingDown, labelKey: 'nav.expenses', checkPermission: (p) => !!p?.expenses },
    ],
  },
  {
    id: 'accounts',
    labelKey: 'sidebar.groupAccounts',
    items: [
      { key: 'treasury', icon: Wallet, labelKey: 'nav.treasury', checkPermission: (p) => !!p?.treasury },
      { key: 'report', icon: FileBarChart, labelKey: 'nav.report', checkPermission: (p) => !!p?.treasury },
      { key: 'loans', icon: Landmark, labelKey: 'nav.loans', checkPermission: (p) => !!p?.loans },
      { key: 'estimation', icon: Calculator, labelKey: 'nav.estimation', checkPermission: (p) => !!p?.estimation },
    ],
  },
  {
    id: 'essential',
    labelKey: 'sidebar.groupEssential',
    items: [
      { key: 'donors', icon: UserPlus, labelKey: 'nav.donors', checkPermission: (p) => !!p?.members },
      { key: 'members', icon: UsersRound, labelKey: 'nav.committee', checkPermission: (p) => !!p?.members },
      { key: 'vendors', icon: Truck, labelKey: 'nav.vendors', checkPermission: (p) => !!p?.vendors },
      { key: 'advertisers', icon: Handshake, labelKey: 'nav.advertisers', checkPermission: (p) => !!(p?.ads ?? p?.donationAds) },
      { key: 'documents', icon: FolderOpen, labelKey: 'nav.documents', checkPermission: (p) => p?.documents !== false },
      { key: 'tasks', icon: CheckSquare, labelKey: 'nav.tasks', checkPermission: (p) => !!p?.tasks },
      { key: 'assets', icon: Package, labelKey: 'nav.assets', checkPermission: (p) => p?.assets !== false },
      { key: 'awards', icon: Trophy, labelKey: 'nav.awards', checkPermission: () => true },
    ],
  },
  {
    id: 'admin',
    labelKey: 'sidebar.groupAdmin',
    items: [
      { key: 'activityLog', icon: ScrollText, labelKey: 'nav.activityLog', checkPermission: (p) => !!p?.settings },
      { key: 'settings', icon: SettingsIcon, labelKey: 'nav.settings', checkPermission: (p) => !!p?.settings },
    ],
  },
];
