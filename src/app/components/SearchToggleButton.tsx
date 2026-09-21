import { Search } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface SearchToggleButtonProps {
  open: boolean;
  onToggle: () => void;
}

// Sits in the page title bar, left of Import/Export/Add — opens/closes the
// TableSearchBar panel below instead of it always taking up screen space.
export function SearchToggleButton({ open, onToggle }: SearchToggleButtonProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={onToggle}
      aria-expanded={open}
      className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 rounded-lg transition-colors font-bold text-sm sm:text-base whitespace-nowrap border ${
        open
          ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 text-orange-600'
          : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
      }`}
    >
      <Search size={20} />
      <span className="hidden sm:inline">{t('search.toggle')}</span>
    </button>
  );
}
