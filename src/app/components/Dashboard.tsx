import { Users, DollarSign, TrendingDown, Wallet, ShoppingCart, BarChart3, Shield, MessageSquare, Calendar, FileText, UserCheck, PieChart, Database, ClipboardList } from 'lucide-react';
import { Member, Chanda, Expense } from '../App';

interface DashboardProps {
  members: Member[];
  chandaList: Chanda[];
  expenses: Expense[];
}

export function Dashboard({ members, chandaList, expenses }: DashboardProps) {
  const totalChanda = chandaList.reduce((sum, chanda) => sum + chanda.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const balance = totalChanda - totalExpenses;

  const recentChanda = chandaList.length > 0 
    ? [...chandaList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].amount 
    : 0;

  const tiles = [
    { title: 'মোট সদস্য', value: members.length, icon: Users, color: 'from-blue-500 to-blue-600', textColor: 'text-white' },
    { title: 'মোট চাঁদা', value: `₹${totalChanda.toLocaleString()}`, icon: DollarSign, color: 'from-green-500 to-green-600', textColor: 'text-white' },
    { title: 'সাম্প্রতিক চাঁদা সংগ্রহ', value: `₹${recentChanda.toLocaleString()}`, icon: Wallet, color: 'from-purple-500 to-purple-600', textColor: 'text-white', fullWidth: true },
    { title: 'মোট খরচ', value: `₹${totalExpenses.toLocaleString()}`, icon: TrendingDown, color: 'from-red-500 to-red-600', textColor: 'text-white' },
    { title: 'খরচ', value: expenses.length, icon: ClipboardList, color: 'from-orange-500 to-orange-600', textColor: 'text-white' },
    { title: 'বিক্রয়', value: '0', icon: ShoppingCart, color: 'from-purple-600 to-purple-700', textColor: 'text-white' },
    { title: 'কোষাধ্যক্ষ ব্যবস্থাপনা', value: '', icon: Wallet, color: 'from-cyan-500 to-cyan-600', textColor: 'text-white' },
    { title: 'শালীশ', value: '', icon: FileText, color: 'from-pink-500 to-pink-600', textColor: 'text-white' },
    { title: 'বাজেট', value: '', icon: BarChart3, color: 'from-indigo-500 to-indigo-600', textColor: 'text-white' },
    { title: 'দিনিক', value: '', icon: Calendar, color: 'from-teal-600 to-teal-700', textColor: 'text-white' },
    { title: 'মেসেজ', value: '', icon: MessageSquare, color: 'from-blue-600 to-blue-700', textColor: 'text-white' },
    { title: 'সুরক্ষা নিরীক্ষ', value: '', icon: Shield, color: 'from-red-600 to-red-700', textColor: 'text-white' },
    { title: 'উপবৃতি', value: '', icon: UserCheck, color: 'from-purple-600 to-purple-700', textColor: 'text-white' },
    { title: 'বিবেচনা', value: '', icon: PieChart, color: 'from-purple-500 to-purple-600', textColor: 'text-white' },
    { title: 'ব্যাকআপ', value: '', icon: Database, color: 'from-gray-600 to-gray-700', textColor: 'text-white' },
  ];

  return (
    <div className="space-y-4">
      {/* Management Button */}
      <button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all">
        📋 কমিটি সদস্য পরিচালনা
      </button>

      {/* Tiles Grid */}
      <div className="grid grid-cols-2 gap-4">
        {tiles.map((tile, index) => (
          <div
            key={index}
            className={`${tile.fullWidth ? 'col-span-2' : ''} bg-gradient-to-br ${tile.color} rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer group`}
          >
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="bg-white/20 p-4 rounded-xl group-hover:scale-110 transition-transform">
                <tile.icon className={tile.textColor} size={32} />
              </div>
              <p className={`font-bold text-base ${tile.textColor}`}>{tile.title}</p>
              {tile.value && (
                <p className={`text-3xl font-bold ${tile.textColor}`}>{tile.value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Year Selector and Download */}
      <div className="flex gap-3 items-center bg-white rounded-xl p-4 shadow-md">
        <div className="flex items-center gap-2 flex-1">
          <div className="bg-orange-500 p-2 rounded-lg">
            <Calendar className="text-white" size={24} />
          </div>
          <select className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none">
            <option value="2026">বছর নির্বাচন: 2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:from-orange-600 hover:to-orange-700 transition-all shadow-md flex items-center gap-2">
          <FileText size={20} />
          ডাউনলোড
        </button>
      </div>
    </div>
  );
}
