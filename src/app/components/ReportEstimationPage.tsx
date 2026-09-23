import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, MoreVertical, Download, FileText } from 'lucide-react';
import { Estimation } from '../App';
import { useLanguage } from '../i18n/LanguageContext';
import { Pagination, usePagination } from './Pagination';
import { downloadTableCSV } from '../lib/reportExport';

interface ReportEstimationPageProps {
  estimationsList: Estimation[];
  companyName: string;
  companyLogo: string;
}

const totalOf = (est: Estimation) => est.lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

// Estimation is a document list (each row has its own line items), not a
// flat transaction ledger — no natural date-range/chart concept, so this
// deliberately skips ReportModulePage's chart+widgets shell (see the
// plan's called-out exception) and exports each selected estimation's
// full line-item detail instead of one combined table.
export function ReportEstimationPage({ estimationsList, companyName, companyLogo }: ReportEstimationPageProps) {
  const { t, locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState<Estimation[] | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!printing) return;
    const timer = setTimeout(() => window.print(), 50);
    const onAfterPrint = () => setPrinting(null);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, [printing]);

  const filtered = estimationsList.filter(e => !searchQuery.trim() || e.title.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const pagination = usePagination(filtered);

  const allChecked = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map(e => e.id)));
  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const exportTargets = () => (selected.size > 0 ? filtered.filter(e => selected.has(e.id)) : filtered);

  const handleDownloadCSV = () => {
    const targets = exportTargets();
    targets.forEach(est => {
      downloadTableCSV(`estimation-${est.title || est.id}.csv`, {
        companyName,
        summary: [
          { label: t('report.col.total'), value: `₹${totalOf(est).toLocaleString()}` },
          { label: t('report.col.lineItems'), value: String(est.lineItems.length) },
        ],
        headers: [est.columnLabels.serialNo, est.columnLabels.title, est.columnLabels.customField, est.columnLabels.customField2, est.columnLabels.amount],
        rows: est.lineItems.map((item, i) => [i + 1, item.title, item.customField, item.customField2, item.amount || 0]),
      });
    });
    setMenuOpen(false);
  };

  const handleDownloadPDF = () => {
    setPrinting(exportTargets());
    setMenuOpen(false);
  };

  const inputClass = "px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('report.nav.estimation')}</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('report.search')}
              className={`${inputClass} w-full pl-9`}
            />
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{selected.size} {t('report.selected')}</span>}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="flex items-center justify-center p-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-30">
                  <button onClick={handleDownloadCSV} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Download size={16} /> {t('treasury.report.downloadCSV')}
                  </button>
                  <button onClick={handleDownloadPDF} className="w-full flex items-center gap-3 text-left px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <FileText size={16} /> {t('treasury.report.downloadPDF')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} className="w-4 h-4 rounded" /></th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('report.col.title')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('report.col.lineItems')}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('report.col.total')}</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('report.col.created')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pagination.pageItems.map(est => (
                <tr key={est.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${selected.has(est.id) ? 'bg-orange-50/60 dark:bg-orange-500/10' : ''}`}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(est.id)} onChange={() => toggleOne(est.id)} className="w-4 h-4 rounded" /></td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{est.title}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{est.lineItems.length}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">₹{totalOf(est).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{new Date(est.createdAt).toLocaleDateString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">{t('report.noData')}</div>
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

      {printing && createPortal(
        <div className="print-area hidden print:block bg-white text-gray-900 p-0">
          {printing.map(est => (
            <div key={est.id} className="mb-10 break-after-page">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-300">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                  {companyLogo && (companyLogo.startsWith('data:') || companyLogo.startsWith('http')) ? (
                    <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{companyLogo || '🕉️'}</span>
                  )}
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{companyName}</p>
                  <p className="text-sm text-gray-600">{est.title}</p>
                </div>
              </div>
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b-2 border-gray-800">
                    <th className="text-left py-2 pr-2 text-sm font-bold">{est.columnLabels.serialNo}</th>
                    <th className="text-left py-2 pr-2 text-sm font-bold">{est.columnLabels.title}</th>
                    <th className="text-left py-2 pr-2 text-sm font-bold">{est.columnLabels.customField}</th>
                    <th className="text-left py-2 pr-2 text-sm font-bold">{est.columnLabels.customField2}</th>
                    <th className="text-right py-2 text-sm font-bold">{est.columnLabels.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  {est.lineItems.map((item, i) => (
                    <tr key={item.id} className="border-b border-gray-300">
                      <td className="py-2 pr-2 text-sm">{i + 1}</td>
                      <td className="py-2 pr-2 text-sm">{item.title}</td>
                      <td className="py-2 pr-2 text-sm">{item.customField}</td>
                      <td className="py-2 pr-2 text-sm">{item.customField2}</td>
                      <td className="py-2 text-sm text-right">₹{(item.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end pt-3 border-t-2 border-gray-800">
                <div className="text-right">
                  <p className="text-xs font-bold uppercase tracking-wide">{t('report.col.total')}</p>
                  <p className="text-xl font-bold">₹{totalOf(est).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
