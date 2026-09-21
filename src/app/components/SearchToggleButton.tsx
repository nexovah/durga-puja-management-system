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
          ? 'bg-orange-50 border-orange-300 text-orange-600'
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Search size={20} />
      <span className="hidden sm:inline">{t('search.toggle')}</span>
    </button>
  );
}
