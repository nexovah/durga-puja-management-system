import { useState } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export interface TableSearchFilters {
  amountMin: string;
  amountMax: string;
  billVoucher: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  paidMethod: string;
  phone: string;
}

export const emptyTableSearchFilters: TableSearchFilters = {
  amountMin: '', amountMax: '', billVoucher: '', status: '', dateFrom: '', dateTo: '', paidMethod: '', phone: '',
};

export const hasActiveTableFilters = (f: TableSearchFilters) => Object.values(f).some(v => v.trim() !== '');

interface Option { value: string; label: string }

interface TableSearchBarProps {
  query: string;
  onQueryChange: (v: string) => void;
  placeholder: string;
  filters: TableSearchFilters;
  onFiltersChange: (f: TableSearchFilters) => void;
  onSearch: () => void;
  onClear: () => void;
  filtersActive: boolean;
  resultCount?: number; // shown once filters are active, e.g. "12 of 480"
  totalCount?: number;
  showAmount?: boolean;
  showBillVoucher?: boolean;
  billVoucherLabel?: string;
  statusOptions?: Option[];
  paidMethodOptions?: Option[];
  showDateRange?: boolean;
  showPhone?: boolean;
}

// Per-page search + advanced filter bar — lives in the page body, directly
// above that page's own table, and filters that table in place (no
// navigation, no separate preview list). Reused across Members, Chanda,
// Donation/Ads, Expenses and Loans with a different `show*` field set per
// page depending on what data that table actually has.
export function TableSearchBar({
  query, onQueryChange, placeholder, filters, onFiltersChange, onSearch, onClear, filtersActive,
  resultCount, totalCount,
  showAmount, showBillVoucher, billVoucherLabel, statusOptions, paidMethodOptions, showDateRange, showPhone,
}: TableSearchBarProps) {
  const { t } = useLanguage();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const hasAdvancedFields = showAmount || showBillVoucher || statusOptions || paidMethodOptions || showDateRange || showPhone;

  const handleSearch = () => {
    onSearch();
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => onQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {hasAdvancedFields && (
          <button
            onClick={() => setShowAdvanced(o => !o)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${
              filtersActive
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={14} />
            {t('search.advancedFilters')}
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {showAdvanced && hasAdvancedFields && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {showAmount && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.amountMin')}</label>
                  <input
                    type="number"
                    value={filters.amountMin}
                    onChange={(e) => onFiltersChange({ ...filters, amountMin: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.amountMax')}</label>
                  <input
                    type="number"
                    value={filters.amountMax}
                    onChange={(e) => onFiltersChange({ ...filters, amountMax: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                    placeholder={t('search.anyAmount')}
                  />
                </div>
              </>
            )}
            {showBillVoucher && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{billVoucherLabel || t('search.billVoucher')}</label>
                <input
                  type="text"
                  value={filters.billVoucher}
                  onChange={(e) => onFiltersChange({ ...filters, billVoucher: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
            )}
            {showPhone && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.phone')}</label>
                <input
                  type="text"
                  value={filters.phone}
                  onChange={(e) => onFiltersChange({ ...filters, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                />
              </div>
            )}
            {statusOptions && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.paymentStatus')}</label>
                <select
                  value={filters.status}
                  onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('search.any')}</option>
                  {statusOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
            {paidMethodOptions && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.paymentMethod')}</label>
                <select
                  value={filters.paidMethod}
                  onChange={(e) => onFiltersChange({ ...filters, paidMethod: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                >
                  <option value="">{t('search.any')}</option>
                  {paidMethodOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
            {showDateRange && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.dateFrom')}</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t('search.dateTo')}</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button
              onClick={handleSearch}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm"
            >
              <Search size={15} />
              {t('search.searchButton')}
            </button>
            <button
              onClick={onClear}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
            >
              {t('search.clearButton')}
            </button>
          </div>
        </div>
      )}

      {(filtersActive || query.trim() !== '') && resultCount !== undefined && totalCount !== undefined && (
        <p className="text-xs text-gray-500 mt-2.5">
          {t('search.resultCount').replace('{shown}', String(resultCount)).replace('{total}', String(totalCount))}
        </p>
      )}
    </div>
  );
}
