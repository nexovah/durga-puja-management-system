import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { Members } from './components/Members';
import { ChandaCollection } from './components/ChandaCollection';
import { DonationAdsCollection } from './components/DonationAdsCollection';
import { Expenses } from './components/Expenses';
import { Treasury } from './components/Treasury';
import { Settings } from './components/Settings';
import { useLanguage } from './i18n/LanguageContext';

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
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
  logo: string; // Base64 image data or image URL
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

export interface Chanda {
  id: string;
  donorName: string;
  amount: number;
  date: string;
  phone: string;
  remarks: string;
}

export type DonationAdCategory = 'donation' | 'ads';

export interface DonationAd {
  id: string;
  category: DonationAdCategory;
  donorName: string;
  companyName?: string; // Ads only
  amount: number;
  inKind: string; // Donation/Ads in kinds (free text)
  date: string;
  phone: string;
  remarks: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: string;
  remarks: string;
}

export default function App() {
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'members' | 'chanda' | 'donationAds' | 'expenses' | 'treasury' | 'settings'>('dashboard');

  const [users, setUsers] = useState<User[]>([
    {
      id: '1',
      name: 'Admin User',
      username: 'admin',
      password: 'admin123',
      isAdmin: true,
      permissions: {
        members: true,
        chanda: true,
        donationAds: true,
        expenses: true,
        treasury: true,
        settings: true,
      },
    },
  ]);

  const [committeeInfo, setCommitteeInfo] = useState<CommitteeInfo>({
    name: 'শ্রী শ্রী দুর্গা পূজা কমিটি',
    logo: '🕉️',
    established: '২০১৯',
    regNumber: '৮০০১৪৮৬৪',
    association: 'বেনজীন সর্বজনীন দুর্গোৎসব কমিটি',
    post: 'পোস্ট',
    districtPS: 'কালিপাড়া পোস্ট, দুর্গা পূজা ময়দান, কালিপাড়া বাজার',
    pinCode: '৭৪১২৩৯',
    mobile1: '৯৭৭৫৭৬৭৪০২',
    address: 'কলকাতা, পশ্চিমবঙ্গ',
    phone: '৯৮৭৬৫৪৩২১০',
    year: '২০২৬',
  });

  const [members, setMembers] = useState<Member[]>([
    {
      id: '1',
      name: 'রাজেশ কুমার',
      phone: '9876543210',
      address: 'কলকাতা',
      role: 'president',
      joinDate: '2024-01-01',
    },
    {
      id: '2',
      name: 'সুমন দাস',
      phone: '9876543211',
      address: 'কলকাতা',
      role: 'secretary',
      joinDate: '2024-01-01',
    },
  ]);

  const [chandaList, setChandaList] = useState<Chanda[]>([
    {
      id: '1',
      donorName: 'অমিত শর্মা',
      amount: 5000,
      date: '2026-01-15',
      phone: '9876543212',
      remarks: 'প্রথম চাঁদা',
    },
  ]);

  const [donationAdsList, setDonationAdsList] = useState<DonationAd[]>([]);

  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: '1',
      title: 'পণ্ডাল নির্মাণ',
      amount: 50000,
      date: '2026-01-20',
      category: 'construction',
      remarks: 'বাঁশ ও কাপড়',
    },
  ]);

  const [developerInfo, setDeveloperInfo] = useState({
    name: 'Developer Name',
    email: 'developer@example.com',
    phone: '1234567890',
    version: '1.0.0',
  });

  // Load data from localStorage
  useEffect(() => {
    const savedUsers = localStorage.getItem('puja-users');
    const savedCommittee = localStorage.getItem('puja-committee');
    const savedMembers = localStorage.getItem('puja-members');
    const savedChanda = localStorage.getItem('puja-chanda');
    const savedDonationAds = localStorage.getItem('puja-donation-ads');
    const savedExpenses = localStorage.getItem('puja-expenses');
    const savedDeveloper = localStorage.getItem('puja-developer');

    if (savedUsers) {
      const parsedUsers = JSON.parse(savedUsers);
      // Backward compatibility: ensure donationAds permission exists on users saved before this feature
      setUsers(parsedUsers.map((u: User) => ({
        ...u,
        permissions: { donationAds: u.isAdmin, ...u.permissions },
      })));
    }
    if (savedCommittee) setCommitteeInfo(JSON.parse(savedCommittee));
    if (savedMembers) setMembers(JSON.parse(savedMembers));
    if (savedChanda) setChandaList(JSON.parse(savedChanda));
    if (savedDonationAds) setDonationAdsList(JSON.parse(savedDonationAds));
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));
    if (savedDeveloper) setDeveloperInfo(JSON.parse(savedDeveloper));
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('puja-users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('puja-committee', JSON.stringify(committeeInfo));
  }, [committeeInfo]);

  useEffect(() => {
    localStorage.setItem('puja-members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('puja-chanda', JSON.stringify(chandaList));
  }, [chandaList]);

  useEffect(() => {
    localStorage.setItem('puja-donation-ads', JSON.stringify(donationAdsList));
  }, [donationAdsList]);

  useEffect(() => {
    localStorage.setItem('puja-expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('puja-developer', JSON.stringify(developerInfo));
  }, [developerInfo]);

  const handleLogin = (username: string, password: string) => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('dashboard');
  };

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
              <p>{t('header.post')}:—{committeeInfo.post}, {t('header.ps')}:—{committeeInfo.districtPS}</p>
              <p><strong>{t('header.pin')}:—{committeeInfo.pinCode}</strong></p>
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
        <div className="container mx-auto px-4">
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
            setUsers={setUsers}
            currentUser={currentUser}
            developerInfo={developerInfo}
            setDeveloperInfo={setDeveloperInfo}
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