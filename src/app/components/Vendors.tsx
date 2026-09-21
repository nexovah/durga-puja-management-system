import { useMemo, useState } from 'react';
import { Download, Eye, X } from 'lucide-react';
import { Expense, getExpenseCreditAmount } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { csvField } from '../lib/csv';
import { Pagination, usePagination } from './Pagination';

interface VendorsProps {
  expenses: Expense[];
}

interface VendorGroup {
  key: string;
  name: string;
  contact: string;
  entries: Expense[];
  totalAmount: number;
  categories: string[];
}

// Read-only view: every expense that has a Vendor/Supplier Name attached
// (collected on the Expenses "Add New Expense" form) shows up here, merged
// into one row per vendor Name + Contact so repeat payments to the same
// vendor across different dates/expenses total up correctly.
export function Vendors({ expenses }: VendorsProps) {
  const { t, locale } = useLanguage();
  const [viewingKey, setViewingKey] = useState<string | null>(null);

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };

  const vendorGroups = useMemo<VendorGroup[]>(() => {
    const withVendor = expenses.filter(exp => (exp.vendorName || '').trim() !== '');
    const groups = new Map<string, VendorGroup>();

    for (const exp of withVendor) {
      const name = (exp.vendorName || '').trim();
      const contact = (exp.vendorContact || '').trim();
      const key = `${name.toLowerCase()}|${contact.toLowerCase()}`;

      if (!groups.has(key)) {
        groups.set(key, { key, name, contact, entries: [], totalAmount: 0, categories: [] });
      }
      const group = groups.get(key)!;
      group.entries.push(exp);
      group.totalAmount += getExpenseCreditAmount(exp);
      if (!group.categories.includes(exp.category)) group.categories.push(exp.category);
    }

    return [...groups.values()]
      .map(g => ({
        ...g,
        entries: g.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenses]);

  const viewingVendor = vendorGroups.find(g => g.key === viewingKey) || null;

  const pagination = usePagination(vendorGroups);

  const handleExport = () => {
    const csvContent = [
      [
        t('vendors.name'),
        t('vendors.contact'),
        t('expenses.category'),
        t('vendors.transactions'),
        t('vendors.totalAmount'),
      ].map(csvField).join(','),
      ...vendorGroups.map(g => [
        g.name,
        g.contact,
        g.categories.map(categoryLabel).join(' / '),
        g.entries.length,
        g.totalAmount,
      ].map(csvField).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendors-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <PageHeading
        action={
          <button
            onClick={handleExport}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-bold"
          >
            <Download size={20} />
            {t('common.export')}
          </button>
        }
      >
        {t('vendors.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 dark:text-gray-400 -mt-4">{t('vendors.hint')}</p>

      {/* Vendor detail panel */}
      {viewingVendor && (
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{viewingVendor.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{viewingVendor.contact || '-'}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {viewingVendor.categories.map(cat => (
                  <span key={cat} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {categoryLabel(cat)}
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setViewingKey(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.totalAmount')}</p>
              <p className="text-2xl font-bold text-green-600">₹{viewingVendor.totalAmount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('vendors.transactions')}</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">{viewingVendor.entries.length}</p>
            </div>
          </div>

          <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2">{t('vendors.paymentHistory')}</h4>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('common.date')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.title')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.category')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('expenses.voucherNumber')}</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{t('common.amount')}</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">{t('common.remarks')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {viewingVendor.entries.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">{exp.title}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{categoryLabel(exp.category)}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{exp.voucherNumber || '-'}</td>
                    <td className="px-4 py-2 text-sm text-green-600 font-bold text-right">
                      ₹{getExpenseCreditAmount(exp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{exp.remarks || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.name')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.contact')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{t('expenses.category')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.transactions')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('vendors.totalAmount')}</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">{t('common.action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pagination.pageItems.map((g) => (
                <tr key={g.key} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${viewingKey === g.key ? 'bg-orange-50 dark:bg-orange-500/10' : ''}`}>
                  <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200 font-medium">{g.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{g.contact || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {g.categories.map(cat => (
                        <span key={cat} className="px-2.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {categoryLabel(cat)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 text-right">{g.entries.length}</td>
                  <td className="px-6 py-4 text-sm text-green-600 font-bold text-right">₹{g.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setViewingKey(viewingKey === g.key ? null : g.key)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors inline-flex items-center gap-1"
                      title={t('vendors.view')}
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendorGroups.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {t('vendors.empty')}
            </div>
          )}
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.setPageSize}
          totalItems={pagination.totalItems}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
        />
      </div>
    </div>
  );
}
