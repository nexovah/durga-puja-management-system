import { Download } from 'lucide-react';
import { Expense } from '../App';
import { PageHeading } from './PageHeading';
import { useLanguage } from '../i18n/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { csvField } from '../lib/csv';

interface VendorsProps {
  expenses: Expense[];
}

// Read-only view: every expense that has a Vendor/Supplier Name attached
// (collected on the Expenses "Add New Expense" form) shows up here.
export function Vendors({ expenses }: VendorsProps) {
  const { t, locale } = useLanguage();

  const categoryLabel = (value: string) => {
    const key = `expenses.category.${value}` as TranslationKey;
    const label = t(key);
    return label === key ? value : label;
  };

  const vendorEntries = [...expenses]
    .filter(exp => (exp.vendorName || '').trim() !== '')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExport = () => {
    const csvContent = [
      [
        t('vendors.name'),
        t('vendors.contact'),
        t('expenses.category'),
        t('common.date'),
        t('common.remarks'),
      ].map(csvField).join(','),
      ...vendorEntries.map(exp => [
        exp.vendorName || '',
        exp.vendorContact || '',
        categoryLabel(exp.category),
        exp.date,
        exp.remarks,
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold"
          >
            <Download size={20} />
            {t('common.export')}
          </button>
        }
      >
        {t('vendors.pageTitle')}
      </PageHeading>

      <p className="text-sm text-gray-500 -mt-4">{t('vendors.hint')}</p>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('vendors.name')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('vendors.contact')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('expenses.category')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.date')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">{t('common.remarks')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vendorEntries.map((exp) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-800 font-medium">{exp.vendorName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.vendorContact || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      {categoryLabel(exp.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(exp.date).toLocaleDateString(locale)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{exp.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vendorEntries.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {t('vendors.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
